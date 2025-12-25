import { getStepRunsByRunId } from '../store/stepRun.store.js';
import { getAllWorkflows } from '../store/workflow.store.js';

 // Finding steps that are ready to execute
export function getRunnableSteps(runId, workflowId) {
  const stepRuns = getStepRunsByRunId(runId);
  const workflows = getAllWorkflows();
  const workflow = workflows.find(wf => wf.id === workflowId);

  if (!workflow) {
    throw new Error('Workflow not found');
  }

  const completedSteps = new Set(
    stepRuns
      .filter(sr => sr.status === 'COMPLETED')
      .map(sr => sr.stepId)
  );

  return stepRuns.filter(stepRun => {
    if (stepRun.status !== 'PENDING') return false;

    const stepDef = workflow.steps.find(
      step => step.id === stepRun.stepId
    );

    return stepDef.depends_on.every(dep =>
      completedSteps.has(dep)
    );
  });
}
