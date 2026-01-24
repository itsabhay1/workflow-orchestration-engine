import { getRunnableSteps } from './scheduler.service.js';
import { getStepRunsByRunId, updateStepRunStatus } from '../repositories/stepRun.repository.js';
import { getAllWorkflowRuns, completeWorkflowRun, updateWorkflowRunStatus } from '../repositories/workflowRun.repository.js';
import { getAllWorkflows } from '../repositories/workflow.repository.js';
import { runContainer } from './dockerExecutor.service.js';

export async function tick(runId) {
  const runs = await getAllWorkflowRuns();
  const run = runs.find(r => r.runId === runId);

  if (!run) throw new Error('Workflow run not found');

  const workflows = await getAllWorkflows();
  const workflow = workflows.find(wf => wf.id === run.workflowId);
  if (!workflow) throw new Error('Workflow definition not found');

  const runnableSteps = await getRunnableSteps(run.runId, run.workflowId);

  for (const stepRun of runnableSteps) {
    const stepDef = workflow.steps.find(s => s.id === stepRun.step_id);
    if (!stepDef) continue;

    await updateStepRunStatus(stepRun.step_run_id, 'RUNNING');

    try {
      await runContainer({
        image: stepDef.image,
        command: stepDef.command,
        timeout: stepDef.timeout
      });

      // success
      await updateStepRunStatus(stepRun.step_run_id, 'COMPLETED');

    } catch (err) {
      // get fresh attempts count
      const stepRuns = await getStepRunsByRunId(run.runId);
      const current = stepRuns.find(sr => sr.step_run_id === stepRun.step_run_id);

      if (current.attempts < stepDef.retry) {
        // retry allowed → go back to queue
        await updateStepRunStatus(stepRun.step_run_id, 'PENDING', err.message);
      } else {
        // no retries left
        await updateStepRunStatus(stepRun.step_run_id, 'FAILED', err.message);
      }
    }
  }

  // check overall workflow state
  const stepRuns = await getStepRunsByRunId(run.runId);

  if (stepRuns.some(sr => sr.status === 'FAILED')) {
    await updateWorkflowRunStatus(run.runId, 'FAILED', new Date().toISOString());
    return runnableSteps.length;
  }

  if (stepRuns.every(sr => sr.status === 'COMPLETED')) {
    await completeWorkflowRun(run.runId);
  }

  return runnableSteps.length;
}
