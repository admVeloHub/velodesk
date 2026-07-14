/**
 * workflowDefinitions v2.1.0 — reexporta workflowEngine (definições persistidas)
 * VERSION: v2.1.0 | DATE: 2026-07-14
 */
import {
  WORKFLOW_TEAM_LABELS,
  WORKFLOW_DECISION_ACTIONS,
  getWorkflowTemplateById,
  resolveWorkflowForTicket,
  buildEscalonarWorkflowTemplate,
  createWorkflowState,
  getWorkflowTeamLabel,
  advanceWorkflowStep,
  advanceWorkflowByDecision,
  evaluateWorkflowAutoAdvance,
  getWorkflowStepSubtitle,
  buildWorkflowAdvanceMessage,
  stepRequiresDecision,
  resolveApprovalHeader,
  ticketAwaitingDecision,
  applyAtribuidoForActiveStep,
  evaluateCriterios,
  evaluateGatilhoCriterios,
  normalizeWorkflowDef,
  resolveAtribuidoForStep,
} from './workflowEngine';

export {
  WORKFLOW_TEAM_LABELS,
  WORKFLOW_DECISION_ACTIONS,
  getWorkflowTemplateById,
  resolveWorkflowForTicket,
  buildEscalonarWorkflowTemplate,
  createWorkflowState,
  getWorkflowTeamLabel,
  advanceWorkflowStep,
  advanceWorkflowByDecision,
  evaluateWorkflowAutoAdvance,
  getWorkflowStepSubtitle,
  buildWorkflowAdvanceMessage,
  stepRequiresDecision,
  resolveApprovalHeader,
  ticketAwaitingDecision,
  applyAtribuidoForActiveStep,
  evaluateCriterios,
  evaluateGatilhoCriterios,
  normalizeWorkflowDef,
  resolveAtribuidoForStep,
};

/** @deprecated use getRuntimeWorkflows — mantido para compatibilidade */
export const WORKFLOW_TEMPLATES = [];

export function getDecisionStepsForTemplate(template) {
  if (!template?.steps) return [];
  return template.steps.filter(stepRequiresDecision);
}
