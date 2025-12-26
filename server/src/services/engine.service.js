import { getRunnableSteps } from './scheduler.service.js';
import { completeStepRun, getStepRunsByRunId, failStepRun } from '../store/stepRun.store.js';
import { getAllWorkflowRuns, completeWorkflowRun } from '../store/workflowRun.store.js';
import { getAllWorkflows } from '../store/workflow.store.js';

export function tick(runId) {
  const runs = getAllWorkflowRuns();
  const run = runs.find(r => r.runId === runId);

  if (!run) {
    throw new Error('Workflow run not found');
  }

  const runnableSteps = getRunnableSteps(run.runId, run.workflowId);

  for (const stepRun of runnableSteps) {
    // mark RUNNING
    stepRun.status = 'RUNNING';
    stepRun.startedAt = new Date().toISOString();

    // simulate success/failure
    const shouldFail = Math.random() < 0.3;

    if (shouldFail) {
      // register failure
      const failed = failStepRun(
        run.runId,
        stepRun.stepId,
        'Simulated execution error'
      );

      // get retry limit from workflow definition
      const workflows = getAllWorkflows();
      const workflow = workflows.find(wf => wf.id === run.workflowId);
      const stepDef = workflow.steps.find(s => s.id === stepRun.stepId);

      if (failed.attempts <= stepDef.retry) {
        // retry allowed
        failed.status = 'PENDING';
      } else {
        // retry exhausted
        failed.status = 'FAILED';
      }
    } else {
      // success path
      completeStepRun(run.runId, stepRun.stepId);
    }
  }


  // check if workflow completed
  // check step states
  const stepRuns = getStepRunsByRunId(run.runId);

  // if failed
  const hasFailed = stepRuns.some(
    sr => sr.status === 'FAILED'
  );

  if (hasFailed) {
    run.status = 'FAILED';
    run.finishedAt = new Date().toISOString();
    return runnableSteps.length;
  }

  // check completion
  const allCompleted = stepRuns.every(
    sr => sr.status === 'COMPLETED'
  );

  if (allCompleted) {
    completeWorkflowRun(run.runId);
  }
}
