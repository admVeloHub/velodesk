/**
 * workflowTeamQueues v1.6.0 — match atribuido com normalizeFuncao + fallback tabulacao
 * VERSION: v1.6.0 | DATE: 2026-08-21
 */
import {
  getWorkflowProgress,
  getWorkflowTemplateForTicket,
  isTicketInWorkflow,
  isTicketWorkflowActive,
  isTicketWorkflowCancelled,
  isTicketWorkflowFinished,
} from '../desk/utils';
import { normalizeFuncao } from '../desk/atuacaoVision';
import { ticketAwaitingDecision } from '../desk/workflowDefinitions';
import { resolveWorkflowTeamQueueForUser } from '../permissions/permissionService';

export const WORKFLOW_TEAM_QUEUES = [
  { id: 'financeiro', name: 'Financeiro', dot: '#ea580c' },
  { id: 'produtos', name: 'Produtos', dot: '#1634FF' },
];

const WORKFLOW_TEAM_QUEUE_IDS = new Set(WORKFLOW_TEAM_QUEUES.map((q) => q.id));

const PRODUTOS_SOLICITACAO_CATEGORIAS = new Set([
  'erros-bugs',
  'solicitacoes',
  'liberacao-pix',
  'documentos',
]);

const FINANCEIRO_SOLICITACAO_CATEGORIAS = new Set([
  'estorno',
  'cobranca',
  'outros',
]);

function readSolicitacaoProdutos(ticket) {
  return ticket?.lateralForm?.solicitacaoProdutos
    || ticket?.workflow?.requisicao?.solicitacaoProdutos
    || null;
}

function readSolicitacaoFinanceiro(ticket) {
  return ticket?.lateralForm?.solicitacaoFinanceiro
    || ticket?.workflow?.requisicao?.solicitacaoFinanceiro
    || null;
}

function passosResumoMatchesTeam(ticket, team) {
  const passos = ticket?.lateralForm?.workflow?.passosResumo;
  if (!Array.isArray(passos) || !passos.length) return false;
  return passos.some((passo) => normalizeTeamSlug(passo.team) === team);
}

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

function normalizeTeamSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}

export function isWorkflowTeamQueueId(teamId) {
  return WORKFLOW_TEAM_QUEUE_IDS.has(teamId);
}

export function getWorkflowTeamQueueMeta(teamId) {
  return WORKFLOW_TEAM_QUEUES.find((q) => q.id === teamId) || null;
}

export function isWorkflowActive(ticket) {
  if (isTicketWorkflowCancelled(ticket) || isTicketWorkflowFinished(ticket)) return false;
  if (isTicketWorkflowActive(ticket)) return true;
  if (!isTicketInWorkflow(ticket)) return false;
  const progress = getWorkflowProgress(ticket);
  if (!progress) return true;
  return progress.workflow?.status !== 'completed' && progress.workflow?.status !== 'cancelled';
}

export function isWorkflowStatusOffApprovalConsole(ticket) {
  const status = ticket?.workflow?.workflowStatus
    || ticket?.lateralForm?.workflow?.workflowStatus;
  return status === 'finished' || status === 'cancel';
}

/**
 * Console de aprovação / filas de workflow: tira da lista de trabalho
 * tickets já resolvidos/cancelados/fechados ou com workflow concluído/cancelado.
 * Não usar para badge/steps do agente — use isTicketWorkflowFinished.
 */
export function isWorkflowTicketCompleted(ticket) {
  if (!ticket) return false;
  const workflow = ticket.workflow || ticket.lateralForm?.workflow || {};
  return Boolean(
    workflow?.workflowStatus === 'finished'
    || workflow?.workflowStatus === 'cancel'
    || workflow?.completedAt
    || workflow?.status === 'completed'
    || workflow?.status === 'cancelled'
    || ticket?.status === 'resolvido'
    || ticket?.status === 'cancelado'
    || ticket?.status === 'finalizado'
    || ticket?.status === 'fechado'
  );
}

function readTicketAtribuidoRaw(ticket) {
  const lateral = ticket?.lateralForm?.atribuido || ticket?.atribuido || '';
  if (String(lateral).trim()) return lateral;
  const tabs = ticket?.tabulacao || ticket?.lateralForm?.tabulacao;
  if (Array.isArray(tabs) && tabs.length) {
    const last = tabs[tabs.length - 1];
    return last?.atribuido || '';
  }
  return '';
}

/** Atribuído atual é a função da fila de workflow (ex.: funcao:financeiro). */
export function ticketAtribuidoMatchesWorkflowQueue(ticket, teamId) {
  const team = normalizeFuncao(normalizeTeamSlug(teamId));
  if (!team) return false;
  const atribuido = normalizeAtribuido(readTicketAtribuidoRaw(ticket));
  if (!atribuido.startsWith('funcao:')) return false;
  const slug = normalizeFuncao(atribuido.slice(7));
  return slug === team;
}

