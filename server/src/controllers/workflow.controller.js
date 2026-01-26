import { saveWorkflow, getAllWorkflows } from '../repositories/workflow.repository.js';
import { randomUUID } from 'crypto';
import { validateWorkflow } from '../validators/workflow.validator.js';
import { createWorkflowRun } from '../repositories/workflowRun.repository.js';
import { createStepRun } from '../repositories/stepRun.repository.js';

export async function createWorkflow(req, res) {
  try {
    const workflow = req.body;

    // workflow validation
    validateWorkflow(workflow);

    const workflowWithId = {
      id: randomUUID(),
      ...workflow,
      createdAt: new Date().toISOString()
    };

    await saveWorkflow(workflowWithId);

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


export async function listWorkflows(req, res) {
  const workflows = await getAllWorkflows();
  res.json({ workflows });
}

export async function runWorkflow(req, res) {
  try {
    const { id } = req.params;

    const workflows = await getAllWorkflows();
    const workflow = workflows.find(wf => wf.id === id);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Create run object
    const run = {
      runId: randomUUID(),
      workflowId: id,
      status: 'PENDING',
      startedAt: new Date().toISOString(),
      finishedAt: null
    };

    // Save run in DB
    await createWorkflowRun(run);

    // Create step runs (still memory for now)
    const stepRuns = await Promise.all(
      workflow.steps.map(step =>
        createStepRun(run.runId, step)
      )
    );


    res.status(201).json({
      message: 'Workflow run created',
      run,
      stepRuns
    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

