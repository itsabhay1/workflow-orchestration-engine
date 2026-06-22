# Workflow Orchestrator Engine — Distributed Task Execution System

A backend-focused distributed workflow execution system that persists workflow state in PostgreSQL, schedules dependency-aware steps, coordinates workers with database leases, and executes each step in an isolated Docker container through a separate MCP execution gateway.

This project is a strong systems-design exercise in workflow orchestration, failure recovery, containerized execution, and control-plane / execution-plane separation.

## Highlights

- Distributed workflow orchestration engine
- Lease-based multi-worker coordination
- Dependency-aware workflow scheduling
- Docker-based isolated execution
- PostgreSQL-backed durable workflow state
- Retry, recovery, and zombie-run handling
- Control Plane / Execution Plane architecture

## Motivation

Modern workflow systems need more than a queue and a worker. They need:

- durable state for workflows and step runs
- dependency-aware scheduling
- safe execution isolation
- retry and timeout handling
- crash recovery after process death
- coordination that prevents two workers from executing the same workflow run at once

This repository implements those ideas in a compact Node.js codebase with a clear split between orchestration and execution.

## Architecture

```text
                                   Control Plane
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Workflow Engine API                             │
│                                                                              │
│  Express routes                                                              │
│  /workflows      create + list workflows                                     │
│  /workflows/:id/run                                                          │
│  /runs/:runId                                                                │
│  /runs/:runId/runnable-steps                                                 │
│  /runs/:runId/tick                                                           │
│                                                                              │
│  Services                                                                    │
│  - workflow validation                                                       │
│  - dependency-aware scheduling                                               │
│  - retry decisions                                                           │
│  - lease renewal and worker coordination                                     │
│  - startup/shutdown recovery                                                 │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                │ PostgreSQL
                                ▼
                   ┌──────────────────────────────┐
                   │ workflows                    │
                   │ workflow_runs                │
                   │ step_runs                    │
                   └──────────────────────────────┘
                                │
                                │ HTTP POST /execute
                                ▼
                                  Execution Plane
┌──────────────────────────────────────────────────────────────────────────────┐
│                           MCP Execution Gateway                              │
│                                                                              │
│  Accepts execution requests from the engine                                  │
│  Spawns docker run with resource limits                                      │
│  Captures stdout/stderr                                                      │
│  Returns exit code, logs, timeout, and OOM outcomes                          │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
                     ┌──────────────────────────────┐
                     │ Ephemeral Docker Container   │
                     │ --cpus                       │
                     │ --memory                     │
                     │ --pids-limit                 │
                     │ --network none               │
                     └──────────────────────────────┘
```

## Control Plane vs Execution Plane

### Control Plane: Workflow Engine

The engine owns workflow state and orchestration decisions. It validates workflow definitions, creates workflow runs, decides which steps are runnable based on dependencies, acquires leases for distributed coordination, applies retries, and marks runs as completed or failed.

### Execution Plane: MCP Execution Gateway

The MCP service does not schedule or persist workflow state. Its job is narrower: accept an execution request, run a Docker container with the requested image and command, capture logs, and return the result to the engine. This separation keeps execution isolated from orchestration logic and makes the architecture easier to evolve.

## Core Features

- Workflow definitions are stored in PostgreSQL with step dependency metadata.
- Workflow runs are created with an `Idempotency-Key` to avoid duplicate run creation.
- Runnable step selection is dependency-aware and based on completed upstream steps.
- Step acquisition is atomic: a step transitions from `PENDING` to `RUNNING` through a guarded update.
- Workflow-run leases prevent multiple workers from actively driving the same run at the same time.
- The worker renews leases with heartbeats while execution is in progress.
- Each step executes in a Docker container with CPU, memory, PID, and network restrictions.
- Timeout, OOM, non-zero exit codes, shutdown interruption, and process crashes are handled explicitly.
- Startup recovery revives stale running steps.
- Zombie-run detection clears abandoned run leases and helps recover stale workflow state.
- Graceful shutdown preserves workflow state and allows interrupted executions to be recovered.

## Workflow Lifecycle

```text
Workflow Definition
    │
    ├─ POST /workflows
    │
    ▼
Stored in workflows
    │
    ├─ POST /workflows/:id/run   + Idempotency-Key
    │
    ▼
workflow_runs row created
step_runs rows created for each step
    │
    ▼
Worker scans PENDING/RUNNING runs
    │
    ▼
Lease acquired for a run
    │
    ▼
Runnable steps scheduled and executed
    │
    ├─ all steps completed  -> workflow_runs.status = COMPLETED
    └─ any step failed      -> workflow_runs.status = FAILED
```

## Step Lifecycle

```text
PENDING
  │
  ├─ dependencies satisfied
  ├─ atomic transition via tryMarkStepRunning()
  ▼
RUNNING
  │
  ├─ exit code 0                    -> COMPLETED
  ├─ non-zero exit / timeout / OOM  -> retry or FAILED
  ├─ shutdown interruption          -> PENDING
  └─ crash recovery / zombie reset  -> PENDING or FAILED
```