/** Ticket já encerrado pelo agente responsável (fora do fluxo de workflow). */
export function isTicketClosedByAgent(ticket) {
  const status = String(ticket?.status || '').trim().toLowerCase();
  return status === 'resolvido' || status === 'cancelado' || status === 'fechado';
}

export function ticketMatchesWorkflowTeam(ticket, teamId) {
  const team = normalizeTeamSlug(teamId);
  const isCompleted = isWorkflowTicketCompleted(ticket);
  if (!team || (!isWorkflowActive(ticket) && !isCompleted)) return false;

  const lf = ticket.lateralForm || {};
  const wf = lf.workflow || {};
  const persisted = ticket.workflow || {};
  const progress = getWorkflowProgress(ticket);
  const templateSlug = normalizeTeamSlug(
    wf.definicaoSlug || wf.templateId || '',
  );

  if (templateSlug === `escalonar-${team}`) return true;
  if (templateSlug === team) return true;
  if (templateSlug.endsWith(`-${team}`)) return true;

  // Se já sabemos o time da etapa ativa e ele é outro time, a categorização
  // histórica da solicitação não deve mais prender o ticket nesta fila —
  // caso contrário o ticket nunca some da lista após a decisão mudar de etapa/time.
  const activeStepTeam = normalizeTeamSlug(progress?.activeStep?.team);
  const historicalMatchAllowed = !activeStepTeam || activeStepTeam === team;

  if (historicalMatchAllowed && team === 'produtos') {
    const solicitacao = readSolicitacaoProdutos(ticket);
    if (solicitacao && PRODUTOS_SOLICITACAO_CATEGORIAS.has(solicitacao.categoria)) {
      return true;
    }
    const financeiroLegacy = readSolicitacaoFinanceiro(ticket);
    if (financeiroLegacy?.categoria === 'documentos') return true;
  }

  if (historicalMatchAllowed && team === 'financeiro') {
    const solicitacao = readSolicitacaoFinanceiro(ticket);
    if (solicitacao && FINANCEIRO_SOLICITACAO_CATEGORIAS.has(solicitacao.categoria)) {
      return true;
    }
  }

  if (passosResumoMatchesTeam(ticket, team)) return true;

  const atribuido = normalizeAtribuido(lf.atribuido);
  if (atribuido === `funcao:${team}`) return true;

  if (normalizeTeamSlug(progress?.activeStep?.team) === team) return true;

  const template = getWorkflowTemplateForTicket(ticket);
  const templateId = normalizeTeamSlug(template?.id);
  if (templateId === `escalonar-${team}` || templateId === team) return true;
  if (template?.steps?.some((step) => normalizeTeamSlug(step.team) === team)) return true;

  // Fallback: workflowId resolvido para template do time (quando configs já hidrataram)
  if (persisted.active && persisted.workflowId && templateId.includes(team)) return true;

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
  return normalizeTeamSlug(progress.activeStep.team) === normalizeTeamSlug(teamId);
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

const CLIENT360_WORKFLOW_ICON = {
  financeiro: {
    icon: 'ti-currency-dollar',
    title: 'Workflow Financeiro ativo',
    modifier: 'financeiro',
  },
  produtos: {
    icon: 'ti-device-desktop',
    title: 'Workflow Produtos ativo',
    modifier: 'produtos',
  },
};

export function getClient360WorkflowIconMeta(ticket) {
  if (isTicketWorkflowCancelled(ticket)) {
    const teamId = resolveWorkflowTeamForTicket(ticket);
    const base = CLIENT360_WORKFLOW_ICON[teamId] || {
      icon: 'ti-arrows-exchange',
      title: 'Workflow',
    };
    return {
      icon: base.icon,
      title: 'Workflow cancelado',
      modifier: 'cancel',
    };
  }
  if (isTicketWorkflowFinished(ticket)) {
    return {
      icon: 'ti-check',
      title: 'Workflow concluído',
      modifier: 'finished',
    };
  }
  if (!isWorkflowActive(ticket)) return null;
  const teamId = resolveWorkflowTeamForTicket(ticket);
  return CLIENT360_WORKFLOW_ICON[teamId] || {
    icon: 'ti-arrows-exchange',
    title: 'Workflow ativo',
    modifier: 'active',
  };
}

export function buildWorkflowNavigationUrl({ teamId, ticketId, view } = {}) {
  const params = new URLSearchParams();
  if (teamId) params.set('team', teamId);
  if (ticketId) params.set('ticket', String(ticketId));
  if (view) params.set('view', view);
  const qs = params.toString();
  return qs ? `/workflow?${qs}` : '/workflow';
}
