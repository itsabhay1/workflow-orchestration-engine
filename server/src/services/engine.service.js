import { getRunnableSteps } from './scheduler.service.js';
import { getStepRunsByRunId, updateStepRunStatus, tryMarkStepRunning, completeStepRun } from '../repositories/stepRun.repository.js';
import { getAllWorkflowRuns, completeWorkflowRun, updateWorkflowRunStatus, markRunAsRunning } from '../repositories/workflowRun.repository.js';
import { getAllWorkflows } from '../repositories/workflow.repository.js';
import { runContainer } from './dockerExecutor.service.js';
import { isShuttingDown } from '../utils/shutdown.utils.js';
import { pool } from '../db.js';


export async function tick(runId) {

  if (isShuttingDown()) {
    console.log('⚠ Engine paused due to shutdown');
    return 0;
  }

  const runs = await getAllWorkflowRuns();
  const run = runs.find(r => r.runId === runId);

  if (!run) throw new Error('Workflow run not found');

  await pool.query(       // Heartbeat - engine 
    `UPDATE workflow_runs 
   SET last_heartbeat = NOW() 
   WHERE run_id = $1`,
    [runId]
  );

  const workflows = await getAllWorkflows();
  const workflow = workflows.find(wf => wf.id === run.workflowId);
  if (!workflow) throw new Error('Workflow definition not found');

  const runnableSteps = await getRunnableSteps(run.runId, run.workflowId);

  for (const stepRun of runnableSteps) {
    const stepDef = workflow.steps.find(s => s.id === stepRun.step_id);
    if (!stepDef) continue;

    // atomic Lock
    const locked = await tryMarkStepRunning(stepRun.step_run_id);

    if (!locked) {
      console.log(`⏭ Step ${stepRun.step_id} already taken by another engine`);
      continue;
    }
    
    await markRunAsRunning(run.runId);

    console.log(`Executing step ${stepRun.step_id}`);

    try {
      const result = await runContainer({
        stepRunId: stepRun.step_run_id,
        image: stepDef.image,
        command: stepDef.command,
        timeout: stepDef.timeout
      });

      // success
      await completeStepRun(stepRun.step_run_id, 'COMPLETED', result.logs, result.exitCode);

    } catch (err) {

      // interrupted by shutdown
      if (err.interrupted) {
        console.log(`Step ${stepRun.step_id} interrupted due to shutdown`);
        await updateStepRunStatus(stepRun.step_run_id, 'PENDING', 'Interrupted by shutdown');
        continue;
      }

      // get fresh attempts count
      const stepRuns = await getStepRunsByRunId(run.runId);
      const current = stepRuns.find(sr => sr.step_run_id === stepRun.step_run_id);

      if (current.attempts < stepDef.retry) {
        // retry allowed → go back to queue
        await updateStepRunStatus(stepRun.step_run_id, 'PENDING', err.message);
      } else {
        // no retries left
        await completeStepRun(
          stepRun.step_run_id,
          'FAILED',
          err.logs || '',
          err.exitCode || 1,
          err.message
        );
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
