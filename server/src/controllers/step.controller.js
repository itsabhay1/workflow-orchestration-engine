import { completeStepRun } from '../store/stepRun.store.js';

export function completeStep(req, res) {
  try {
    const { runId, stepId } = req.params;

    const stepRun = completeStepRun(runId, stepId);

    res.json({
      message: 'Step completed',
      stepRun
    });

  } catch (err) {
    res.status(400).json({
      error: err.message
    });
  }
}