## Workflow Engine

The workflow engine is the main service in [`server/src`](./server/src). It exposes the API, persists definitions and runtime state, and runs an internal engine worker loop.

Key responsibilities implemented in code:

- `workflow.controller.js`: create workflows, list workflows, and create workflow runs
- `scheduler.service.js`: determine which steps are currently runnable
- `engine.service.js`: execute the engine tick, call the MCP gateway, update retries and workflow state
- `engine.worker.js`: poll runs, acquire leases, and drive execution
- `recovery.service.js`: recover stale `RUNNING` steps during startup
- `shutdownRecovery.service.js`: move interrupted running steps back to `PENDING`
- `zombieDetector.service.js`: detect runs whose lease heartbeats stopped and revive them

## MCP Execution Gateway

The MCP service lives under [`server/src/services/mcp`](./server/src/services/mcp). It acts as the execution gateway between the engine and Docker.

Execution flow:

1. The engine sends `POST http://localhost:4000/execute`.
2. The MCP service validates the basic payload.
3. It invokes `docker run --rm` with the requested image and command.
4. Resource limits are applied from the step definition:
   - `--cpus`
   - `--memory`
   - `--pids-limit`
   - `--network none`
5. stdout and stderr are collected and returned to the engine.
6. The engine decides whether the step completes, retries, or fails permanently.

## Docker Execution Model

Each step is executed in an ephemeral container rather than in-process. That provides:

- isolation between steps
- bounded CPU and memory consumption
- no network access by default
- easier reasoning about untrusted or resource-heavy commands

The current implementation uses Node child processes to spawn the local Docker CLI, not a Docker SDK. That keeps the execution path simple and explicit.

## PostgreSQL Persistence

The system uses PostgreSQL as the source of truth for both definitions and runtime state.

Tables referenced directly by the code:

- `workflows`
- `workflow_runs`
- `step_runs`

Persisted concerns include:

- workflow definitions and serialized step lists
- workflow-run status, timestamps, request id, lease owner, lease expiry, heartbeat
- step-run status, attempts, timeout, retry budget, logs, exit code, and errors

Because state is stored durably, the worker can recover after a crash rather than relying only on in-memory queues.

## Lease-Based Worker Coordination

Distributed coordination is implemented with database-backed leases on `workflow_runs`.

High-level behavior:

- workers scan for `PENDING` and `RUNNING` runs
- a worker attempts to acquire the run lease
- only the lease owner continues processing that run
- the lease owner renews `lease_expires_at` and `last_heartbeat`
- if heartbeats stop, another worker can recover the run after expiry

This pattern keeps coordination simple while avoiding duplicate execution across workers.

## Retry Handling

Retry logic is implemented at the step level:

- each step definition includes `retry`
- each execution attempt increments `attempts`
- if a step fails and `attempts <= retry`, it is moved back to `PENDING`
- if the retry budget is exhausted, the step is marked `FAILED`
- any failed step causes the overall workflow run to transition to `FAILED`

The engine treats `retry` as the number of retries after the initial attempt.

## Recovery Logic

Recovery is implemented in multiple places, each handling a different failure mode:

- Startup recovery:
  `recoverStuckSteps()` scans `RUNNING` steps and resets or fails them based on elapsed runtime.
- Zombie-run recovery:
  `detectZombieRuns()` identifies runs whose heartbeat expired and resets both the run lease and any `RUNNING` steps.
- Graceful shutdown recovery:
  on shutdown, running Docker processes are terminated and their steps are moved back to `PENDING`.
- Interrupted execution:
  if shutdown interrupts a step, the engine explicitly treats it as recoverable rather than terminal.

## Failure Handling

```text
Failure Mode                     Engine Behavior
------------------------------  ----------------------------------------------
Container exit code 0           Step marked COMPLETED
Non-zero container exit         Retry if budget remains, else FAILED
Timeout                         Container killed, step retried or failed
OOM / exit code 137            Step marked FAILED with OOM signal
Process shutdown                Step returned to PENDING
Lost run lease                  Current worker stops acting on the run
Expired heartbeat / zombie run  Run and running steps revived for re-processing
```

## API Overview

Base services:

- Engine API: `http://localhost:3000`
- MCP API: `http://localhost:4000`

### Engine Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check for the engine service |
| `POST` | `/workflows` | Validate and persist a workflow definition |
| `GET` | `/workflows` | List stored workflows |
| `POST` | `/workflows/:id/run` | Create a workflow run and step runs |
| `GET` | `/runs/:runId` | Return workflow-run state and associated step runs |
| `GET` | `/runs/:runId/runnable-steps` | Show which `PENDING` steps are dependency-ready |
| `POST` | `/runs/:runId/tick` | Manually trigger an engine tick for a run |
| `POST` | `/runs/:runId/steps/:stepId/complete` | Route exists for manually completing a step |

### MCP Endpoint

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/execute` | Execute one step inside Docker and return logs and exit code |

### Example Requests

Create a workflow:

```bash
curl -X POST http://localhost:3000/workflows \
  -H "Content-Type: application/json" \
  -d @workflow.json
