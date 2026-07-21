/**
 * permissionService v1.0.0 — RBAC cliente (espelha backend)
 * VERSION: v1.0.0 | DATE: 2026-07-17
 */
import api from '../../api/client';

const STORAGE_KEY = 'velodesk_permissions';

export const CANAL_ORIGEM_BY_FUNCAO = {
  'reclame-aqui': ['reclame aqui', 'reclame-aqui'],
  bacen: ['bacen', 'banco central'],
  procon: ['procon'],
  'consumidor-gov': ['consumidor.gov', 'consumidor .gov', 'consumidor-gov', 'consumidor gov'],
};

let cachedPermissions = null;

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function readCachedPermissions() {
  if (cachedPermissions) return cachedPermissions;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cachedPermissions = raw ? JSON.parse(raw) : null;
  } catch {
    cachedPermissions = null;
  }
  return cachedPermissions;
}

export function writeCachedPermissions(payload) {
  cachedPermissions = payload;
  if (payload) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function clearCachedPermissions() {
  cachedPermissions = null;
  localStorage.removeItem(STORAGE_KEY);
}

export async function fetchMyPermissions() {
  const { data } = await api.get('/permissions/me');
  writeCachedPermissions(data);
  return data;
}

export function hasPermission(permissoes, modulo, key) {
  return permissoes?.[modulo]?.[key] === true;
}

export function can(modulo, key, permissoes = readCachedPermissions()?.permissoes) {
  return hasPermission(permissoes, modulo, key);
}

export function getPortalVisivel(perm = readCachedPermissions()) {
  return perm?.portalVisivel || ['agent'];
}

export function isPortalAllowed(portalId, perm = readCachedPermissions()) {
  const allowed = getPortalVisivel(perm);
  const legacyMap = { agent: 'agent', gestao: 'gestao', workflow: 'workflow', especiais: 'especiais' };
  const normalized = legacyMap[portalId] || portalId;
  return allowed.includes(normalized);
}

export function shouldUseMeusChamadosFila(perm = readCachedPermissions()) {
  if (!perm) return true;
  if (hasPermission(perm.permissoes, 'tickets', 'ver_todos')) return false;
  if (perm.funcaoSlug === 'financeiro' || perm.funcaoSlug === 'produtos') return false;
  return hasPermission(perm.permissoes, 'tickets', 'ver_meus');
}

function normalizeAtribuido(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('grupo:')) {
    const map = { n1: 'atendimento', n2: 'n2', financeiro: 'financeiro', produtos: 'produtos', suporte: 'suporte' };
    const slug = raw.slice(6).toLowerCase();
    return `funcao:${map[slug] || slug}`;
  }
  return raw;
}

function buildResponsavelCandidatesFromSession() {
  try {
    const user = JSON.parse(localStorage.getItem('velodesk_user') || '{}');
    const colaborador = JSON.parse(localStorage.getItem('velodesk_colaborador') || 'null');
    const values = [];
    const push = (v) => {
      const n = normalizeText(v);
      if (n) values.push(n);
    };
    push(user.name);
    push(user.email);
    push(colaborador?.colaboradorNome);
    push(colaborador?.nome);
    push(colaborador?.email);
    return [...new Set(values)];
  } catch {
    return [];
  }
}

function ticketCanalMatches(ticket, funcaoSlug) {
  const lf = ticket?.lateralForm || {};
  const text = [
    lf.tipoChamado,
    lf.classificacaoTipo,
    lf.canal,
    lf.produto,
    lf.motivo,
    ticket?.channel,
    ticket?.source,
  ].map(normalizeText).join(' ');
  const patterns = CANAL_ORIGEM_BY_FUNCAO[funcaoSlug] || [funcaoSlug];
  return patterns.some((p) => text.includes(normalizeText(p)));
}

