import { saveWorkflow, getAllWorkflows } from '../store/workflow.store.js';
import { randomUUID } from 'crypto';
import { validateWorkflow } from '../validators/workflow.validator.js';
import { createWorkflowRun } from '../store/workflowRun.store.js';
import { createStepRun } from '../store/stepRun.store.js';

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

  //  Check if workflow exists
  const workflows = getAllWorkflows();
  const workflow = workflows.find(wf => wf.id === id);

  if (!workflow) {
    return res.status(404).json({
      error: 'Workflow not found'
    });
  }

  //  Create a workflow run
  const run = createWorkflowRun(id);

  // Create step runs (one per step)
  const stepRuns = workflow.steps.map(step =>
    createStepRun(run.runId, step.id)
  );

  //  Return run info
  res.status(201).json({
    message: 'Workflow run created',
    run,
    stepRuns
  });
}

