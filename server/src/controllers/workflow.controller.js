import { saveWorkflow, getAllWorkflows } from '../store/workflow.store.js';
import { randomUUID } from 'crypto';
import { validateWorkflow } from '../validators/workflow.validator.js';

export function createWorkflow(req, res) {
  try {
    const workflow = req.body;

    // workflow validation
    validateWorkflow(workflow);

    const workflowWithId = {
      id: randomUUID(),
      ...workflow,
      createdAt: new Date().toISOString()
    };

    saveWorkflow(workflowWithId);

    res.status(201).json({
      message: 'Workflow created',
      workflow: workflowWithId
    });

  } catch (err) {
    res.status(400).json({
      error: err.message
    });
  }
}


export function listWorkflows(req, res) {
  res.json({
    workflows: getAllWorkflows()
  });
}

export function runWorkflow(req, res) {
  const { id } = req.params;

  res.json({
    message: 'Workflow run requested',
    workflowId: id
  });
}
