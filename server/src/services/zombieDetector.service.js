import { pool } from '../db.js';

const ZOMBIE_THRESHOLD_SEC = 180; // 3 minutes

export async function detectZombieRuns() {
  console.log('Checking for zombie workflow runs...');

  const { rows } = await pool.query(`
    SELECT run_id
    FROM workflow_runs
    WHERE status='RUNNING'
      AND (NOW() - last_heartbeat) > INTERVAL '${ZOMBIE_THRESHOLD_SEC} seconds'
  `);

  for (const run of rows) {
    console.log(`🧟 Zombie run detected: ${run.run_id}`);

    // Revive run
    await pool.query(
      `UPDATE workflow_runs
       SET status='PENDING'
       WHERE run_id=$1`,
      [run.run_id]
    );

    // Revive steps of that run
    await pool.query(
      `UPDATE step_runs
     SET status='PENDING',
         started_at=NULL,
         error='Recovered from zombie run'
     WHERE run_id=$1 AND status='RUNNING'`,
      [run.run_id]
    );
  }
}