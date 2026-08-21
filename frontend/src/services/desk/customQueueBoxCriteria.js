/**
 * Match de critérios de caixas personalizadas (AND entre linhas, OR dentro de valores[])
 * VERSION: v1.3.0 | DATE: 2026-08-20
 */
import {
  buildResponsavelCandidates,
  ticketAtribuidoToCurrentAgent,
  ticketAssignedToCurrentAgent,
} from './responsavelSegmentation';

const TAB_FIELDS = new Set(['tipoChamado', 'tipo', 'produto', 'motivo', 'detalhe']);

/** Valores selecionados — suporta legado (valor string) e multi (valores[]). */
export function criterioValores(criterio) {
  if (!criterio) return [];
  if (Array.isArray(criterio.valores)) {
    return criterio.valores.map((v) => String(v).trim()).filter(Boolean);
  }
  const single = String(criterio.valor ?? '').trim();
  return single ? [single] : [];
}

export function normalizeCriterioRow(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const tipo = String(raw.tipo || '').trim().toLowerCase();
  if (!tipo) return null;
  const valores = criterioValores(raw);
  return {
    tipo,
    campo: String(raw.campo || '').trim(),
    operador: String(raw.operador || 'equals').trim() || 'equals',
    valores,
    valor: valores[0] || '',
  };
}

export function isCriterioRowValid(criterio) {
  const row = normalizeCriterioRow(criterio);
  if (!row) return false;
  if (row.tipo === 'atribuido') {
    const v = row.valores[0] || '';
    return v === '__me__' || v === '__empty__' || Boolean(v);
  }
  return row.valores.length > 0;
}

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

function readTicketStatus(ticket) {
  return normalizeStatus(ticket);
}

function statusMatches(actualStatus, wanted) {
  const a = String(actualStatus || '').toLowerCase().replace(/\s+/g, '-');
  const b = String(wanted || '').toLowerCase().replace(/\s+/g, '-');
  if (!b) return true;
  if (a === b) return true;
  if (b === 'em-andamento' && (a === 'em-aberto' || a === 'em-andamento')) return true;
  if (b === 'em-aberto' && a === 'em-andamento') return true;
  if (b === 'pendente' && (a === 'em-espera' || a === 'pendente')) return true;
  if (b === 'resolvido' && (a === 'resolvido' || a === 'resolvidos')) return true;
  if (b === 'resolvidos' && (a === 'resolvido' || a === 'resolvidos')) return true;
  if (b === 'fechado' && (a === 'fechado' || a === 'cancelado')) return true;
  if (b === 'cancelado' && (a === 'cancelado' || a === 'fechado')) return true;
  return false;
}

function matchAtribuidoMe(ticket) {
  // __me__ = agente logado (responsável ou atribuído colaborador) — não funcao:/grupo:
  if (ticketAssignedToCurrentAgent(ticket)) return true;
  if (ticketAtribuidoToCurrentAgent(ticket)) return true;
  return false;
}

function isWorkflowActive(ticket) {
  const wf = ticket?.workflow || {};
  const lateralWf = ticket?.lateralForm?.workflow || {};
  const workflowStatus = String(wf.workflowStatus || lateralWf.workflowStatus || '').trim().toLowerCase();
  if (workflowStatus === 'finished' || workflowStatus === 'cancel') return false;
  const status = String(wf.status || lateralWf.status || '').trim().toLowerCase();
  if (status === 'completed' || status === 'cancelled') return false;
  if (wf.completedAt || lateralWf.completedAt) return false;
  if (wf.active === true || lateralWf.active === true) return true;
  if (wf.pendingPersist || ticket?._pendingWorkflowStart?.definicaoSlug) return true;
  return false;
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

function matchTextValue(actual, expected, operador) {
  const op = String(operador || 'equals').trim();
  if (op === 'contains') {
    return actual.toLowerCase().includes(String(expected || '').toLowerCase());
  }
  if (op === 'not_empty') return Boolean(actual);
  return actual.toLowerCase() === String(expected || '').toLowerCase();
}

function matchAnyTextValue(actual, valores, operador) {
  if (!valores.length) return false;
  return valores.some((expected) => matchTextValue(actual, expected, operador));
}

function matchTabulacao(ticket, criterio) {
  const campo = String(criterio.campo || '').trim();
  if (!TAB_FIELDS.has(campo) && campo !== 'tipoChamado') return false;
  const actual = readTabField(ticket, campo);
  return matchAnyTextValue(actual, criterioValores(criterio), criterio.operador);
}

function matchAtribuido(ticket, criterio) {
  const actual = String(ticket?.lateralForm?.atribuido || '').trim();
  const valor = criterioValores(criterio)[0] || '';
  if (valor === '__empty__') return !actual && !ticketAssignedToCurrentAgent(ticket);
  if (valor === '__me__') return matchAtribuidoMe(ticket);
  if (!valor) return Boolean(actual);
  const expected = valor.toLowerCase();
  if (actual.toLowerCase() === expected) return true;
  return buildResponsavelCandidates().some((candidate) => (
    actual.toLowerCase() === candidate
    || actual.toLowerCase().includes(candidate)
    || candidate.includes(actual.toLowerCase())
  ));
}

export function ticketMatchesQueueCriterio(ticket, criterio, context = {}) {
  if (!criterio || !ticket) return false;
  const tipo = String(criterio.tipo || '').trim().toLowerCase();
  const valores = criterioValores(criterio);

  switch (tipo) {
    case 'tabulacao':
      return matchTabulacao(ticket, criterio);
    case 'status':
      if (!valores.length) return false;
      return valores.some((wanted) => statusMatches(readTicketStatus(ticket), wanted));
    case 'workflow': {
      const active = isWorkflowActive(ticket);
      if (!valores.length) return false;
      return valores.some((wanted) => {
        const w = String(wanted || '').trim().toLowerCase();
        if (w === 'ativo') return active;
        if (w === 'inativo') return !active;
        return false;
      });
    }
    case 'atribuido':
      return matchAtribuido(ticket, criterio);
    case 'sla':
      if (!valores.length) return false;
      return valores.some(
        (wanted) => String(slaTone(ticket) || '').toLowerCase() === String(wanted || '').toLowerCase(),
      );
    default:
      return false;
  }
}

/** AND — todos os critérios devem bater. Sem critérios = não casa. */
export function ticketMatchesQueueCriterios(ticket, criterios, context = {}) {
  const list = Array.isArray(criterios) ? criterios : [];
  if (!list.length) return false;
  return list.every((criterio) => ticketMatchesQueueCriterio(ticket, criterio, context));
}

function formatValorList(valores) {
  return valores.length ? valores.join(' ou ') : '';
}

export function summarizeCriterios(criterios) {
  const list = Array.isArray(criterios) ? criterios : [];
  if (!list.length) return 'Sem critérios';
  return list.map((c) => {
    const tipo = String(c.tipo || '');
    const valores = criterioValores(c);
    if (tipo === 'tabulacao') return `${c.campo || 'tabulação'}: ${formatValorList(valores)}`;
    if (tipo === 'status') return `status: ${formatValorList(valores)}`;
    if (tipo === 'workflow') return `workflow: ${formatValorList(valores)}`;
    if (tipo === 'atribuido') {
      const v = valores[0] || '';
      if (v === '__me__') return 'atribuído: eu';
      if (v === '__empty__') return 'atribuído: vazio';
      return `atribuído: ${v}`;
    }
    if (tipo === 'sla') return `SLA: ${formatValorList(valores)}`;
    return tipo;
  }).join(' · ');
}
