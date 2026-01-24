import { pool } from '../db.js';
import crypto from 'crypto';

export async function createStepRun(runId, stepId) {
  const stepRunId = crypto.randomUUID();

  await pool.query(`
    INSERT INTO step_runs
    (step_run_id, run_id, step_id, status, attempts)
    VALUES ($1, $2, $3, 'PENDING', 0)
  `, [stepRunId, runId, stepId]);

  return {
    step_run_id: stepRunId,
    run_id: runId,
    step_id: stepId,
    status: 'PENDING',
    attempts: 0
  };
}

export async function getStepRunsByRunId(runId) {
  const { rows } = await pool.query(
    `SELECT * FROM step_runs WHERE run_id=$1`,
    [runId]
  );
  return rows;
}

export async function updateStepRunStatus(stepRunId, status, error = null) {
  if (status === 'RUNNING') {
    await pool.query(`
      UPDATE step_runs
      SET status=$1,
          started_at=$2,
          attempts = attempts + 1
      WHERE step_run_id=$3
    `, [status, new Date().toISOString(), stepRunId]);

  } else {
    await pool.query(`
      UPDATE step_runs
      SET status=$1,
          error=$2,
          finished_at=$3
      WHERE step_run_id=$4
    `, [status, error, new Date().toISOString(), stepRunId]);
  }
}

