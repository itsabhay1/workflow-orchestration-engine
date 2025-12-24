
export function validateWorkflow(workflow) {
  // 1️ : Workflow-level validation
  if (!workflow.name || typeof workflow.name !== 'string') {
    throw new Error('Workflow name is required and must be a string');
  }

  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    throw new Error('Workflow must contain at least one step');
  }

  // 2️ : Step-level validation
  const stepIds = new Set();

  for (const step of workflow.steps) {
    if (!step.id || typeof step.id !== 'string') {
      throw new Error('Each step must have a valid string id');
    }

    if (stepIds.has(step.id)) {
      throw new Error(`Duplicate step id found: ${step.id}`);
    }

    stepIds.add(step.id);

    if (!Array.isArray(step.depends_on)) {
      throw new Error(`Step ${step.id} must have a depends_on array`);
    }

    if (typeof step.retry !== 'number' || step.retry < 0) {
      throw new Error(`Step ${step.id} must have retry >= 0`);
    }

    if (typeof step.timeout !== 'number' || step.timeout <= 0) {
      throw new Error(`Step ${step.id} must have timeout > 0`);
    }
  }

  // 3️ : Dependency existence validation
  for (const step of workflow.steps) {
    for (const dep of step.depends_on) {
      if (!stepIds.has(dep)) {
        throw new Error(
          `Step ${step.id} depends on non-existent step ${dep}`
        );
      }
    }
  }

  // 4️ : Circular dependency detection (DFS)
  detectCycles(workflow.steps);

  return true;
}

// function of detect sycles
function detectCycles(steps) {
  const graph = new Map();

  for (const step of steps) {
    graph.set(step.id, step.depends_on);
  }

  const visited = new Set();
  const stack = new Set();

  function dfs(node) {
    if (stack.has(node)) {
      throw new Error(`Circular dependency detected at step ${node}`);
    }

    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);

    for (const neighbor of graph.get(node)) {
      dfs(neighbor);
    }

    stack.delete(node);
  }

  for (const step of steps) {
    dfs(step.id);
  }
}

