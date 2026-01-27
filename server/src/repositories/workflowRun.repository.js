import { pool } from '../db.js';

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

export async function updateWorkflowRunStatus(runId, status, finishedAt=null) {
  await pool.query(
    `UPDATE workflow_runs SET status=$1, finished_at=$2 WHERE run_id=$3`,
    [status, finishedAt, runId]
  );
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


export async function completeWorkflowRun(runId) {
  await pool.query(
    `UPDATE workflow_runs
     SET status='COMPLETED', finished_at=$1
     WHERE run_id=$2`,
    [new Date().toISOString(), runId]
  );
}
