import { tick } from '../services/engine.service.js';
import { getAllWorkflowRuns } from '../store/workflowRun.store.js';

const TICK_INTERVAL_MS = 2000;

export function startEngineWorker() {
  console.log('Engine worker started');

  setInterval(async () => {
    try {
      const runs = getAllWorkflowRuns();

      for (const run of runs) {
        if (run.status === 'PENDING') {
          await tick(run.runId);
        }
      }

    } catch (err) {
      console.error('Engine worker error:', err.message);
    }
  }, TICK_INTERVAL_MS);
}
