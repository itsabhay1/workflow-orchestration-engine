import { updateStepRunStatus } from '../repositories/stepRun.repository.js';

export async function completeStep(req, res) {
  try {
    const { stepRunId } = req.params;

    await updateStepRunStatus(
      stepRunId,
      'COMPLETED',
      new Date().toISOString(),
      null
    );

    res.json({
      message: 'Step marked as COMPLETED'
    });

  } catch (err) {
    res.status(400).json({
      error: err.message
    });
  }
}