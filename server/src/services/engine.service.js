import { getRunnableSteps } from './scheduler.service.js';
import { getStepRunsByRunId, updateStepRunStatus, tryMarkStepRunning, completeStepRun } from '../repositories/stepRun.repository.js';
import { getAllWorkflowRuns, completeWorkflowRun, updateWorkflowRunStatus, markRunAsRunning, renewRunLease, releaseRunLease } from '../repositories/workflowRun.repository.js';
import { getAllWorkflows } from '../repositories/workflow.repository.js';
import { isShuttingDown } from '../utils/shutdown.utils.js';

const LEASE_RENEWAL_INTERVAL_MS = 10000;

/* MCP call */
async function callMCPExecute(payload) {
  const res = await fetch('http://localhost:4000/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function tick(runId, workerId) {
  const leaseKeeper = startLeaseKeeper(runId, workerId);

  if (isShuttingDown()) {
    leaseKeeper.stop();
    console.log('⚠ Engine paused due to shutdown');
    return 0;
  }

  try {
    const runs = await getAllWorkflowRuns();
    const run = runs.find(r => r.runId === runId);

    if (!run) throw new Error('Workflow run not found');

    const leaseRenewed = await ensureLease(runId, workerId);
    if (!leaseRenewed) {
      console.log(`Lease lost for run ${runId}, skipping tick`);
      return 0;
    }

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
        const result = await callMCPExecute({
          stepRunId: stepRun.step_run_id,
          image: stepDef.image,
          command: stepDef.command,
          timeout: stepDef.timeout,
          resources: stepDef.resources,
          tenantId: run.workflowId
        });

        const stillOwnLease = await ensureLease(runId, workerId);
        if (!stillOwnLease) {
          console.log(`Lease lost for run ${runId} after MCP execution`);
          return 0;
        }

        if (result.status === 'COMPLETED') {
          await completeStepRun(
            stepRun.step_run_id,
            'COMPLETED',
            result.logs,
            result.exitCode
          );
          continue;
        }

        // MCP failure handling
        if (result.oom) {
          await completeStepRun(
            stepRun.step_run_id,
            'FAILED',
            result.logs || '',
            137,
            'Out of memory'
          );
          continue;
        }

        throw result;

      } catch (err) {
        const stillOwnLease = await ensureLease(runId, workerId);
        if (!stillOwnLease) {
          console.log(`Lease lost for run ${runId} during error handling`);
          return 0;
        }

        // interrupted by shutdown
        if (err.interrupted) {
          console.log(`Step ${stepRun.step_id} interrupted due to shutdown`);
          await updateStepRunStatus(stepRun.step_run_id, 'PENDING', 'Interrupted by shutdown');
          continue;
        }

        // OOM detect- docker memory limit hit
        if (err.oom) {
          await completeStepRun(
            stepRun.step_run_id,
            'FAILED',
            err.logs || '',
            137,
            'Out of memory'
          );
          continue;
        }

        // get fresh attempts count
        const stepRuns = await getStepRunsByRunId(run.runId);
        const current = stepRuns.find(sr => sr.step_run_id === stepRun.step_run_id);

        if (current.attempts <= stepDef.retry) {
          // retry is the number of retries after the first attempt.
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

    const stillOwnLease = await ensureLease(runId, workerId);
    if (!stillOwnLease) {
      console.log(`Lease lost for run ${runId} before workflow state update`);
      return 0;
    }

    // check overall workflow state
    const stepRuns = await getStepRunsByRunId(run.runId);

    if (stepRuns.some(sr => sr.status === 'FAILED')) {
      const failed = await updateWorkflowRunStatus(
        run.runId,
        'FAILED',
        new Date().toISOString(),
        workerId
      );
      if (!failed) {
        console.log(`Lease lost for run ${runId} before marking FAILED`);
        return 0;
      }

      await releaseRunLease(run.runId, workerId);
      return runnableSteps.length;
    }

    if (stepRuns.every(sr => sr.status === 'COMPLETED')) {
      const completed = await completeWorkflowRun(run.runId, workerId);
      if (!completed) {
        console.log(`Lease lost for run ${runId} before marking COMPLETED`);
        return 0;
      }

      await releaseRunLease(run.runId, workerId);
    }

    return runnableSteps.length;
  } finally {
    leaseKeeper.stop();
  }
}

function startLeaseKeeper(runId, workerId) {
  let stopped = false;

  const timer = setInterval(async () => {
    if (stopped) return;

    const renewed = await renewRunLease(runId, workerId);
    if (!renewed) {
      stopped = true;
      clearInterval(timer);
      console.log(`Lease keeper lost run ${runId}`);
    }
  }, LEASE_RENEWAL_INTERVAL_MS);

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    }
  };
}

async function ensureLease(runId, workerId) {
  return renewRunLease(runId, workerId);
}
