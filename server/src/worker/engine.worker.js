import { tick } from '../services/engine.service.js';
import { getAllWorkflowRuns } from '../repositories/workflowRun.repository.js';
import { detectZombieRuns } from '../services/zombieDetector.service.js';

const TICK_INTERVAL_MS = 2000;

export function startEngineWorker() {
  console.log('Engine worker started');

  runEngineLoop();
}

async function runEngineLoop() {
  while (true) {
    try {
      await detectZombieRuns();    // detect zombies

      const runs = await getAllWorkflowRuns();

      // Run in parallel within a single scheduler tick.
      await Promise.all(
        runs
          .filter(r => r.status === 'PENDING' || r.status === 'RUNNING')
          .map(r => tick(r.runId))
      );
    } catch (err) {
      console.error('Engine worker error:', err.message);
    }

    await sleep(TICK_INTERVAL_MS);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
