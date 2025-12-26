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

//  To mark compeleted
export function completeStepRun(runId, stepId) {
  const stepRun = Array.from(stepRuns.values()).find(
    sr => sr.runId === runId && sr.stepId === stepId
  );

  if (!stepRun) {
    throw new Error('Step run not found');
  }

  stepRun.status = 'COMPLETED';
  stepRun.finishedAt = new Date().toISOString();

  return stepRun;
}


export function failStepRun(runId, stepId, errorMessage) {
  const stepRun = Array.from(stepRuns.values()).find(
    sr => sr.runId === runId && sr.stepId === stepId
  );

  if (!stepRun) {
    throw new Error('Step run not found');
  }

  stepRun.attempts += 1;
  stepRun.error = errorMessage;

  return stepRun;
}