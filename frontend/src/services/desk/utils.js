/**
 * Desk CRM — utilitários de fila e conversa
 * VERSION: v3.3.13 | DATE: 2026-07-28
 * — higieniza citação/assinatura em respostas de e-mail na thread
 * — decodifica entidades HTML (&nbsp;) nas mensagens exibidas
 */
import { getTicketColumns, saveTicketColumns, getAllCockpitTickets } from '../ticketsStorage';
import { getWorkflowInfoRequestsForTicket } from '../workflow/workflowInfoNotifications';
import { ticketMatchesAgentResponsavel, shouldUseMeusChamadosFila, shouldViewAllDeskTickets } from './responsavelSegmentation';
import { normalizeMessageDisplayText } from '../../utils/htmlText.util';
import {
  MEUS_TICKETS_QUEUE_ID,
  QUEUE_STATUSES,
  isAgentForwardEscalonar,
  DESK_SEARCH_MODE_CPF,
  DESK_SEARCH_MODE_TICKET,
} from './constants';
import { lookupClient, getAgentName } from '../clientDb';
import {
  advanceWorkflowStep,
  advanceWorkflowByDecision,
  buildEscalonarWorkflowTemplate,
  buildWorkflowAdvanceMessage,
  createWorkflowState,
  evaluateWorkflowAutoAdvance,
  findEscalonarTargetStepIndex,
  getWorkflowTeamLabel,
  getWorkflowTemplateById,
  resolveWorkflowForTicket,
  resolveAtribuidoForStep,
} from './workflowEngine';

export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Corrige texto UTF-8 lido como Latin-1 (ex.: AprovaÃ§Ã£o → Aprovação). */
export function repairUtf8Mojibake(text) {
  const value = String(text ?? '');
  if (!value || !/[ÃÂâ€]/.test(value)) return value;
  try {
    const bytes = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i += 1) {
      bytes[i] = value.charCodeAt(i) & 0xff;
    }
    const decoded = new TextDecoder('utf-8').decode(bytes);
    return decoded.includes('\uFFFD') ? value : decoded;
  } catch {
    return value;
  }
}

export function getInitials(name) {
  const parts = String(name || '??').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return String(name || '?').slice(0, 2).toUpperCase();
}

export function normalizeCpf(v) {
  return String(v || '').replace(/\D/g, '');
}

/** Número de protocolo visível (sem #, sem fallback de _id) */
export function getTicketProtocolLabel(ticket) {
  return String(ticket?.chamadoProtocolo || '').trim();
}

