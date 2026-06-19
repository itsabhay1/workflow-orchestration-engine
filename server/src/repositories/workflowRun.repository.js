import { pool } from '../db.js';

const LEASE_DURATION_SEC = 30;

export async function createWorkflowRun(run, requestId = null) {
  // If idempotency key is provided, check first
  if(requestId) {
    const { rows } = await pool.query(
      `SELECT * FROM workflow_runs WHERE request_id=$1`,
      [requestId]
    );
    if (rows.length > 0) {
      const r = rows[0];
      return {
        runId: r.run_id,
        workflowId: r.workflow_id,
        status: r.status,
        startedAt: r.started_at,
        finishedAt: r.finished_at
      };
    }
  }
  await pool.query(`
    INSERT INTO workflow_runs (run_id, workflow_id, status, started_at, finished_at, request_id)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    run.runId,
    run.workflowId,
    run.status,
    run.startedAt,
    run.finishedAt,
    requestId
  ]);
  
  return run;
}

export async function getWorkflowRunById(runId) {
  const { rows } = await pool.query(
    `SELECT * FROM workflow_runs WHERE run_id=$1`,
    [runId]
  );

  if (!rows[0]) return null;

  const r = rows[0];

  return {
    runId: r.run_id,
    workflowId: r.workflow_id,
    status: r.status,
    startedAt: r.started_at,
    finishedAt: r.finished_at
  };
}

export async function updateWorkflowRunStatus(runId, status, finishedAt=null, workerId = null) {
  const isTerminal = status === 'COMPLETED' || status === 'FAILED';

  const params = [status, finishedAt, runId, isTerminal];
  let query = `
    UPDATE workflow_runs
    SET status=$1,
        finished_at=$2,
        lease_owner = CASE WHEN $4 THEN NULL ELSE lease_owner END,
        lease_expires_at = CASE WHEN $4 THEN NULL ELSE lease_expires_at END
    WHERE run_id=$3
  `;

  if (workerId) {
    params.push(workerId);
    query += ` AND lease_owner = $5`;
  }

  const { rowCount } = await pool.query(query, params);
  return rowCount === 1;
}

export async function getAllWorkflowRuns() {
  const { rows } = await pool.query(`SELECT * FROM workflow_runs`);

  return rows.map(r => ({
    runId: r.run_id,
    workflowId: r.workflow_id,
    status: r.status,
    startedAt: r.started_at,
    finishedAt: r.finished_at
  }));
}


export async function completeWorkflowRun(runId, workerId = null) {
  const params = [new Date().toISOString(), runId];
  let query = `
    UPDATE workflow_runs
    SET status='COMPLETED',
        finished_at=$1,
        lease_owner=NULL,
        lease_expires_at=NULL
    WHERE run_id=$2
  `;

  if (workerId) {
    params.push(workerId);
    query += ` AND lease_owner = $3`;
  }

  const { rowCount } = await pool.query(query, params);
  return rowCount === 1;
}

export async function markRunAsRunning(runId) {
  await pool.query(`
    UPDATE workflow_runs
    SET status = 'RUNNING',
        started_at = COALESCE(started_at, NOW())
    WHERE run_id = $1 AND status = 'PENDING'
  `, [runId]);
}

export async function tryAcquireRunLease(runId, workerId) {
  const { rowCount } = await pool.query(`
    UPDATE workflow_runs
    SET lease_owner = $2,
        lease_expires_at = NOW() + INTERVAL '${LEASE_DURATION_SEC} seconds',
        last_heartbeat = NOW()
    WHERE run_id = $1
      AND status IN ('PENDING', 'RUNNING')
      AND (
        lease_owner IS NULL
        OR lease_expires_at IS NULL
        OR lease_expires_at <= NOW()
        OR lease_owner = $2
      )
  `, [runId, workerId]);

  return rowCount === 1;
}

export async function renewRunLease(runId, workerId) {
  const { rowCount } = await pool.query(`
    UPDATE workflow_runs
    SET lease_expires_at = NOW() + INTERVAL '${LEASE_DURATION_SEC} seconds',
        last_heartbeat = NOW()
    WHERE run_id = $1
      AND lease_owner = $2
      AND status IN ('PENDING', 'RUNNING')
  `, [runId, workerId]);

  return rowCount === 1;
}

export async function releaseRunLease(runId, workerId) {
  await pool.query(`
    UPDATE workflow_runs
    SET lease_owner = NULL,
        lease_expires_at = NULL
    WHERE run_id = $1
      AND lease_owner = $2
  `, [runId, workerId]);
}
