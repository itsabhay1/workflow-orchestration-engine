import { randomUUID } from 'crypto';

const stepRuns = new Map();

 // Create a StepRun
export function createStepRun(runId, stepId) {
  const stepRun = {
    stepRunId: randomUUID(),
    runId,
    stepId,
    status: 'PENDING',
    attempts: 0,
    startedAt: null,
    finishedAt: null,
    error: null
  };

  stepRuns.set(stepRun.stepRunId, stepRun);
  return stepRun;
}

 // Get all step runs for a workflow run
export function getStepRunsByRunId(runId) {
  return Array.from(stepRuns.values()).filter(
    stepRun => stepRun.runId === runId
  );
}
