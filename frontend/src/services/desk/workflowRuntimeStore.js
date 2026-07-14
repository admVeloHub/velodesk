/**
 * workflowRuntimeStore v1.0.0 — cache runtime de definições persistidas
 * VERSION: v1.0.0 | DATE: 2026-07-14
 */
let workflows = [];
let grupos = [];

export function setWorkflowRuntimeConfig(next = {}) {
  workflows = next.workflows || [];
  grupos = next.grupos || [];
}

export function getRuntimeWorkflows() {
  return workflows;
}

export function getRuntimeGrupos() {
  return grupos;
}

export function clearWorkflowRuntimeConfig() {
  workflows = [];
  grupos = [];
}
