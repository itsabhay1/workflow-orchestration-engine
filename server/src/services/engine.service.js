import { getRunnableSteps } from './scheduler.service.js';
import { completeStepRun, getStepRunsByRunId, failStepRun } from '../store/stepRun.store.js';
import { getAllWorkflowRuns, completeWorkflowRun } from '../store/workflowRun.store.js';
import { getAllWorkflows } from '../store/workflow.store.js';
import { runContainer } from './dockerExecutor.service.js';

export async function tick(runId) {
  const runs = getAllWorkflowRuns();
  const run = runs.find(r => r.runId === runId);

  if (!run) {
    throw new Error('Workflow run not found');
  }

  if (run.isTicking) {
    return 0;
  }

  run.isTicking = true;

  try {
    const runnableSteps = getRunnableSteps(run.runId, run.workflowId);

    for (const stepRun of runnableSteps) {
      stepRun.status = 'RUNNING';
      stepRun.startedAt = new Date().toISOString();

      // get step definition
      const workflows = getAllWorkflows();
      const workflow = workflows.find(wf => wf.id === run.workflowId);
      const stepDef = workflow.steps.find(s => s.id === stepRun.stepId);

      try {
        await runContainer({
          image: stepDef.image,
          command: stepDef.command,
          timeout: stepDef.timeout
        });

        // success
        completeStepRun(run.runId, stepRun.stepId);

      } catch (err) {
        const failed = failStepRun(
          run.runId,
          stepRun.stepId,
          err.message
        );

        if (failed.attempts <= stepDef.retry) {
          failed.status = 'PENDING';
          failed.startedAt = null;
          failed.finishedAt = null;
        } else {
          failed.status = 'FAILED';
        }
      }
    }

    const stepRuns = getStepRunsByRunId(run.runId);

    const hasFailed = stepRuns.some(sr => sr.status === 'FAILED');
    if (hasFailed) {
      run.status = 'FAILED';
      run.finishedAt = new Date().toISOString();
      return runnableSteps.length;
    }

    const allCompleted = stepRuns.every(sr => sr.status === 'COMPLETED');
    if (allCompleted) {
      completeWorkflowRun(run.runId);
    }

    return runnableSteps.length;

  } finally {
    // ALWAYS RELEASE LOCK
    run.isTicking = false;
  }
}
