import { getStepRunsByRunId } from '../repositories/stepRun.repository.js';
import { getAllWorkflows } from '../repositories/workflow.repository.js';

 // Finding steps that are ready to execute
export async function getRunnableSteps(runId, workflowId) {
  const stepRuns = await getStepRunsByRunId(runId);
  const workflows = await getAllWorkflows();
  const workflow = workflows.find(wf => wf.id === workflowId);

  if (!workflow) {
    console.log("workflowId:", workflowId);
    console.log("workflows:", workflows);
    throw new Error('Workflow not found');
  }

  const steps = workflow.steps;

  const completedSteps = new Set(
    stepRuns
      .filter(sr => sr.status === 'COMPLETED')
      .map(sr => sr.step_id)
  );

  return stepRuns.filter(stepRun => {
    if (stepRun.status !== 'PENDING') return false;

    const stepDef = steps.find(
      step => step.id === stepRun.step_id
    );

    if(!stepDef) return false;

    const deps = stepDef.depends_on || [];

    return deps.every(dep => completedSteps.has(dep));
  });
}
