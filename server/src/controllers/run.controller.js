import { getRunnableSteps } from '../services/scheduler.service.js';
import { getAllWorkflowRuns } from '../store/workflowRun.store.js';

export function getRunnableStepsHandler(req, res) {
  try {
    const { runId } = req.params;

    //  Find workflow run
    const runs = getAllWorkflowRuns();
    const run = runs.find(r => r.runId === runId);

    if (!run) {
      return res.status(404).json({
        error: 'Workflow run not found'
      });
    }

    //  Get runnable steps
    const runnableSteps = getRunnableSteps(
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
}
