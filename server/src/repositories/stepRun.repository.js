import { pool } from '../db.js';
import crypto from 'crypto';

export async function createStepRun(runId, stepOrId) {
  const stepRunId = crypto.randomUUID();

  const isObject = typeof stepOrId === 'object';

  const stepId = isObject ? stepOrId.id : stepOrId;
  const timeout = isObject ? stepOrId.timeout : null;
  const maxRetries = isObject ? stepOrId.retry : null;

  await pool.query(`
    INSERT INTO step_runs
    (step_run_id, run_id, step_id, status, attempts, timeout, max_retries)
    VALUES ($1, $2, $3, 'PENDING', 0, $4, $5)
  `, [stepRunId, runId, stepId, timeout, maxRetries]);

  return {
    step_run_id: stepRunId,
    run_id: runId,
    step_id: stepId,
    status: 'PENDING',
    attempts: 0,
    timeout,
    max_retries: maxRetries
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
    throw new Error('DoaB violation: Use tryMarkStepRunning() to start execution');
  }

  await pool.query(`
    UPDATE step_runs
    SET status=$1,
        error=$2,
        finished_at=$3
    WHERE step_run_id=$4
  `, [status, error, new Date().toISOString(), stepRunId]);
}

export async function tryMarkStepRunning(stepRunId) {
  const { rowCount } = await pool.query(`
    UPDATE step_runs
    SET status='RUNNING',
        started_at=NOW(),
        attempts = attempts + 1
    WHERE step_run_id=$1 AND status='PENDING'
  `, [stepRunId]);

  return rowCount === 1; // true = lock acquired
}