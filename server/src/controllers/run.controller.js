import { getRunnableSteps } from '../services/scheduler.service.js';
import { getAllWorkflowRuns } from '../repositories/workflowRun.repository.js';
import { getStepRunsByRunId } from '../repositories/stepRun.repository.js';

export async function getRunnableStepsHandler(req, res) {
  try {
    const { runId } = req.params;

    //  Find workflow run
    const runs = await getAllWorkflowRuns();
    const run = runs.find(r => r.runId === runId);

    if (!run) {
      return res.status(404).json({
        error: 'Workflow run not found'
      });
    }

    //  Get runnable steps
    const runnableSteps = await getRunnableSteps(
      run.runId,
      run.workflowId
    );

    res.json({
      runId,
      runnableSteps
    });

  } catch (err) {
    res.status(400).json({
      error: err.message
    });
  }
};

export async function getRunStatus(req, res) {
  try {
    const { runId } = req.params;

    const runs = await getAllWorkflowRuns();
    const run = runs.find(r => r.runId === runId);

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const stepRuns = await getStepRunsByRunId(runId);

    res.json({
      run,
      stepRuns
    });
  } catch (err) {
    res.status(400).json({
      error: err.message
    });
  }
}