/** Máscara CPF enquanto digita (máx. 11 dígitos): 000.000.000-00 */
export function maskCpfInput(value) {
  const d = normalizeCpf(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCpf(digits) {
  const d = normalizeCpf(digits);
  if (d.length !== 11) return maskCpfInput(d);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function isValidCpfDigits(value) {
  return normalizeCpf(value).length === 11;
}

/** Exige formato mínimo local@dominio.ext (pelo menos um ponto após @) */
export function isValidEmailFormat(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function formatMsgMeta(iso, author) {
  if (!iso) return author || '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' às ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) +
    (author ? ' · ' + author : '');
}

export function formatWaTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatWaDateSeparator(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatTicketDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Hora curta para card da lista (ex.: 14:56). */
export function formatTicketListTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Badge de canal para card da lista branca. */
export function resolveTicketChannelBadge(ticket) {
  if (!ticket) return { label: 'Digital', variant: 'digital' };

  const lf = ticket.lateralForm || {};
  const raw = [
    lf.canal,
    ticket.channel,
    ticket.source,
    lf.reclameAqui ? 'reclame aqui' : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (raw.includes('reclame') || raw.includes('reclame-aqui') || ticket.channel === 'reclame-aqui') {
    return { label: 'RA', variant: 'ra' };
  }
  if (isTicketInWorkflow(ticket)) {
    return { label: 'Workflow', variant: 'workflow' };
  }
  if (raw.includes('whats') || raw.includes('wa')) {
    return { label: 'WA', variant: 'wa' };
  }
  if (raw.includes('tel') || raw.includes('phone') || raw.includes('telefone') || raw.includes('call')) {
    return { label: 'Tel.', variant: 'tel' };
  }
  if (raw.includes('mail') || raw.includes('email') || raw.includes('e-mail')) {
    return { label: 'Digital', variant: 'digital' };
  }
  if (raw.includes('portal') || raw.includes('digital') || raw.includes('web')) {
    return { label: 'Digital', variant: 'digital' };
  }

  return { label: 'Digital', variant: 'digital' };
}

/** Data de finalização (último registro com status resolvido). */
export function getTicketResolvedAt(ticket) {
  if (!ticket) return null;
  normalizeTicketForDeskV2(ticket);
  const historico = ticket.registroHistorico || ticket.registroAlteracoes || [];
  for (let i = historico.length - 1; i >= 0; i -= 1) {
    const entry = historico[i];
    const status = String(entry.status ?? '').trim().toLowerCase();
    if (status === 'resolvido' || status === 'resolvidos') {
      return entry.time || entry.timestamp || entry.data || null;
    }
  }
  if (String(ticket.status || '').toLowerCase() === 'resolvido') {
    return ticket.updatedAt || ticket.createdAt || null;
  }
  return ticket.updatedAt || ticket.createdAt || null;
}

/** Data de entrada na caixa/fila atual (último registro de status). */
export function getTicketQueueEntryAt(ticket) {
  if (!ticket) return null;
  if (ticket.queueEntryAt) return ticket.queueEntryAt;
  const historico = ticket.registroHistorico || ticket.registroAlteracoes || [];
  if (historico.length) {
    const last = historico[historico.length - 1];
    return last.time || last.timestamp || last.data || null;
  }
  return ticket.createdAt || ticket.updatedAt || null;
}

/** Formato curto para coluna Finalização (ex.: 21 Jan). */
export function formatResolvedDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = d.toLocaleDateString('pt-BR', { day: 'numeric' });
  const monthRaw = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
  return `${day} ${month}`;
}

export function getTicketResponsible(ticket) {
  if (!ticket) return '—';
  normalizeTicketForDeskV2(ticket);
  return String(ticket.responsibleAgent || ticket.lateralForm?.responsavel || '').trim() || '—';
}

export function getTicketTitle(ticket) {
  const raw = ticket?.title || ticket?.description || 'Sem assunto';
  return repairUtf8Mojibake(raw);
}

export function statusMeta(queueId) {
  const map = {
    'em-andamento': { label: 'Em andamento', cls: 'andamento' },
    novos: { label: 'Novo', cls: 'novo' },
    pendente: { label: 'Pendente', cls: 'pendente' },
    resolvidos: { label: 'Resolvido', cls: 'resolvido' },
  };
  return map[queueId] || { label: 'Em andamento', cls: 'andamento' };
}

export function buildTags(ticket) {
  const tags = [];
  const lf = ticket.lateralForm || {};
  if (isTicketInWorkflow(ticket)) tags.push('Workflow');
  if (lf.produto) tags.push(repairUtf8Mojibake(lf.produto.replace(/Internet\s+/i, '').trim() || lf.produto));
  return tags.slice(0, 4);
}

export function getClientContactFields(ticket, client) {
  const lf = ticket?.lateralForm || {};
  const emailsRaw = lf.clienteEmail;
  const phonesRaw = lf.clienteTelefone;
  const emailList = Array.isArray(emailsRaw)
    ? emailsRaw.map((item) => String(item || '').trim()).filter(Boolean)
    : (emailsRaw?.lista || []).map((item) => String(item || '').trim()).filter(Boolean);
  const phoneList = Array.isArray(phonesRaw)
    ? phonesRaw.map((item) => String(item || '').trim()).filter(Boolean)
    : (phonesRaw?.lista || []).map((item) => String(item || '').trim()).filter(Boolean);
  const whatsappFromLf = String(lf.clienteTelefoneWhatsapp || '').trim();
  const whatsappFromClient = String(client?.whatsappPhone || client?.telefoneWhatsapp || '').trim();
  const whatsappPhone = whatsappFromLf || whatsappFromClient || phoneList[0] || '';
  const emailFromLf = emailList[0];
  const phoneFromLf = whatsappPhone || phoneList[0];
  return {
    name: lf.clienteNome || ticket?.clientName || ticket?.solicitante || client?.name || '',
    cpf: formatCpf(lf.clienteCpf || lf.cpf || ticket?.clientCPF || client?.cpf || ''),
    email: emailFromLf || ticket?.clientEmail || client?.email || '',
    phone: phoneFromLf || ticket?.clientPhone || client?.telefone || '',
    emails: emailList,
    phones: phoneList,
    whatsappPhone,
  };
}

export function getProductTagClass(product) {
  const lower = String(product || '').toLowerCase();
  if (lower.indexOf('móvel') >= 0 || lower.indexOf('movel') >= 0) return 'velo-tag--mobile';
  if (lower.indexOf('combo') >= 0) return 'velo-tag--combo';
  if (lower.indexOf('fibra') >= 0 || lower.indexOf('internet') >= 0) return 'velo-tag--fiber';
  if (lower.indexOf('tv') >= 0) return 'velo-tag--tv';
  if (lower.indexOf('fixo') >= 0 || lower.indexOf('telefone') >= 0) return 'velo-tag--landline';
  if (lower.indexOf('streaming') >= 0) return 'velo-tag--streaming';
  return 'velo-tag--default';
}

export function getClientProducts(ticket, client) {
  const products = client?.produtos ? [...client.produtos] : [];
  const prod = ticket.lateralForm?.produto || '';
  if (prod && products.indexOf(prod) < 0) products.unshift(prod);
  if (!products.length && prod) return [prod];
  return products;
}

function normalizeClientProductEntry(entry) {
  if (typeof entry === 'string') {
    const name = entry.trim();
    return name ? { name, active: true } : null;
  }
  if (entry && typeof entry === 'object') {
    const name = String(entry.nome || entry.produto || entry.name || '').trim();
    if (!name) return null;
    return { name, active: entry.ativo !== false && entry.active !== false };
  }
  return null;
}

/** Produtos com contrato ativo — exclui itens marcados como inativos no cadastro */
export function getClientActiveProducts(ticket, client) {
  if (Array.isArray(client?.produtosAtivos) && client.produtosAtivos.length) {
    return client.produtosAtivos
      .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry?.nome || entry?.produto || '').trim()))
      .filter(Boolean);
  }

  const seen = new Set();
  const list = [];

  (client?.produtos || []).forEach((entry) => {
    const normalized = normalizeClientProductEntry(entry);
    if (!normalized?.active || seen.has(normalized.name)) return;
    seen.add(normalized.name);
    list.push(normalized.name);
  });

  const ticketProd = String(ticket?.lateralForm?.produto || '').trim();
  if (ticketProd && !seen.has(ticketProd)) list.unshift(ticketProd);

  return list;
}

export function buildIaReply(ticket) {
  const lf = ticket.lateralForm || {};
  const name = (ticket.clientName || 'cliente').split(' ')[0];
  return `Olá ${name}! Entendo sua solicitação sobre ${lf.motivo || ticket.title || 'seu atendimento'}. Vou verificar agora e retorno em instantes com a melhor solução.`;
}

export function buildIaTabulation(ticket, fields) {
  const lf = ticket?.lateralForm || {};
  const tipo = fields?.tipo || lf.classificacaoTipo || '';
  const produto = fields?.produto || lf.produto || '';
  const motivo = fields?.motivo || lf.motivo || '';
  const detalhe = fields?.detalhe || lf.detalhe || '';
  const parts = [tipo, produto, motivo, detalhe].filter(Boolean);
  return parts.length ? parts.join(' → ') : 'Tabulação incompleta';
}

export function getEscalonarLabel(id) {
  const map = { n2: 'N2', financeiro: 'Financeiro', produtos: 'Produtos', suporte: 'Suporte' };
  return map[id] || 'Selecionar escalonamento';
}

export const TICKET_OPERATION_STEPS = [
  { id: 1, title: 'Caixa de entrada e atendimento N1', subtitle: 'N1', icon: 'ti-inbox' },
  { id: 2, title: 'Workflow', subtitle: 'Workflow', icon: 'ti-arrows-exchange' },
  { id: 3, title: 'Retorno ao atendimento N1', subtitle: 'Finalização', icon: 'ti-home' },
];

function resolveWorkflowArea(escalonar, group, lastWorkflow) {
  if (escalonar === 'n2' || lastWorkflow === 'n2' || group.includes('n2')) return 'N2';
  if (escalonar === 'financeiro' || lastWorkflow === 'financeiro' || group.includes('financeiro')) {
    return 'Financeiro';
  }
  if (escalonar === 'produtos' || lastWorkflow === 'produtos' || group.includes('produtos')) {
    return 'Produtos';
  }
  if (escalonar === 'suporte' || lastWorkflow === 'suporte' || group.includes('suporte')) {
    return 'Suporte';
  }
  return null;
}

export function getTicketOperationProgress(ticket, queueId) {
  const lf = ticket?.lateralForm || {};
  const group = String(ticket?.group || '').toLowerCase();
  const resolved = queueId === 'resolvidos' || ticket?.status === 'resolvido';
  const inWorkflow = isTicketInWorkflow(ticket);
  let workflowArea = null;
  if (inWorkflow) {
    const progress = getWorkflowProgress(ticket);
    workflowArea = progress?.awaitingTeamLabel || null;
  } else {
    workflowArea = resolveWorkflowArea(null, group, lf.lastWorkflow);
  }
  const retornoN1 = lf.retornoN1 === true || (lf.wasEscalated && !inWorkflow && !resolved);

  let activeStep = 1;
  if (resolved) {
    activeStep = 4;
  } else if (inWorkflow) {
    activeStep = 2;
  } else if (retornoN1) {
    activeStep = 3;
  } else if (queueId === 'novos' || ticket?.status === 'novo') {
    activeStep = 1;
  }

  return {
    activeStep,
    workflowArea,
    resolved,
    steps: TICKET_OPERATION_STEPS,
  };
}

export function getTicketOperationAreaLabel(ticket) {
  const { activeStep, workflowArea } = getTicketOperationProgress(ticket);
  if (activeStep >= 4) return 'Finalizado';
  if (activeStep === 2 && workflowArea) return workflowArea;
  if (activeStep === 3) return 'N1 — Finalização';
  return 'N1';
}

function readTicketLateralWorkflow(ticket) {
  const lateral = ticket?.lateralForm?.workflow;
  if (lateral?.templateId || lateral?.definicaoSlug) {
    return lateral;
  }

  const persisted = ticket?.workflow;
  if (!persisted?.active) {
    return lateral || null;
  }

  const workflowKey = persisted.workflowId
    || lateral?.templateId
    || lateral?.definicaoSlug;
  if (!workflowKey) {
    return lateral || null;
  }

  const template = getWorkflowTemplateById(workflowKey);
  const templateSlug = template?.id || null;

  return {
    ...(lateral || {}),
    templateId: templateSlug || lateral?.templateId,
    definicaoSlug: templateSlug || lateral?.definicaoSlug,
    step: persisted.step ?? lateral?.step ?? 0,
    passoId: persisted.passoId ?? lateral?.passoId,
    startedAt: persisted.startedAt ?? lateral?.startedAt,
    completedAt: persisted.completedAt ?? lateral?.completedAt,
    status: persisted.completedAt
      ? 'completed'
      : (lateral?.status || 'active'),
    pendingDecision: persisted.pendingDecision ?? lateral?.pendingDecision ?? null,
    currentStepId: lateral?.currentStepId,
    stepHistory: lateral?.stepHistory || [],
  };
}

export function isTicketInWorkflow(ticket) {
  if (ticket?.workflow?.active === true) return true;
  const wf = readTicketLateralWorkflow(ticket);
  return Boolean(wf?.templateId || wf?.definicaoSlug || ticket?.workflow?.workflowId);
}

export function isTicketWorkflowActive(ticket) {
  if (ticket?.workflow?.active === true && !ticket?.workflow?.completedAt) {
    const wf = readTicketLateralWorkflow(ticket);
    if (wf?.status === 'completed') return false;
    return true;
  }
  const wf = readTicketLateralWorkflow(ticket);
  if (!wf?.templateId && !wf?.definicaoSlug && !ticket?.workflow?.workflowId) return false;
  return wf?.status !== 'completed';
}

export function getWorkflowTemplateForTicket(ticket) {
  const wf = readTicketLateralWorkflow(ticket);
  const templateKey = wf?.templateId || wf?.definicaoSlug || ticket?.workflow?.workflowId;
  if (!templateKey) return null;
  return getWorkflowTemplateById(templateKey)
    || (String(templateKey).startsWith('escalonar-') ? buildEscalonarWorkflowTemplate(String(templateKey).replace('escalonar-', '')) : null);
}

function formatDurationMs(ms) {
  if (ms <= 0) return '0min';
  const totalMin = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

function getStepStartedAt(workflow, stepId) {
  const entry = (workflow?.stepHistory || []).find((h) => h.stepId === stepId);
  return entry?.at || workflow?.startedAt || null;
}

export function getWorkflowProgress(ticket) {
  const workflow = readTicketLateralWorkflow(ticket);
  const template = getWorkflowTemplateForTicket(ticket);
  if (!workflow || !template) return null;

  const stepIndex = typeof workflow.step === 'number' ? workflow.step : null;
  const currentStepId = stepIndex != null && template.steps[stepIndex]
    ? template.steps[stepIndex].id
    : (workflow.currentStepId || template.defaultActiveStepId);
  const currentIndex = template.steps.findIndex((s) => s.id === currentStepId);
  const activeStepIndex = currentIndex >= 0 ? currentIndex : 0;
  const activeStep = template.steps[activeStepIndex];

  const completedIds = new Set(
    (workflow.stepHistory || [])
      .filter((h) => h.status === 'completed')
      .map((h) => h.stepId),
  );

  let stepsWithState = template.steps.map((step, index) => {
    let state = 'pending';
    if (completedIds.has(step.id)) state = 'completed';
    else if (step.id === currentStepId) state = 'active';
    else if (index < activeStepIndex) state = 'completed';

    const historyEntry = (workflow.stepHistory || []).find((h) => h.stepId === step.id);
    return {
      ...step,
      state,
      teamLabel: getWorkflowTeamLabel(step.team),
      completedAt: historyEntry?.status === 'completed' ? historyEntry.at : null,
    };
  });

  const escalonarId = ticket?.lateralForm?.escalonar;
  const agentRetainsTicket = Boolean(ticket?.lateralForm?.agentRetainsTicket);
  let forwardTargetStepIndex = -1;
  let forwardTargetStepId = null;

  if (agentRetainsTicket && isAgentForwardEscalonar(escalonarId)) {
    forwardTargetStepIndex = findEscalonarTargetStepIndex(template, escalonarId);
    if (forwardTargetStepIndex > activeStepIndex) {
      const targetStep = template.steps[forwardTargetStepIndex];
      forwardTargetStepId = targetStep?.id || null;
      stepsWithState = stepsWithState.map((step, index) => {
        if (index === forwardTargetStepIndex && step.state === 'pending') {
          return { ...step, state: 'signaled' };
        }
        return step;
      });
    }
  }

  let slaRemainingMs = null;
  let slaTotalHours = null;
  if (activeStep?.slaHours) {
    slaTotalHours = activeStep.slaHours;
    const startedAt = getStepStartedAt(workflow, activeStep.id);
    if (startedAt) {
      const deadline = new Date(startedAt).getTime() + activeStep.slaHours * 3600000;
      slaRemainingMs = Math.max(0, deadline - Date.now());
    }
  }

  const externalTeamActive = activeStep && !['n1', 'agent'].includes(activeStep.team);

  return {
    workflow,
    template,
    activeStepIndex,
    activeStep,
    stepsWithState,
    forwardTargetStepIndex,
    forwardTargetStepId,
    slaRemainingMs,
    slaRemainingLabel: slaRemainingMs != null ? formatDurationMs(slaRemainingMs) : null,
    slaTotalHours,
    externalTeamActive,
    awaitingTeamLabel: externalTeamActive ? getWorkflowTeamLabel(activeStep.team) : null,
    composeLocked: Boolean(externalTeamActive && !agentRetainsTicket),
  };
}

export function buildWorkflowSystemMessage(template) {
  return `Workflow **${template.title}** iniciado pelo agente.`;
}

function getWorkflowInstanceKey(workflow) {
  return workflow?.templateId || workflow?.definicaoSlug || '';
}

export function maybeActivateWorkflowForTicket(ticket, rightFields, escalonar, author, options = {}) {
  const mode = options.mode || 'commit';
  const lf = ticket.lateralForm || {};
  if (getWorkflowInstanceKey(lf.workflow)) {
    return { activated: false, workflow: lf.workflow, template: getWorkflowTemplateForTicket(ticket) };
  }

  let template = null;
  if (mode === 'escalonar') {
    if (!escalonar) {
      return { activated: false, workflow: null, template: null };
    }
    template = buildEscalonarWorkflowTemplate(escalonar);
  } else {
    template = resolveWorkflowForTicket(ticket, rightFields);
    if (!template && escalonar) {
      template = buildEscalonarWorkflowTemplate(escalonar);
    }
  }
  if (!template) {
    return { activated: false, workflow: null, template: null };
  }

  const workflow = createWorkflowState(template, {
    by: author || getAgentName() || 'sistema',
    trigger: escalonar ? 'escalonar' : 'tabulation',
  });
  const activeStep = template.steps.find((s) => s.id === workflow.currentStepId);
  const atribuido = resolveAtribuidoForStep(activeStep);
  return { activated: true, workflow, template, atribuido };
}

function pushWorkflowSystemMessage(ticket, text) {
  const ts = new Date().toISOString();
  if (!ticket.messages) ticket.messages = [];
  ticket.messages.push({
    id: `wf-sys-${Date.now()}`,
    type: 'system',
    fromClient: false,
    origin: 'sistema',
    text,
    timestamp: ts,
    author: 'Sistema',
  });
}

/** Preserva workflow existente no commit — ativação só via botão Iniciar Workflow */
export function syncTicketWorkflowOnCommit(ticket) {
  if (!ticket) return { activated: false, advanced: false };
  const lf = ticket.lateralForm || {};
  const workflow = lf.workflow;

  if (workflow) {
    const { escalonar: _legacyEscalonar, ...lfRest } = lf;
    ticket.lateralForm = { ...lfRest, workflow };
  } else if (lf.escalonar) {
    const { escalonar: _legacyEscalonar, ...lfRest } = lf;
    ticket.lateralForm = lfRest;
  }

  return {
    activated: false,
    advanced: false,
    workflow: workflow || null,
    template: workflow ? getWorkflowTemplateForTicket(ticket) : null,
  };
}

export function advanceTicketWorkflowByDecision(ticket, variavel, author) {
  const lf = ticket?.lateralForm || {};
  const workflow = lf.workflow;
  const template = getWorkflowTemplateForTicket(ticket);
  if (!workflow || !template || workflow.status === 'completed') {
    return { advanced: false, completed: false };
  }

  const result = advanceWorkflowByDecision(workflow, template, variavel, {
    by: author || getAgentName() || 'sistema',
    trigger: `decision-${variavel}`,
  });

  if (!result.advanced) return { advanced: false, completed: false };

  ticket.lateralForm = { ...lf, workflow: result.workflow };
  if (result.statusTicket) ticket.status = result.statusTicket;
  if (result.nextStep) {
    const atribuido = resolveAtribuidoForStep(result.nextStep);
    if (atribuido) ticket.lateralForm.atribuido = atribuido;
  }

  if (variavel === 'approve') {
    pushWorkflowSystemMessage(
      ticket,
      buildWorkflowAdvanceMessage(template, result.previousStepId, result.nextStepId, author),
    );
  }

  return {
    advanced: true,
    completed: result.completed,
    workflow: result.workflow,
    template,
  };
}

export function advanceTicketWorkflow(ticket, author) {
  const lf = ticket?.lateralForm || {};
  const workflow = lf.workflow;
  const template = getWorkflowTemplateForTicket(ticket);
  if (!workflow || !template || workflow.status === 'completed') {
    return { advanced: false, completed: false };
  }

  const result = advanceWorkflowStep(workflow, template, {
    by: author || getAgentName() || 'sistema',
    trigger: 'manual',
  });

  if (!result.advanced) return { advanced: false, completed: false };

  ticket.lateralForm = { ...lf, workflow: result.workflow };
  const nextStep = template.steps.find((s) => s.id === result.nextStepId);
  if (nextStep) {
    const atribuido = resolveAtribuidoForStep(nextStep);
    if (atribuido) ticket.lateralForm.atribuido = atribuido;
  }
  pushWorkflowSystemMessage(
    ticket,
    buildWorkflowAdvanceMessage(template, result.previousStepId, result.nextStepId, author),
  );

  return {
    advanced: true,
    completed: result.completed,
    workflow: result.workflow,
    template,
  };
}

export function injectWorkflowSystemMessage(ticket, template) {
  if (!ticket || !template) return ticket;
  const lf = ticket.lateralForm || {};
  if (lf.workflow?.systemMessageInjected) return ticket;

  const text = buildWorkflowSystemMessage(template);
  const ts = new Date().toISOString();
  if (!ticket.messages) ticket.messages = [];
  ticket.messages.push({
    id: `wf-sys-${Date.now()}`,
    type: 'system',
    fromClient: false,
    origin: 'sistema',
    text,
    timestamp: ts,
    author: 'Sistema',
  });

  ticket.lateralForm = {
    ...lf,
    workflow: {
      ...(lf.workflow || {}),
      systemMessage: text,
      systemMessageInjected: true,
    },
  };
  return ticket;
}

export function getCascadeCategoryLabel(id) {
  const map = {
    'emprestimo-pessoal': 'Empréstimo pessoal',
    antecipacao: 'Antecipação',
    'alteracao-dados': 'Alteração de dados',
  };
  return map[id] || 'Selecionar categoria';
}

export function getCascadeActionLabel(id) {
  const map = { cancelamento: 'Cancelamento', estorno: 'Estorno' };
  return map[id] || 'Selecionar ação';
}

function ensureTicketSlaFields(ticket) {
  if (ticket.slaRemaining != null && ticket.slaStatus) return;
  const priority = String(ticket.priority || '').toLowerCase();
  const limitHours = priority === 'critica' || priority === 'critical' ? 4
    : priority === 'alta' || priority === 'high' ? 8 : 24;
  const created = ticket.createdAt ? new Date(ticket.createdAt).getTime() : Date.now();
  const elapsedMin = Math.max(0, Math.round((Date.now() - created) / 60000));
  const totalMin = limitHours * 60;
  ticket.slaRemaining = totalMin - elapsedMin;
  if (ticket.slaRemaining <= 0) ticket.slaStatus = 'critical';
  else if (ticket.slaRemaining <= Math.min(60, totalMin * 0.2)) ticket.slaStatus = 'warning';
  else ticket.slaStatus = 'ok';
}

export function getSlaClass(ticket) {
  ensureTicketSlaFields(ticket);
  if (ticket.slaStatus === 'critical') return 'critical';
  if (ticket.slaStatus === 'warning' || ticket.slaStatus === 'attention') return 'warning';
  if (ticket.slaRemaining != null) {
    if (ticket.slaRemaining <= 0) return 'critical';
    if (ticket.slaRemaining <= 30) return 'warning';
  }
  return 'ok';
}

export function normalizeTicketForDeskV2(ticket) {
  if (!ticket) return ticket;
  if (!ticket.lateralForm) ticket.lateralForm = {};

  const cpfDigits = normalizeCpf(ticket.lateralForm.cpf || ticket.clientCPF);
  if (cpfDigits && !ticket.lateralForm.cpf) ticket.lateralForm.cpf = cpfDigits;
  if (cpfDigits && !ticket.clientCPF) ticket.clientCPF = formatCpf(cpfDigits);

  const client = lookupClient(cpfDigits);
  ticket.clientName = ticket.clientName || ticket.solicitante || (client && client.name) || 'Cliente';
  ticket.solicitante = ticket.solicitante || ticket.clientName;

  if (!ticket.lateralForm.canal && (ticket.channel || ticket.source)) {
    ticket.lateralForm.canal = ticket.channel || ticket.source;
  }
  if (!ticket.lateralForm.responsavel && ticket.responsibleAgent) {
    ticket.lateralForm.responsavel = ticket.responsibleAgent;
  }

  ensureTicketSlaFields(ticket);

  if (!ticket.updatedAt) ticket.updatedAt = ticket.createdAt || new Date().toISOString();
  if (!ticket.createdAt) ticket.createdAt = ticket.updatedAt;
  return ticket;
}

export function migrateAllTicketsForDeskV2() {
  const columns = getTicketColumns();
  if (!columns.length) return;
  let changed = false;
  columns.forEach((box) => {
    (box.tickets || []).forEach((t) => {
      const before = JSON.stringify(t);
      normalizeTicketForDeskV2(t);
      if (JSON.stringify(t) !== before) changed = true;
    });
  });
  if (changed) saveTicketColumns(columns);
}

function compareQueueEntryTime(a, b, dir = 1) {
  const aTime = new Date(getTicketQueueEntryAt(a.ticket) || 0).getTime();
  const bTime = new Date(getTicketQueueEntryAt(b.ticket) || 0).getTime();
  if (aTime !== bTime) return dir * (aTime - bTime);
  return String(a.ticket.id).localeCompare(String(b.ticket.id), 'pt-BR', { numeric: true });
}

export function sortTicketEntries(entries, activeSort, sortDir = 'desc', forceEntrySort = false) {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...entries].sort((a, b) => {
    if (forceEntrySort) {
      return compareQueueEntryTime(a, b, 1);
    }
    if (activeSort === 'prioridade') {
      const prio = { critica: 0, alta: 1, normal: 2, baixa: 3 };
      return (prio[a.ticket.priority] || 9) - (prio[b.ticket.priority] || 9);
    }
    if (activeSort === 'sla') {
      return (a.ticket.slaRemaining || 999) - (b.ticket.slaRemaining || 999);
    }
    if (activeSort === 'titulo') {
      return dir * getTicketTitle(a.ticket).localeCompare(getTicketTitle(b.ticket), 'pt-BR', { sensitivity: 'base' });
    }
    if (activeSort === 'finalizacao') {
      const aTime = new Date(getTicketResolvedAt(a.ticket) || 0).getTime();
      const bTime = new Date(getTicketResolvedAt(b.ticket) || 0).getTime();
      return dir * (aTime - bTime);
    }
    return compareQueueEntryTime(a, b, dir);
  });
}

function shouldFilterByAgentResponsavel(queueId) {
  return queueId !== 'resolvidos' && queueId !== MEUS_TICKETS_QUEUE_ID;
}

export function isMeusTicketsQueue(queueId) {
  return queueId === MEUS_TICKETS_QUEUE_ID;
}

export function isDeskTableQueue(queueId) {
  return queueId === 'resolvidos' || isMeusTicketsQueue(queueId);
}

export const MY_TICKETS_STATUS_SECTIONS = [
  { id: 'novos', label: 'Novos', dot: '#1634FF' },
  { id: 'em-andamento', label: 'Em andamento', dot: '#15A237' },
  { id: 'pendente', label: 'Pendente', dot: '#FCC200' },
  { id: 'resolvidos', label: 'Resolvidos', dot: '#9ca3af' },
];

function matchesTicketByCpf(ticket, rawQuery) {
  const digits = normalizeCpf(String(rawQuery || '').trim());
  if (!digits) return false;
  const ticketCpf = normalizeCpf(ticket.lateralForm?.cpf || ticket.clientCPF || '');
  if (digits.length === 11) return ticketCpf === digits;
  return ticketCpf.startsWith(digits);
}

function matchesTicketByProtocol(ticket, rawQuery) {
  const protocol = getTicketProtocolLabel(ticket);
  if (!protocol) return false;
  const query = String(rawQuery || '').trim().replace(/^#/, '');
  if (!query) return false;
  const queryDigits = normalizeCpf(query);
  const protocolDigits = normalizeCpf(protocol);
  if (protocol.toLowerCase() === query.toLowerCase()) return true;
  if (queryDigits.length >= 4 && protocolDigits.includes(queryDigits)) return true;
  if (query.length >= 3 && protocol.toLowerCase().includes(query.toLowerCase())) return true;
  return false;
}

function matchesTicketSearch(entry, q, searchMode = DESK_SEARCH_MODE_CPF) {
  if (!q) return true;
  const t = entry.ticket;
  if (searchMode === DESK_SEARCH_MODE_TICKET) {
    return matchesTicketByProtocol(t, q);
  }
  return matchesTicketByCpf(t, q);
}

function filterMyTicketsEntries(searchQuery) {
  const q = (searchQuery || '').toLowerCase();
  const activeQueues = new Set(['novos', 'em-andamento', 'pendente', 'resolvidos']);

  if (shouldViewAllDeskTickets()) {
    return getAllCockpitTickets().filter((entry) => {
      if (!activeQueues.has(entry.queueId)) return false;
      return matchesTicketSearch(entry, q);
    });
  }

  const agentQueues = new Set(['novos', 'em-andamento', 'pendente']);
  const trustBackendQueues = shouldUseMeusChamadosFila();

  return getAllCockpitTickets().filter((entry) => {
    const { queueId, ticket } = entry;

    if (queueId === 'resolvidos') {
      if (!ticketMatchesAgentResponsavel(ticket)) return false;
      return matchesTicketSearch(entry, q);
    }

    if (!agentQueues.has(queueId)) return false;

    // /boxes?fila=meus-chamados já filtra por responsável no backend — não re-filtrar no cliente
    if (trustBackendQueues) {
      return matchesTicketSearch(entry, q);
    }

    return ticketMatchesAgentResponsavel(ticket) && matchesTicketSearch(entry, q);
  });
}

export function formatTicketSlaRemaining(ticket) {
  normalizeTicketForDeskV2(ticket);
  const remaining = ticket.slaRemaining;
  if (remaining == null) return '—';
  if (remaining <= 0) return 'Vencido';
  const hours = Math.floor(remaining / 60);
  const minutes = remaining % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

export function groupMyTicketsByStatus(entries) {
  return MY_TICKETS_STATUS_SECTIONS.map((section) => ({
    ...section,
    entries: sortTicketEntries(
      (entries || []).filter((entry) => matchesMyTicketsStatusSection(entry, section.id)),
      'sla',
      'asc',
    ),
  })).filter((section) => section.entries.length > 0);
}

function matchesMyTicketsStatusSection(entry, sectionId) {
  if (entry.queueId === sectionId) return true;
  if (sectionId !== 'em-andamento') return false;
  const status = String(entry.ticket?.status || '').trim().toLowerCase();
  return status === 'em-aberto' || status === 'em-andamento' || status === 'em andamento';
}

export function filterTickets(activeQueue, searchQuery, activeSort, entrySortOldestFirst = false) {
  const q = (searchQuery || '').toLowerCase();
  if (isMeusTicketsQueue(activeQueue)) {
    return sortTicketEntries(filterMyTicketsEntries(q), 'sla', 'asc');
  }
  const filterByResponsavel = shouldFilterByAgentResponsavel(activeQueue);
  const trustBackendQueues = shouldUseMeusChamadosFila();
  const filtered = getAllCockpitTickets()
    .filter((entry) => {
      if (entry.queueId !== activeQueue) return false;
      if (filterByResponsavel && !trustBackendQueues && !ticketMatchesAgentResponsavel(entry.ticket)) {
        return false;
      }
      return matchesTicketSearch(entry, q);
    });
  return sortTicketEntries(filtered, activeSort, 'desc', entrySortOldestFirst);
}

/** Busca global por Enter: CPF (modo cpf) ou protocolo (modo ticket). */
export function resolveDeskSearchEntries(
  rawQuery,
  activeSort,
  entrySortOldestFirst = false,
  searchMode = DESK_SEARCH_MODE_CPF,
) {
  const trimmed = String(rawQuery || '').trim();
  if (!trimmed) return [];

  const all = getAllCockpitTickets();
  const mode = searchMode === DESK_SEARCH_MODE_TICKET ? DESK_SEARCH_MODE_TICKET : DESK_SEARCH_MODE_CPF;

  const filtered = all.filter(({ ticket: t }) => {
    if (!ticketMatchesAgentResponsavel(t)) return false;
    return mode === DESK_SEARCH_MODE_TICKET
      ? matchesTicketByProtocol(t, trimmed)
      : matchesTicketByCpf(t, trimmed);
  });

  return sortTicketEntries(filtered, activeSort, 'desc', entrySortOldestFirst);
}

export function countByQueue(queueId) {
  if (isMeusTicketsQueue(queueId)) {
    return filterMyTicketsEntries('').length;
  }
  const filterByResponsavel = shouldFilterByAgentResponsavel(queueId);
  const trustBackendQueues = shouldUseMeusChamadosFila();
  return getAllCockpitTickets().filter((e) => {
    if (e.queueId !== queueId) return false;
    if (filterByResponsavel && !trustBackendQueues && !ticketMatchesAgentResponsavel(e.ticket)) {
      return false;
    }
    return true;
  }).length;
}

/** Fila com tickets visíveis — prioriza Novos (maior volume no Atlas). */
export function pickDefaultQueueId(preferred = 'novos') {
  if (countByQueue(preferred) > 0) return preferred;
  const match = QUEUE_STATUSES.find((queue) => (
    queue.id !== 'resolvidos'
    && queue.id !== MEUS_TICKETS_QUEUE_ID
    && countByQueue(queue.id) > 0
  ));
  return match?.id || preferred;
}

export function pickDefaultTicket(activeQueue) {
  const list = filterTickets(activeQueue || 'novos', '', 'data');
  return getEntryTicketId(list[0]) ?? null;
}

export function getEntryTicketId(entry) {
  return entry?.ticket?.id ?? entry?.ticket?._id ?? null;
}

/** Lista visível no Desk (fila ativa ou busca aplicada). */
export function resolveDeskWorkingEntries(
  activeQueue,
  appliedSearch,
  activeSort,
  entrySortOldestFirst = false,
  searchMode = DESK_SEARCH_MODE_CPF,
) {
  const search = String(appliedSearch || '').trim();
  return search
    ? resolveDeskSearchEntries(search, activeSort, entrySortOldestFirst, searchMode)
    : filterTickets(activeQueue, '', activeSort, entrySortOldestFirst);
}

/** Próximo ticket na lista visível após salvar/fechar o atual. */
export function pickNextTicketFromEntries(currentId, entries) {
  const list = entries || [];
  if (!list.length || currentId == null) return null;
  const current = String(currentId);
  const idx = list.findIndex((e) => String(getEntryTicketId(e)) === current);
  if (idx === -1) {
    const fallback = list.find((e) => String(getEntryTicketId(e)) !== current);
    return getEntryTicketId(fallback) ?? null;
  }
  for (let i = idx + 1; i < list.length; i += 1) {
    return getEntryTicketId(list[i]);
  }
  for (let i = 0; i < idx; i += 1) {
    return getEntryTicketId(list[i]);
  }
  return null;
}

/** Próximo ticket na fila ativa após salvar/fechar o atual. */
export function pickNextTicketInQueue(currentId, activeQueue, activeSort) {
  return pickNextTicketFromEntries(currentId, filterTickets(activeQueue, '', activeSort));
}

export function isConversationMessage(message) {
  if (!message) return false;
  if (message.type === 'system' || message.type === 'internal') return false;
  const text = String(message.text || message.message || '').trim();
  if (!text) return false;
  return true;
}

export function isClientConversationMessage(message) {
  if (!isConversationMessage(message)) return false;
  if (message.fromClient === true || message.type === 'client') return true;
  if (message.type === 'agent') return false;
  return message.sender === 'them';
}

export function buildConversationMessages(ticket) {
  const msgs = [];
  (ticket.messages || []).forEach((m) => {
    if (!isConversationMessage(m)) return;
    const isClient = isClientConversationMessage(m);
    const ts = m.timestamp || m.time || m.createdAt;
    msgs.push({
      type: isClient ? 'client' : 'agent',
      initials: isClient ? getInitials(ticket.clientName || m.author) : getInitials(m.author || getAgentName()),
      text: String(m.text || m.message || '').trim(),
      meta: formatMsgMeta(ts, m.author || (isClient ? ticket.clientName : getAgentName())),
      timestamp: ts,
    });
  });
  return msgs;
}

function parseRegistroSortKey(id) {
  const match = String(id || '').match(/^(\d+)-(pub|int)$/);
  if (!match) return { index: 999999, part: 9 };
  return { index: Number(match[1]), part: match[2] === 'pub' ? 0 : 1 };
}

function isWorkflowInfoNoteText(text) {
  return /^\[Workflow\].*Pedido de informação/i.test(String(text || '').trim());
}

export function shouldHideWorkflowSystemThreadMessage(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  if (isWorkflowInfoNoteText(value)) return true;
  if (/^Workflow\s+\*\*/i.test(value)) return true;
  if (/^Etapa\s+\*\*/i.test(value)) return true;
  if (/^Decisão\s+\*\*aprovada\*\*/i.test(value)) return true;
  return false;
}

function mapAgentInternalNote(note, ticket) {
  const text = String(note.text || '').trim();
  if (!text) return null;

  const isWorkflowInfo = isWorkflowInfoNoteText(text);
  const author = note.author || 'Agente';

  return {
    id: note.id || `int-${note.timestamp}`,
    kind: isWorkflowInfo ? 'workflow' : 'agent',
    author: isWorkflowInfo ? (note.author || 'Workflow') : author,
    initials: isWorkflowInfo ? 'WF' : getInitials(author),
    badge: isWorkflowInfo ? 'Pedido de info' : 'Interna',
    timestamp: note.timestamp || ticket.updatedAt,
    body: isWorkflowInfo ? text.replace(/^\[Workflow\]\s*/i, '') : text,
    tags: isWorkflowInfo ? ['Workflow'] : [],
    ticketId: String(ticket.id || ticket._id),
    ticketTitle: getTicketTitle(ticket),
    boldSegments: [],
  };
}

/**
 * Extrai só o conteúdo novo de uma resposta de e-mail (sem citação/assinatura).
 * Espelha backend/src/services/emailReplyContent.util.ts
 */
export function extractEmailReplyContent(raw) {
  let text = String(raw ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!text.trim()) return '';

  const quoteHeaders = [
    /^Em\s.+?\sescreveu:\s*$/im,
    /^On\s.+?\swrote:\s*$/im,
    /^-{2,}\s*Original Message\s*-{2,}\s*$/im,
    /^De:\s.+$/im,
    /^From:\s.+$/im,
  ];

  let cutAt = text.length;
  for (const pattern of quoteHeaders) {
    const match = pattern.exec(text);
    if (match && match.index != null && match.index < cutAt) {
      cutAt = match.index;
    }
  }
  text = text.slice(0, cutAt);

  text = text
    .split('\n')
    .filter((line) => !/^\s*>/.test(line))
    .join('\n');

  const sig = /^-- \s*$/m.exec(text);
  if (sig && sig.index != null) {
    text = text.slice(0, sig.index);
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export function buildRegistroThread(ticket) {
  if (!ticket) return [];

  const raw = (ticket.messages || [])
    .filter((m) => {
      if (!m || m.type === 'internal') return false;
      const text = String(m.text || m.message || '').trim();
      if (m.type === 'system') {
        if (shouldHideWorkflowSystemThreadMessage(text)) return false;
        return Boolean(text);
      }
      return Boolean(text);
    })
    .map((m) => {
      if (m.type === 'system') {
        return {
          type: 'system',
          text: normalizeMessageDisplayText(String(m.text || m.message || '').trim()),
          meta: 'Sistema',
          timestamp: m.timestamp || m.time || m.createdAt,
        };
      }
      return { ...m, _kind: 'public' };
    });

  raw.sort((a, b) => {
    const tsA = new Date(a.timestamp || a.time || a.createdAt || 0).getTime();
    const tsB = new Date(b.timestamp || b.time || b.createdAt || 0).getTime();
    if (tsA !== tsB) return tsA - tsB;
    if (a.type === 'system' || b.type === 'system') return 0;
    const keyA = parseRegistroSortKey(a.id);
    const keyB = parseRegistroSortKey(b.id);
    if (keyA.index !== keyB.index) return keyA.index - keyB.index;
    return keyA.part - keyB.part;
  });

  const mapped = raw.map((m) => {
    if (m.type === 'system') return m;
    const origin = m.origin || (m.sender === 'them' ? 'cliente' : 'agente');
    const isClient = (
      origin === 'cliente'
      || m.fromClient === true
      || m.type === 'client'
      || m.sender === 'them'
    );
    const bubbleType = isClient ? 'client' : 'agent';
    const ts = m.timestamp || m.time || m.createdAt;
    const authorName = isClient
      ? (ticket.clientName || m.author)
      : (m.author || getAgentName());
    const rawText = String(m.text || m.message || '').trim();
    const looksLikeEmailReply = /escreveu:|wrote:|Original Message|^\s*>/m.test(rawText);
    const text = normalizeMessageDisplayText(
      isClient && looksLikeEmailReply
        ? extractEmailReplyContent(rawText)
        : rawText,
    );
    return {
      type: bubbleType,
      initials: getInitials(isClient ? ticket.clientName || m.author : authorName),
      text,
      meta: formatMsgMeta(ts, authorName),
      timestamp: ts,
    };
  });

  const combined = mapped.sort(
    (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0),
  );

  return combined;
}

export function getClientAnalise(client) {
  if (client?.analise) return client.analise;
  if ((client?.termometro ?? 0) >= 55 || client?.risco === 'Alto') {
    return 'Termômetro crítico: combinar financeiro + retenção no mesmo atendimento.';
  }
  if (client?.risco === 'Médio') {
    return 'Cliente requer acompanhamento proativo no atendimento.';
  }
  return 'Perfil estável — seguir fluxo padrão de atendimento.';
}

export function getTicketStatusLabel(status) {
  const map = {
    novo: 'Novo',
    'em-aberto': 'Em Andamento',
    'em-andamento': 'Em Andamento',
    pendente: 'Pendente',
    resolvido: 'Resolvido',
    resolvidos: 'Resolvido',
  };
  return map[status] || status || '—';
}

const TERMINAL_TICKET_STATUSES = new Set(['resolvido', 'resolvidos', 'cancelado', 'fechado']);

export function isTicketTerminalStatus(ticket) {
  const status = String(ticket?.status || '').trim().toLowerCase();
  return TERMINAL_TICKET_STATUSES.has(status);
}

export function getTicketCpfDigits(ticket) {
  const lf = ticket?.lateralForm || {};
  return normalizeCpf(lf.clienteCpf || lf.cpf || ticket?.clientCPF || '');
}

function normalizeClientNameKey(ticket) {
  const lf = ticket?.lateralForm || {};
  return String(lf.clienteNome || ticket?.clientName || ticket?.solicitante || '')
    .trim()
    .toLowerCase();
}

export function ticketsBelongToSameClient(source, target, context = {}) {
  const sourceCpf = getTicketCpfDigits(source);
  const targetCpf = getTicketCpfDigits(target);
  const contextCpf = normalizeCpf(context.clientCpfDigits || context.cpf || '');

  if (sourceCpf && targetCpf) return sourceCpf === targetCpf;

  if (contextCpf.length === 11) {
    const sourceMatchesContext = !sourceCpf || sourceCpf === contextCpf;
    const targetMatchesContext = !targetCpf || targetCpf === contextCpf;
    if (sourceMatchesContext && targetMatchesContext) return true;
  }

  const contextName = String(context.clientName || '').trim().toLowerCase();
  const sourceName = normalizeClientNameKey(source) || contextName;
  const targetName = normalizeClientNameKey(target);
  return Boolean(sourceName && targetName && sourceName === targetName);
}

export function isTicketAlreadyMergedSource(ticket) {
  const lf = ticket?.lateralForm || {};
  if (lf.mergedIntoTicketId) return true;
  const historico = ticket.registroHistorico || ticket.registroAlteracoes || [];
  return historico.some((entry) => entry?.metadados?.merge?.role === 'source');
}

export function isTicketMergeTargetEligible(source, target, context = {}) {
  if (!source || !target) return false;
  const sourceId = String(source.id || source._id);
  const targetId = String(target.id || target._id);
  if (sourceId === targetId) return false;
  if (isTicketTerminalStatus(target)) return false;
  if (isTicketAlreadyMergedSource(target)) return false;
  if (!ticketsBelongToSameClient(source, target, context)) return false;
  return true;
}

export function buildTicketMergeNote(source, target) {
  const sourceProto = getTicketProtocolLabel(source) || source.id || source._id;
  const targetProto = getTicketProtocolLabel(target) || target.id || target._id;
  return `O ticket #${sourceProto} foi mesclado ao chamado #${targetProto}.`;
}

export function copyTabulationFromTicket(source, target) {
  const targetLf = target?.lateralForm || {};
  const sourceLf = source?.lateralForm || {};
  const tabFields = {
    tipoChamado: targetLf.tipoChamado || targetLf.classificacaoTipo || targetLf.tipo || '',
    classificacaoTipo: targetLf.classificacaoTipo || targetLf.tipoChamado || targetLf.tipo || '',
    tipo: targetLf.tipo || targetLf.classificacaoTipo || targetLf.tipoChamado || '',
    produto: targetLf.produto || '',
    motivo: targetLf.motivo || '',
    detalhe: targetLf.detalhe || '',
    responsavel: targetLf.responsavel || target.responsibleAgent || '',
    atribuido: targetLf.atribuido || '',
  };
  return {
    ...source,
    responsibleAgent: tabFields.responsavel,
    lateralForm: {
      ...sourceLf,
      ...tabFields,
    },
  };
}

export function collectClientTickets(cpf, clientName) {
  const cpfDigits = normalizeCpf(cpf);
  const nameKey = (clientName || '').toLowerCase().trim();
  const seen = new Set();
  const list = [];

  getAllCockpitTickets().forEach(({ ticket: t }) => {
    const id = String(t.id || t._id);
    if (seen.has(id)) return;
    const tCpf = normalizeCpf(t.lateralForm?.clienteCpf || t.lateralForm?.cpf || t.clientCPF || '');
    const tName = (t.clientName || t.solicitante || '').toLowerCase();
    const titleMatch = nameKey && (t.title || '').toLowerCase().includes(nameKey);
    if ((cpfDigits && tCpf === cpfDigits) || (nameKey && (tName === nameKey || titleMatch))) {
      seen.add(id);
      list.push(t);
    }
  });

  list.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  return list;
}

function isSameDay(isoA, isoB) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function formatInternalNoteTimestamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isSameDay(iso, new Date().toISOString())) return `hoje · ${time}`;
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${date} · ${time}`;
}

export function formatRegistroOccurrenceTimestamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

const ALTERACAO_FIELD_LABELS = {
  tipoChamado: 'Tipo',
  classificacaoTipo: 'Tipo',
  produto: 'Produto',
  motivo: 'Motivo',
  detalhe: 'Detalhe',
  responsavel: 'Responsável',
  atribuido: 'Atribuído',
  escalonar: 'Escalonar',
  status: 'Status',
  workflowActivated: 'Workflow ativado',
  workflowStep: 'Passo workflow',
  passoNome: 'Passo workflow',
  workflowCompleted: 'Workflow concluído',
  workflowDecision: 'Decisão workflow',
  agentHandoff: 'Handoff agente',
  nivelCriticidade: 'Criticidade',
  auditScore: 'Score auditoria',
  origem: 'Origem',
  palavrasCriticas: 'Palavras críticas',
  trigger: 'Gatilho',
};

const ALTERACAO_STATE_ALIASES = {
  classificacaoTipo: 'tipoChamado',
};

function normalizeAlteracaoStateKey(key) {
  return ALTERACAO_STATE_ALIASES[key] || key;
}

function extractAlteracaoFields(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const rows = [];
  Object.entries(raw).forEach(([key, value]) => {
    if (key === 'status') return;
    const display = String(value ?? '').trim();
    if (!display) return;
    rows.push({
      key: normalizeAlteracaoStateKey(key),
      field: ALTERACAO_FIELD_LABELS[key] || ALTERACAO_FIELD_LABELS[normalizeAlteracaoStateKey(key)] || key,
      value: display,
    });
  });
  return rows;
}

function applyAlteracoesToTabulationState(state, alteracoes) {
  (alteracoes || []).forEach((raw) => {
    extractAlteracaoFields(raw).forEach(({ key, value }) => {
      state[key] = value;
    });
  });
  return state;
}

function collectRegistroOccurrenceData(entry, previousTabulationState = {}, prevStatus = null) {
  const tabulationChanges = [];
  const seen = new Set();

  (entry.alteracoes || []).forEach((raw) => {
    extractAlteracaoFields(raw).forEach(({ key, field, value }) => {
      const prevVal = String(previousTabulationState[key] ?? '').trim();
      if (prevVal === value) return;
      const token = `${field}:${prevVal}->${value}`;
      if (seen.has(token)) return;
      seen.add(token);
      tabulationChanges.push({
        field,
        value,
        previousValue: prevVal || undefined,
      });
    });
  });

  const hasAlteracoes = (entry.alteracoes || []).length > 0;
  const statusChanged = Boolean(
    entry.status
    && (
      (prevStatus !== null && String(entry.status) !== String(prevStatus))
      || (
        prevStatus === null
        && hasAlteracoes
        && String(entry.status).trim() !== ''
        && String(entry.status) !== 'novo'
      )
    )
  );
  const statusLabel = statusChanged ? getTicketStatusLabel(entry.status) : null;
  const previousStatusLabel = statusChanged && prevStatus
    ? getTicketStatusLabel(prevStatus)
    : null;

  return { tabulationChanges, statusLabel, previousStatusLabel, statusChanged };
}

function isAgentRegistroEntry(entry) {
  return String(entry.origin || 'agente').toLowerCase() !== 'cliente';
}

/** Supervisor: agente com anotação interna, diff de tabulação ou mudança de status */
function shouldShowSupervisorRegistroOccurrence(entry, previousTabulationState, prevStatus) {
  if (!isAgentRegistroEntry(entry)) return false;

  const hasInternal = Boolean(String(entry.anotacaoInterna ?? '').trim());
  const { tabulationChanges, statusChanged } = collectRegistroOccurrenceData(
    entry,
    previousTabulationState,
    prevStatus,
  );
  return hasInternal || tabulationChanges.length > 0 || statusChanged;
}

function mapSupervisorRegistroOccurrence(entry, ticket, client, previousTabulationState, prevStatus) {
  if (!shouldShowSupervisorRegistroOccurrence(entry, previousTabulationState, prevStatus)) return null;

  const ticketId = String(ticket.id || ticket._id);
  const author = resolveRegistroAutorLabel(entry, ticket, client);
  const {
    tabulationChanges,
    statusLabel,
    previousStatusLabel,
    statusChanged,
  } = collectRegistroOccurrenceData(entry, previousTabulationState, prevStatus);
  const internalExcerpt = String(entry.anotacaoInterna ?? '').trim();

  return {
    id: `${ticketId}:${entry.id}`,
    kind: 'registro',
    author,
    initials: getInitials(author),
    badge: 'Registro',
    timestamp: entry.time || entry.timestamp || ticket.updatedAt,
    tabulationChanges,
    statusLabel,
    previousStatusLabel,
    statusChanged,
    internalExcerpt,
    ticketId,
    ticketTitle: getTicketTitle(ticket),
  };
}

function buildAgentInternalNotesFeed(ticket) {
  const merged = [];
  const seen = new Set();

  normalizeTicketForDeskV2(ticket);

  (ticket.internalNotes || []).forEach((note) => {
    const mappedNote = mapAgentInternalNote(note, ticket);
    if (!mappedNote || seen.has(mappedNote.id)) return;
    seen.add(mappedNote.id);
    merged.push(mappedNote);
  });

  getWorkflowInfoRequestsForTicket(ticket).forEach((req) => {
    const id = req.id || `wf-req-${req.createdAt}`;
    if (seen.has(id)) return;
    seen.add(id);
    merged.push({
      id,
      kind: 'workflow',
      author: req.requestedBy || 'Workflow',
      initials: 'WF',
      badge: 'Pedido de info',
      timestamp: req.createdAt,
      body: `${req.message} (${req.stepLabel || 'Aprovação'})`,
      tags: ['Workflow'],
      ticketId: String(ticket.id || ticket._id),
      ticketTitle: getTicketTitle(ticket),
      boldSegments: [],
    });
  });

  merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return merged;
}

function isGenericRegistroAutorLabel(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return !normalized || normalized === 'agente' || normalized === 'agent';
}

function resolveRegistroAutorLabel(entry, ticket, client) {
  const stored = String(entry.autor ?? '').trim();
  if (stored && !isGenericRegistroAutorLabel(stored)) return stored;

  const origin = entry.origin || 'agente';
  if (origin === 'cliente') {
    return ticket?.clientName || ticket?.solicitante || client?.name || 'Cliente';
  }

  return getAgentName() || '—';
}

function buildSupervisorRegistroFeed(ticket, client) {
  const merged = [];
  const seen = new Set();
  const seenInternalOnly = new Set();

  normalizeTicketForDeskV2(ticket);
  const historico = ticket.registroHistorico || ticket.registroAlteracoes || [];
  const tabulationState = {};
  let prevStatus = null;
  historico.forEach((entry) => {
    const previousTabulationState = { ...tabulationState };
    const mapped = mapSupervisorRegistroOccurrence(
      entry,
      ticket,
      client,
      previousTabulationState,
      prevStatus,
    );
    if (mapped) {
      const internalOnly = Boolean(mapped.internalExcerpt)
        && !mapped.tabulationChanges?.length
        && !mapped.statusChanged;
      if (internalOnly) {
        const ts = Math.floor(new Date(mapped.timestamp || 0).getTime() / 1000);
        const dedupeKey = `${ts}:${mapped.internalExcerpt}`;
        if (seenInternalOnly.has(dedupeKey)) {
          applyAlteracoesToTabulationState(tabulationState, entry.alteracoes);
          if (entry.status) prevStatus = entry.status;
          return;
        }
        seenInternalOnly.add(dedupeKey);
      }
      if (!seen.has(mapped.id)) {
        seen.add(mapped.id);
        merged.push(mapped);
      }
    }
    applyAlteracoesToTabulationState(tabulationState, entry.alteracoes);
    if (entry.status) prevStatus = entry.status;
  });

  merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return merged;
}

/** Aba Notas: somente notas internas e pedidos workflow (sem registros/alterações). */
export function buildInternalNotesOnlyFeed(ticket) {
  if (!ticket) return [];
  return buildAgentInternalNotesFeed(ticket);
}

/** @deprecated Use buildInternalNotesOnlyFeed — mantido por compatibilidade. */
export function buildClientInternalNotesFeed(ticket) {
  return buildInternalNotesOnlyFeed(ticket);
}

function mapMessageToEventItem(m, ticket) {
  const origin = m.origin || (m.sender === 'them' ? 'cliente' : 'agente');
  const isClient = (
    origin === 'cliente'
    || m.fromClient === true
    || m.type === 'client'
    || m.sender === 'them'
  );
  const ts = m.timestamp || m.time || m.createdAt;
  const authorName = isClient
    ? (ticket.clientName || m.author || 'Cliente')
    : (m.author || getAgentName() || 'Agente');
  const rawText = String(m.text || m.message || '').trim();
  const looksLikeEmailReply = /escreveu:|wrote:|Original Message|^\s*>/m.test(rawText);
  const body = normalizeMessageDisplayText(
    isClient && looksLikeEmailReply
      ? extractEmailReplyContent(rawText)
      : rawText,
  );
  if (!body) return null;

  const ticketId = String(ticket.id || ticket._id);
  const msgId = m.id || `${ts}:${isClient ? 'in' : 'out'}`;
  return {
    id: `${ticketId}:${msgId}`,
    kind: isClient ? 'mensagem-recebida' : 'mensagem-enviada',
    author: authorName,
    initials: getInitials(authorName),
    badge: isClient ? 'Mensagem recebida' : 'Mensagem enviada',
    timestamp: ts,
    body,
    attachments: Array.isArray(m.attachments) ? m.attachments : [],
    ticketId,
    ticketTitle: getTicketTitle(ticket),
  };
}

function buildMessageEventsFeed(ticket) {
  if (!ticket) return [];

  normalizeTicketForDeskV2(ticket);
  const merged = [];
  const seen = new Set();

  (ticket.messages || []).forEach((m) => {
    if (!m || m.type === 'internal') return;
    if (m.type === 'system') return;
    const mapped = mapMessageToEventItem(m, ticket);
    if (!mapped || seen.has(mapped.id)) return;
    seen.add(mapped.id);
    merged.push(mapped);
  });

  return merged;
}

/** Aba Eventos: registros/gatilhos (visão gestão) + mensagens públicas enviadas/recebidas. */
export function buildTicketEventsFeed(ticket, client) {
  if (!ticket) return [];

  const registros = buildSupervisorRegistroFeed(ticket, client);
  const messages = buildMessageEventsFeed(ticket);
  if (!messages.length) return registros;

  return [...registros, ...messages].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  );
}

export function applySendStatus(entry, queueId) {
  const statusMap = {
    'em-andamento': { box: 'em-andamento', status: 'em-aberto' },
    pendente: { box: 'em-espera', status: 'pendente' },
    resolvidos: { box: 'resolvidos', status: 'resolvido' },
    cancelado: { box: 'resolvidos', status: 'cancelado' },
  };
  const cfg = statusMap[queueId] || statusMap['em-andamento'];
  entry.ticket.status = cfg.status;
  const targetBoxId = resolveDeskBoxColumnId(cfg.box);
  if (targetBoxId) {
    entry.ticket.boxId = targetBoxId;
  } else {
    delete entry.ticket.boxId;
  }
  moveTicketToBox(entry, targetBoxId || cfg.box);
}

function resolveDeskBoxColumnId(semanticBoxId) {
  const columns = getTicketColumns();
  const semantic = String(semanticBoxId || '').trim();
  if (!semantic) return null;

  const direct = columns.find((box) => box.id === semantic);
  if (direct) return direct.id;

  const nameMatchers = {
    novos: ['novo', 'novos'],
    'em-andamento': ['em andamento', 'em-aberto', 'em aberto', 'em-andamento'],
    'em-espera': ['pendente', 'em espera', 'em-espera', 'aguardando'],
    resolvidos: ['resolvido', 'resolvidos'],
  };
  const needles = nameMatchers[semantic] || [semantic];

  const byName = columns.find((box) => {
    const name = String(box.name || '').trim().toLowerCase();
    return needles.some((needle) => name === needle || name.includes(needle));
  });
  return byName?.id || semantic;
}

export function moveTicketToBox(entry, targetBoxId) {
  if (!entry || !targetBoxId) return;
  const columns = getTicketColumns();
  const ticket = entry.ticket;
  const ticketId = String(ticket.id);
  const resolvedTargetId = resolveDeskBoxColumnId(targetBoxId) || targetBoxId;

  columns.forEach((box) => {
    if (!box.tickets) return;
    box.tickets = box.tickets.filter((t) => String(t.id) !== ticketId && String(t._id) !== ticketId);
  });

  const target = columns.find((b) => b.id === resolvedTargetId)
    || columns.find((b) => String(b.name || '').trim().toLowerCase().includes(String(targetBoxId).toLowerCase()));
  if (!target) return;

  if (!target.tickets) target.tickets = [];
  target.tickets.push(ticket);
  saveTicketColumns(columns);
  entry.boxId = target.id;
  ticket.boxId = target.id;
}

export { getAgentName };
