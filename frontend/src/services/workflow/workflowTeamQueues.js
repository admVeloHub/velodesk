/**
 * workflowTeamQueues — filas Financeiro e Produtos (perfil Workflow)
 */
import {
  getWorkflowProgress,
  getWorkflowTemplateForTicket,
  isTicketInWorkflow,
} from '../desk/utils';

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

  if (lf.escalonar === teamId) return true;
  if (wf.definicaoSlug === `escalonar-${teamId}`) return true;
  if (wf.templateId === `escalonar-${teamId}`) return true;

  const atribuido = normalizeAtribuido(lf.atribuido);
  if (atribuido === `funcao:${teamId}`) return true;

  const template = getWorkflowTemplateForTicket(ticket);
  if (template?.steps?.some((step) => step.team === teamId)) return true;

  return false;
}

export function isTeamStepActive(ticket, teamId, progress = getWorkflowProgress(ticket)) {
  if (!progress?.activeStep) return false;
  return progress.activeStep.team === teamId;
}
