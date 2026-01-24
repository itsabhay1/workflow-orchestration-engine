import { pool } from '../db.js';

export async function saveWorkflow(workflow) {
  await pool.query(
    `INSERT INTO workflows (id, name, steps, created_at)
     VALUES ($1, $2, $3, $4)`,
    [
      workflow.id,
      workflow.name,
      JSON.stringify(workflow.steps),
      workflow.createdAt
    ]
  );
}


export async function getAllWorkflows() {
  const { rows } = await pool.query(`SELECT * FROM workflows`);

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps,
    createdAt: r.created_at
  }));
}


export async function getWorkflowById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM workflows WHERE id=$1`,
    [id]
  );
  if (!rows[0]) return null;

  const r = rows[0];

  return {
    id: r.id,
    name: r.name,
    steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps,
    createdAt: r.created_at
  };
}

