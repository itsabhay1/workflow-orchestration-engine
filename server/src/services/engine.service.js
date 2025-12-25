import { getRunnableSteps } from './scheduler.service.js';
import { completeStepRun } from '../store/stepRun.store.js';
import { getAllWorkflowRuns } from '../store/workflowRun.store.js';

export function tick(runId) {
  const runs = getAllWorkflowRuns();
  const run = runs.find(r => r.runId === runId);

  if (!run) {
    throw new Error('Workflow run not found');
  }

  const runnableSteps = getRunnableSteps(run.runId, run.workflowId);

  for (const stepRun of runnableSteps) {
    // Mark step as RUNNING
    stepRun.status = 'RUNNING';
    stepRun.startedAt = new Date().toISOString();

    // Simulate execution
    // (Later this becomes Docker / MCP)
    completeStepRun(run.runId, stepRun.stepId);
  }

  return runnableSteps.length;
}
