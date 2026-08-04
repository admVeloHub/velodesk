/**
 * workflowDefinitions v2.3.0 — reexporta buildTemplateFromPassosResumo
 * VERSION: v2.3.0 | DATE: 2026-08-04
 */
import {
  WORKFLOW_TEAM_LABELS,
  WORKFLOW_DECISION_ACTIONS,
  getWorkflowTemplateById,
  buildTemplateFromPassosResumo,
  resolveWorkflowForTicket,
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
  buildTemplateFromPassosResumo,
  resolveWorkflowForTicket,
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

export function getDecisionStepsForTemplate(template) {
  if (!template?.steps) return [];
  return template.steps.filter(stepRequiresDecision);
}

/** @deprecated use getRuntimeWorkflows — mantido para compatibilidade */
export const WORKFLOW_TEMPLATES = [];
