/**
 * Match de critérios de caixas personalizadas (AND)
 * VERSION: v1.0.1 | DATE: 2026-07-30
 */
import { getAgentName } from '../clientDb';

const TAB_FIELDS = new Set(['tipoChamado', 'tipo', 'produto', 'motivo', 'detalhe']);

function readTabField(ticket, campo) {
  const lf = ticket?.lateralForm || {};
  const key = String(campo || '').trim();
  if (key === 'tipoChamado' || key === 'tipo') {
    return String(lf.tipoChamado || lf.tipo || lf.classificacaoTipo || ticket?.tipoChamado || '').trim();
  }
  return String(lf[key] || ticket?.[key] || '').trim();
}

function normalizeStatus(ticket) {
  return String(ticket?.status || '').trim().toLowerCase().replace(/\s+/g, '-');
}

function statusMatches(ticketStatus, wanted) {
  const a = String(ticketStatus || '').toLowerCase();
  const b = String(wanted || '').toLowerCase();
  if (!b) return true;
  if (a === b) return true;
  if (b === 'em-andamento' && (a === 'em-aberto' || a === 'em andamento' || a === 'em-andamento')) return true;
  if (b === 'pendente' && (a === 'em-espera' || a === 'pendente')) return true;
  if (b === 'resolvidos' && (a === 'resolvido' || a === 'resolvidos')) return true;
  if (b === 'resolvido' && a === 'resolvidos') return true;
  return false;
}

function isWorkflowActive(ticket) {
  if (!ticket?.workflow?.active && !ticket?.workflow?.pendingPersist && !ticket?._pendingWorkflowStart?.definicaoSlug) {
    return false;
  }
  if (ticket?.workflow?.completedAt) return false;
  const wf = ticket?.lateralForm?.workflow;
  if (wf?.status === 'completed') return false;
  return true;
}

function slaTone(ticket) {
  if (ticket?.slaStatus === 'critical') return 'critical';
  if (ticket?.slaStatus === 'warning' || ticket?.slaStatus === 'attention') return 'warning';
  if (ticket?.slaRemaining != null) {
    if (ticket.slaRemaining <= 0) return 'critical';
    if (ticket.slaRemaining <= 30) return 'warning';
  }
  return ticket?.slaStatus || 'ok';
}

function matchTabulacao(ticket, criterio) {
  const campo = String(criterio.campo || '').trim();
  if (!TAB_FIELDS.has(campo) && campo !== 'tipoChamado') return false;
  const actual = readTabField(ticket, campo);
  const expected = String(criterio.valor || '').trim();
  const op = String(criterio.operador || 'equals').trim();
  if (op === 'contains') {
    return actual.toLowerCase().includes(expected.toLowerCase());
  }
  if (op === 'not_empty') return Boolean(actual);
  return actual.toLowerCase() === expected.toLowerCase();
}

function matchAtribuido(ticket, criterio) {
  const actual = String(ticket?.lateralForm?.atribuido || '').trim();
  const valor = String(criterio.valor || '').trim();
  if (valor === '__empty__') return !actual;
  if (valor === '__me__') {
    const me = String(getAgentName() || '').trim().toLowerCase();
    if (!me || !actual) return false;
    return actual.toLowerCase() === me || actual.toLowerCase().includes(me);
  }
  if (!valor) return Boolean(actual);
  return actual.toLowerCase() === valor.toLowerCase();
}

export function ticketMatchesQueueCriterio(ticket, criterio) {
  if (!criterio || !ticket) return false;
  const tipo = String(criterio.tipo || '').trim().toLowerCase();

  switch (tipo) {
    case 'tabulacao':
      return matchTabulacao(ticket, criterio);
    case 'status':
      return statusMatches(normalizeStatus(ticket), criterio.valor);
    case 'workflow': {
      const active = isWorkflowActive(ticket);
      const wanted = String(criterio.valor || '').trim().toLowerCase();
      if (wanted === 'ativo') return active;
      if (wanted === 'inativo') return !active;
      return false;
    }
    case 'atribuido':
      return matchAtribuido(ticket, criterio);
    case 'sla':
      return String(slaTone(ticket) || '').toLowerCase() === String(criterio.valor || '').toLowerCase();
    default:
      return false;
  }
}

/** AND — todos os critérios devem bater. Sem critérios = não casa. */
export function ticketMatchesQueueCriterios(ticket, criterios) {
  const list = Array.isArray(criterios) ? criterios : [];
  if (!list.length) return false;
  return list.every((criterio) => ticketMatchesQueueCriterio(ticket, criterio));
}

export function summarizeCriterios(criterios) {
  const list = Array.isArray(criterios) ? criterios : [];
  if (!list.length) return 'Sem critérios';
  return list.map((c) => {
    const tipo = String(c.tipo || '');
    if (tipo === 'tabulacao') return `${c.campo || 'tabulação'}: ${c.valor || ''}`;
    if (tipo === 'status') return `status: ${c.valor || ''}`;
    if (tipo === 'workflow') return `workflow: ${c.valor || ''}`;
    if (tipo === 'atribuido') {
      if (c.valor === '__me__') return 'atribuído: eu';
      if (c.valor === '__empty__') return 'atribuído: vazio';
      return `atribuído: ${c.valor || ''}`;
    }
    if (tipo === 'sla') return `SLA: ${c.valor || ''}`;
    return tipo;
  }).join(' · ');
}
