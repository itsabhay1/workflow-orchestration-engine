import { pool } from '../db.js';

export async function revertRunningStepsToPending(stepRunIds) {
  if (!stepRunIds.length) return;

  console.log('Reverting RUNNING steps back to PENDING...');

  await pool.query(`
    UPDATE step_runs
    SET status='PENDING',
        started_at=NULL,
        attempts = attempts - 1
    WHERE step_run_id = ANY($1)
  `, [stepRunIds]);
}