export function canActOnTicket(ticket, perm = readCachedPermissions()) {
  if (!perm) return false;
  const { permissoes, funcaoSlug, funcoes = [] } = perm;

  if (hasPermission(permissoes, 'tickets', 'ver_todos')) return true;

  if (funcaoSlug === 'financeiro' || funcoes.includes('financeiro')) {
    const atribuido = normalizeAtribuido(ticket?.lateralForm?.atribuido);
    return atribuido === 'funcao:financeiro';
  }

  if (funcaoSlug === 'produtos' || funcoes.includes('produtos')) {
    const atribuido = normalizeAtribuido(ticket?.lateralForm?.atribuido);
    return atribuido === 'funcao:produtos';
  }

  for (const cf of funcoes) {
    if (CANAL_ORIGEM_BY_FUNCAO[cf] && hasPermission(permissoes, 'tickets', 'atuar_canal_especial')) {
      if (ticketCanalMatches(ticket, cf)) return true;
    }
  }

  const responsavel = normalizeText(ticket?.lateralForm?.responsavel || ticket?.responsibleAgent);
  const candidates = buildResponsavelCandidatesFromSession();
  const status = normalizeText(ticket?.status || '');

  if (!responsavel && status === 'novo') {
    return hasPermission(permissoes, 'tickets', 'atuar_responsavel');
  }

  if (candidates.includes(responsavel) && hasPermission(permissoes, 'tickets', 'atuar_responsavel')) {
    return true;
  }

  const wf = ticket?.workflow || ticket?.lateralForm?.workflow;
  if ((wf?.active || ticket?.lateralForm?.workflowActive) && hasPermission(permissoes, 'tickets', 'atuar_atribuido')) {
    const atribuido = normalizeAtribuido(ticket?.lateralForm?.atribuido);
    for (const f of funcoes) {
      if (atribuido === `funcao:${f}`) return true;
    }
  }

  return false;
}

export function canApproveWorkflow(perm = readCachedPermissions()) {
  return can('workflow', 'aprovar', perm?.permissoes);
}

export function agentCanDecideTicket(ticket, perm = readCachedPermissions()) {
  if (!canApproveWorkflow(perm) && ticket?.workflow?.pendingDecision) {
    /* aprovação exige permissão explícita */
  }
  const atribuido = normalizeAtribuido(ticket?.lateralForm?.atribuido);
  if (!atribuido) return canActOnTicket(ticket, perm);

  if (atribuido.startsWith('funcao:')) {
    const slug = atribuido.slice(7);
    return (perm?.funcoes || []).includes(slug) || perm?.funcaoSlug === slug;
  }

  const agent = normalizeText(perm?.colaboradorNome);
  return agent && (normalizeText(atribuido) === agent || atribuido.toLowerCase().includes(agent));
}

export function ticketMatchesAgentResponsavel(ticket, perm = readCachedPermissions()) {
  if (!shouldUseMeusChamadosFila(perm)) return true;

  const responsavel = normalizeText(ticket?.lateralForm?.responsavel || ticket?.responsibleAgent);
  const status = normalizeText(ticket?.status || '');

  if (!responsavel && status === 'novo') return true;
  if (!responsavel) return false;

  const candidates = buildResponsavelCandidatesFromSession();
  return candidates.includes(responsavel);
}

export function filterTicketForUser(ticket, perm = readCachedPermissions()) {
  if (hasPermission(perm?.permissoes, 'tickets', 'ver_todos')) return true;
  if (canActOnTicket(ticket, perm)) return true;
  return ticketMatchesAgentResponsavel(ticket, perm);
}

const WORKFLOW_TEAM_QUEUE_SLUGS = ['financeiro', 'produtos'];

export function resolveWorkflowTeamQueueForUser(perm = readCachedPermissions()) {
  if (!perm) return null;
  if (WORKFLOW_TEAM_QUEUE_SLUGS.includes(perm.funcaoSlug)) return perm.funcaoSlug;
  for (const funcao of perm.funcoes || []) {
    if (WORKFLOW_TEAM_QUEUE_SLUGS.includes(funcao)) return funcao;
  }
  return null;
}
