import { tick } from '../services/engine.service.js';
import { getAllWorkflowRuns } from '../repositories/workflowRun.repository.js';

const TICK_INTERVAL_MS = 2000;

export function startEngineWorker() {
  console.log('Engine worker started');

  setInterval(async () => {
    try {
      const runs = await getAllWorkflowRuns();

      // Run in parallel
      await Promise.all(
        runs
          .filter(r => r.status === 'PENDING' || r.status === 'RUNNING')
          .map(r => tick(r.runId))
      );

    } catch (err) {
      console.error('Engine worker error:', err.message);
    }
  }, TICK_INTERVAL_MS);
}
