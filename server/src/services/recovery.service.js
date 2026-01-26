import { pool } from '../db.js';

const MAX_RUNTIME_BUFFER = 30; // seconds

export async function recoverStuckSteps() {
  console.log("Running crash recovery...");

  const { rows: stepRuns } = await pool.query(`
    SELECT step_run_id, run_id, step_id, started_at, attempts, timeout, max_retries
    FROM step_runs
    WHERE status = 'RUNNING'
  `);

  for (const sr of stepRuns) {
    if (!sr.started_at || !sr.timeout) continue;

    const runtime =
      (Date.now() - new Date(sr.started_at).getTime()) / 1000;

    if (runtime > sr.timeout + MAX_RUNTIME_BUFFER) {
      console.log(`⚠ Recovering stuck step ${sr.step_run_id}`);

      if (sr.attempts < sr.max_retries) {
        await pool.query(
          `UPDATE step_runs
           SET status='PENDING',
               started_at=NULL
           WHERE step_run_id=$1`,
          [sr.step_run_id]
        );
      } else {
        await pool.query(
          `UPDATE step_runs
           SET status='FAILED',
               error='Step exceeded timeout during crash recovery',
               finished_at=NOW()
           WHERE step_run_id=$1`,
          [sr.step_run_id]
        );
      }
    }
  }
}
