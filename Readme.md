# 🚀 Workflow Orchestrator Engine — Distributed Task Execution System

A **distributed workflow orchestration system** designed to execute complex multi-step workflows, built with a strong focus on:

* 🔄 Stateful workflow execution
* 🐳 Containerized task execution
* 🧠 Fault tolerance (OOM, timeout, shutdown)
* 🔒 Isolation via MCP (Multi-Container Platform)
* ⚡ Scalable and modular architecture

This system separates control plane (workflow engine) from execution plane (MCP gateway) to ensure safe, reliable, and extensible task execution.

---

# 🧠 Architecture Overview

```
                +----------------------+
                |   Workflow Engine    |
                |----------------------|
                | Scheduler (tick)     |
                | Step State Machine   |
                | Retry Handling       |
                | DB Persistence       |
                +----------+-----------+
                           |
                           | HTTP (/execute)
                           v
                +----------------------+
                |   MCP Gateway        |
                |----------------------|
                | Container Executor   |
                | Resource Limiter     |
                | Sandbox Layer        |
                | Zombie Cleanup       |
                +----------+-----------+
                           |
                           v
                +----------------------+
                |  Docker Containers   |
                |----------------------|
                | Isolated Execution   |
                | CPU / Memory Limits  |
                | No Network Access    |
                +----------------------+
```

---

# ⚙️ Core Features

## 🔹 Workflow Engine

* Stateful workflow execution
* Step dependency resolution
* Atomic step locking (prevents duplicate execution)
* Heartbeat-based execution tracking
* Workflow lifecycle management

## 🔹 MCP (Execution Gateway)

* Decouples execution from orchestration
* Runs each step inside a **Docker container**
* Enforces:

  * CPU limits
  * Memory limits
  * Process limits
* Network isolation (`--network none`)

## 🔹 Fault Tolerance

* 💥 OOM detection (exit code `137`)
* ⏱ Timeout handling
* 🔁 Retry mechanism (configurable)
* 🧟 Zombie container cleanup
* 📴 Graceful shutdown handling

## 🔹 Observability

* Captures stdout + stderr logs
* Tracks exit codes
* Execution status reporting (COMPLETED / FAILED)

---

# 🧱 Tech Stack

* **Backend:** Node.js, Express
* **Database:** PostgreSQL
* **Container Runtime:** Docker
* **Process Management:** Child Processes (spawn)
* **Architecture:** Microservices (Engine + MCP)

---

# 📁 Project Structure

```
.
├── engine/                     # Workflow Engine
│   ├── services/
│   │   └── scheduler.service.js
│   ├── repositories/
│   ├── utils/
│   └── db.js
│
├── mcp/                        # Execution Gateway
│   ├── src/
│   │   ├── routes/
│   │   ├── executor/
│   │   ├── utils/
│   │   └── index.js
│   ├── Dockerfile
│   └── .dockerignore
│
└── README.md
```

---

# 🐳 MCP Setup (Dockerized)

## Build MCP

```bash
docker build -t mcp .
```

## Run MCP

```bash
docker run -p 4000:4000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  mcp
```

---

# 🔌 API: Execute Step

## Endpoint

```
POST /execute
```

## Request Body

```json
{
  "stepRunId": "step-123",
  "image": "alpine",
  "command": ["echo", "Hello MCP"],
  "timeout": 10,
  "resources": {
    "cpu": 0.5,
    "memory": "128m",
    "pids": 64
  },
  "tenantId": "workflow-1"
}
```

## Response

```json
{
  "status": "COMPLETED",
  "logs": "Hello MCP\n",
  "exitCode": 0
}
```

---

# 🧪 Example Execution

```bash
curl -X POST http://localhost:4000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "stepRunId": "test-1",
    "image": "alpine",
    "command": ["echo", "Hello MCP"],
    "timeout": 10,
    "resources": { "memory": "64m" },
    "tenantId": "test"
  }'
```

---

# ⚠️ Failure Handling

| Scenario | Behavior                          |
| -------- | --------------------------------- |
| OOM      | Exit code `137`, marked FAILED    |
| Timeout  | Process killed, exit code `124`   |
| Shutdown | Marked interrupted, retried       |
| Crash    | Captured and propagated to engine |

---

# 🔒 Security & Isolation

* Containers run with:

  * Limited CPU & memory
  * No network access
* Process isolation using Docker
* Execution separated from control plane (Engine)

---

# 🔄 Execution Flow

1. Engine schedules runnable steps
2. Acquires lock (atomic DB update)
3. Sends request to MCP `/execute`
4. MCP spawns Docker container
5. Execution completes / fails
6. MCP returns logs + exit code
7. Engine updates step + workflow state

---

# 📌 Future Improvements

* 🔐 Enhanced sandboxing (non-root, read-only FS)
* 🏢 Multi-tenant resource isolation
* 🔁 Advanced retry policies
* 📊 Metrics & monitoring
* ⚖️ Load balancing across MCP instances
* 🧠 Distributed engine with leader election

---

# 💡 Key Learnings

* Designing **stateful distributed systems**
* Handling **failure scenarios in real-world systems**
* Building **execution isolation layers**
* Working with **Docker programmatically**
* Implementing **graceful shutdown & recovery**

---

# ⭐ If you like this project

Give it a ⭐ on GitHub and feel free to contribute!
