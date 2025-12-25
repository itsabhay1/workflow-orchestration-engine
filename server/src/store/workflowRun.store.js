import { randomUUID } from 'crypto';

const workflowRuns = new Map();

// creating  a new workflow run
export function createWorkflowRun(workflowId) {
    const run = {
        runId: randomUUID(),
        workflowId,
        status: 'PENDING',
        startedAt: new Date().toISOString(),
        finishedAt: null
    };

    workflowRuns.set(run.runId, run);
    return run;
}

// Get a workflow run by ID

export function getWorkflowRun(runId) {
    return workflowRuns.get(runId);
}

// Get all workflow runs
export function getAllWorkflowRuns() {
    return Array.from(workflowRuns.values());
}