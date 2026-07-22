/**
 * workflowTeamQueues — filas Financeiro e Produtos (perfil Workflow)
 */
import {
  getWorkflowProgress,
  getWorkflowTemplateForTicket,
  isTicketInWorkflow,
} from '../desk/utils';
import { ticketAwaitingDecision } from '../desk/workflowDefinitions';
import { resolveWorkflowTeamQueueForUser } from '../permissions/permissionService';

export const WORKFLOW_TEAM_QUEUES = [
  { id: 'financeiro', name: 'Financeiro', dot: '#ea580c' },
  { id: 'produtos', name: 'Produtos', dot: '#1634FF' },
];

const WORKFLOW_TEAM_QUEUE_IDS = new Set(WORKFLOW_TEAM_QUEUES.map((q) => q.id));

function normalizeAtribuido(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('grupo:')) {
    const map = {
      n1: 'atendimento',
      n2: 'n2',
      financeiro: 'financeiro',
      produtos: 'produtos',
      suporte: 'suporte',
    };
    const slug = raw.slice(6).toLowerCase();
    return `funcao:${map[slug] || slug}`;
  }
  return raw;
}

export function isWorkflowTeamQueueId(teamId) {
  return WORKFLOW_TEAM_QUEUE_IDS.has(teamId);
}

export function getWorkflowTeamQueueMeta(teamId) {
  return WORKFLOW_TEAM_QUEUES.find((q) => q.id === teamId) || null;
}

export function isWorkflowActive(ticket) {
  if (!isTicketInWorkflow(ticket)) return false;
  const progress = getWorkflowProgress(ticket);
  if (!progress) return true;
  return progress.workflow?.status !== 'completed';
}

export function ticketMatchesWorkflowTeam(ticket, teamId) {
  if (!teamId || !isWorkflowActive(ticket)) return false;

  const lf = ticket.lateralForm || {};
  const wf = lf.workflow || {};
  const progress = getWorkflowProgress(ticket);
  const templateSlug = String(wf.definicaoSlug || wf.templateId || '');

  if (lf.escalonar === teamId) return true;
  if (templateSlug === `escalonar-${teamId}`) return true;
  if (templateSlug.endsWith(`-${teamId}`)) return true;

  const atribuido = normalizeAtribuido(lf.atribuido);
  if (atribuido === `funcao:${teamId}`) return true;

  if (progress?.activeStep?.team === teamId) return true;

  const template = getWorkflowTemplateForTicket(ticket);
  if (template?.id === `escalonar-${teamId}`) return true;
  if (template?.steps?.some((step) => step.team === teamId)) return true;

  return false;
}

export function ticketIsAwaitingTeamAction(ticket, teamId) {
  if (!ticketMatchesWorkflowTeam(ticket, teamId)) return false;
  const progress = getWorkflowProgress(ticket);
  if (!progress) return false;
  const awaitingDecision = ticketAwaitingDecision(ticket, progress);
  return awaitingDecision || isTeamStepActive(ticket, teamId, progress);
}

export function isTeamStepActive(ticket, teamId, progress = getWorkflowProgress(ticket)) {
  if (!progress?.activeStep) return false;
  return progress.activeStep.team === teamId;
}

export function resolveEffectiveWorkflowTeamId({ perm, urlTeam } = {}) {
  const rbacTeam = resolveWorkflowTeamQueueForUser(perm);
  if (rbacTeam) return rbacTeam;
  const normalized = String(urlTeam || '').trim();
  if (isWorkflowTeamQueueId(normalized)) return normalized;
  return null;
}

export function resolveWorkflowTeamForTicket(ticket) {
  if (!ticket) return null;

  for (const { id } of WORKFLOW_TEAM_QUEUES) {
    if (!ticketMatchesWorkflowTeam(ticket, id)) continue;
    const progress = getWorkflowProgress(ticket);
    const awaitingDecision = ticketAwaitingDecision(ticket, progress);
    if (awaitingDecision || isTeamStepActive(ticket, id, progress)) return id;
  }

  for (const { id } of WORKFLOW_TEAM_QUEUES) {
    if (ticketMatchesWorkflowTeam(ticket, id)) return id;
  }

  return null;
}

export function buildWorkflowNavigationUrl({ teamId, ticketId } = {}) {
  const params = new URLSearchParams();
  if (teamId) params.set('team', teamId);
  if (ticketId) params.set('ticket', String(ticketId));
  const qs = params.toString();
  return qs ? `/workflow?${qs}` : '/workflow';
}