```

Start a workflow run:

```bash
curl -X POST http://localhost:3000/workflows/<workflow-id>/run \
  -H "Idempotency-Key: run-001"
```

Execute directly against the MCP service:

```bash
curl -X POST http://localhost:4000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "stepRunId": "step-run-1",
    "image": "alpine",
    "command": ["echo", "hello from mcp"],
    "timeout": 10,
    "resources": {
      "cpu": 0.5,
      "memory": "128m",
      "pids": 64
    },
    "tenantId": "workflow-1"
  }'
```

## Example Workflow JSON

The repository includes a simple schema example at [`docs/workflow.schema.json`](./docs/workflow.schema.json). A workflow compatible with the current engine looks like this:

```json
{
  "name": "image-pipeline",
  "description": "Two-step containerized workflow",
  "steps": [
    {
      "id": "fetch",
      "image": "alpine",
      "command": ["sh", "-c", "echo fetching input"],
      "depends_on": [],
      "retry": 1,
      "timeout": 20,
      "resources": {
        "cpu": 0.5,
        "memory": "128m",
        "pids": 64
      }
    },
    {
      "id": "process",
      "image": "alpine",
      "command": ["sh", "-c", "echo processing after fetch"],
      "depends_on": ["fetch"],
      "retry": 2,
      "timeout": 30,
      "resources": {
        "cpu": 1,
        "memory": "256m",
        "pids": 64
      }
    }
  ]
}
```

## Tech Stack

- Node.js
- Express 5
- PostgreSQL via `pg`
- Docker
- Native child-process execution with `spawn`
- `dotenv` for environment configuration

## Project Structure

```text
.
├── docs/
│   └── workflow.schema.json
├── server/
│   ├── package.json
│   └── src/
│       ├── controllers/
│       │   ├── engine.controller.js
│       │   ├── run.controller.js
│       │   ├── step.controller.js
│       │   └── workflow.controller.js
│       ├── repositories/
│       │   ├── stepRun.repository.js
│       │   ├── workflow.repository.js
│       │   └── workflowRun.repository.js
│       ├── routes/
│       │   ├── engine.route.js
│       │   ├── run.route.js
│       │   ├── step.route.js
│       │   └── workflow.route.js
│       ├── services/
│       │   ├── dockerExecutor.service.js
│       │   ├── engine.service.js
│       │   ├── recovery.service.js
│       │   ├── scheduler.service.js
│       │   ├── shutdownRecovery.service.js
│       │   ├── zombieDetector.service.js
│       │   └── mcp/
│       │       ├── Dockerfile
│       │       ├── package.json
│       │       └── src/
│       │           ├── executor/
│       │           ├── routes/
│       │           ├── utils/
│       │           └── index.js
│       ├── utils/
│       │   └── shutdown.utils.js
│       ├── validators/
│       │   └── workflow.validator.js
│       ├── worker/
│       │   └── engine.worker.js
│       ├── db.js
│       └── index.js
└── README.md
```

## Local Setup

The repository currently contains two Node services:

- the workflow engine in `server/`
- the MCP execution gateway in `server/src/services/mcp/`

Prerequisites:

- Node.js 20+ recommended
- PostgreSQL
- Docker daemon running locally

### 1. Install dependencies

```bash
cd server
npm install
cd src/services/mcp
npm install
```

### 2. Configure the engine environment

The engine reads these environment variables for PostgreSQL:

```bash
DB_USER=
DB_HOST=
DB_NAME=
DB_PASSWORD=
DB_PORT=
```

Notes:

- the engine service is hardcoded to listen on port `3000`
- the MCP service listens on `PORT` or defaults to `4000`
- the repository does not include database migrations or a Docker Compose stack, so PostgreSQL tables must exist before startup

### 3. Start the MCP service

```bash
cd server/src/services/mcp
npm start
```

### 4. Start the engine service

```bash
cd server
npm start
```

Once both services are running:

- engine health check: `GET http://localhost:3000/health`
- MCP execute endpoint: `POST http://localhost:4000/execute`

## Key Engineering Concepts Demonstrated

- Stateful workflow orchestration with durable run and step records
- Dependency graph execution using `depends_on`
- Idempotent run creation via request keys
- Atomic state transitions for work acquisition
- Lease-based coordination for distributed workers
- Heartbeat renewal and zombie detection
- Control plane / execution plane separation
- Containerized execution with resource isolation
- Retry semantics and terminal failure propagation
- Startup and shutdown recovery for long-running systems

## Future Enhancements

The architecture has been intentionally designed to support future expansion in several areas:

- Horizontal scaling through multiple MCP execution gateways
- Service discovery and load-balanced execution routing
- Real-time workflow monitoring and operational dashboards
- Enhanced container sandboxing and security policies
- Advanced workflow patterns such as conditional branching and fan-out/fan-in execution
- Multi-tenant resource management and quota enforcement
- Workflow versioning and execution history comparison
- Distributed execution analytics and performance insights

## Author

**Abhay Agrawal**
