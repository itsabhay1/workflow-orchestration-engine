const workflows = new Map();

export function saveWorkflow(workflow) {
    workflows.set(workflow.id, workflow);
    return workflow;
}

export function getAllWorkflows() {
    return Array.from(workflows.values());
}