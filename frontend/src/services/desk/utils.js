/**
 * Desk CRM — utilitários de fila e conversa
 * VERSION: v3.0.1 | DATE: 2026-07-14
 */
import { getTicketColumns, saveTicketColumns, getAllCockpitTickets } from '../ticketsStorage';
import { getWorkflowInfoRequestsForTicket } from '../workflow/workflowInfoNotifications';
import { ticketMatchesAgentResponsavel } from './responsavelSegmentation';
import { lookupClient, getAgentName } from '../clientDb';
import {
  advanceWorkflowStep,
  advanceWorkflowByDecision,
  buildEscalonarWorkflowTemplate,
  buildWorkflowAdvanceMessage,
  createWorkflowState,
  evaluateWorkflowAutoAdvance,
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
  if (lf.motivo) tags.push(repairUtf8Mojibake(lf.motivo));
  if (!tags.length && ticket.priority) tags.push(ticket.priority);
  return tags.slice(0, 4);
}

export function getClientContactFields(ticket, client) {
  const lf = ticket?.lateralForm || {};
  const emails = lf.clienteEmail;
  const phones = lf.clienteTelefone;
  const emailFromLf = Array.isArray(emails) ? emails[0] : emails?.lista?.[0];
  const phoneFromLf = Array.isArray(phones) ? phones[0] : phones?.lista?.[0];
  return {
    name: lf.clienteNome || ticket?.clientName || ticket?.solicitante || client?.name || '',
    cpf: formatCpf(lf.clienteCpf || lf.cpf || ticket?.clientCPF || client?.cpf || ''),
    email: emailFromLf || ticket?.clientEmail || client?.email || '',
    phone: phoneFromLf || ticket?.clientPhone || client?.telefone || '',
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

export function getTicketOperationProgress(ticket, queueId, liveEscalonar) {
  const lf = ticket?.lateralForm || {};
  const escalonar = liveEscalonar !== undefined ? liveEscalonar : lf.escalonar;
  const group = String(ticket?.group || '').toLowerCase();
  const resolved = queueId === 'resolvidos' || ticket?.status === 'resolvido';
  const workflowArea = resolveWorkflowArea(escalonar, group, lf.lastWorkflow);
  const inWorkflow = Boolean(escalonar);
  const retornoN1 = lf.retornoN1 === true || (lf.wasEscalated && !escalonar && !resolved);

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

export function isTicketInWorkflow(ticket) {
  const wf = ticket?.lateralForm?.workflow;
  return Boolean(wf?.templateId || wf?.definicaoSlug);
}

export function getWorkflowTemplateForTicket(ticket) {
  const wf = ticket?.lateralForm?.workflow;
  const templateKey = wf?.templateId || wf?.definicaoSlug;
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
  const workflow = ticket?.lateralForm?.workflow;
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

  const stepsWithState = template.steps.map((step, index) => {
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
  const agentRetainsTicket = Boolean(ticket?.lateralForm?.agentRetainsTicket);

  return {
    workflow,
    template,
    activeStepIndex,
    activeStep,
    stepsWithState,
    slaRemainingMs,
    slaRemainingLabel: slaRemainingMs != null ? formatDurationMs(slaRemainingMs) : null,
    slaTotalHours,
    externalTeamActive,
    awaitingTeamLabel: externalTeamActive ? getWorkflowTeamLabel(activeStep.team) : null,
    composeLocked: Boolean(externalTeamActive && !agentRetainsTicket),
  };
}

export function buildWorkflowSystemMessage(template, escalonar) {
  if (escalonar) {
    return `Workflow **${template.title}** iniciado após encaminhamento do ticket.`;
  }
  return `Workflow **${template.title}** iniciado automaticamente com base na classificação do ticket.`;
}

function getWorkflowInstanceKey(workflow) {
  return workflow?.templateId || workflow?.definicaoSlug || '';
}

export function maybeActivateWorkflowForTicket(ticket, rightFields, escalonar, author) {
  const lf = ticket.lateralForm || {};
  if (getWorkflowInstanceKey(lf.workflow)) {
    return { activated: false, workflow: lf.workflow, template: getWorkflowTemplateForTicket(ticket) };
  }

  let template = resolveWorkflowForTicket(ticket, rightFields);
  if (!template && escalonar) {
    template = buildEscalonarWorkflowTemplate(escalonar);
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

/** Ativa workflow no encaminhamento/commit — avanço de etapa só via botão/API */
export function syncTicketWorkflowOnCommit(ticket, rightFields, escalonar, _statusId, author) {
  if (!ticket) return { activated: false, advanced: false };

  const lf = ticket.lateralForm || {};
  let workflow = lf.workflow;
  let template = getWorkflowTemplateForTicket(ticket);
  let activated = false;

  if (!getWorkflowInstanceKey(workflow)) {
    const activation = maybeActivateWorkflowForTicket(ticket, rightFields, escalonar, author);
    if (activation.activated && activation.workflow && activation.template) {
      workflow = activation.workflow;
      template = activation.template;
      activated = true;
      if (activation.atribuido) {
        ticket.lateralForm = { ...lf, atribuido: activation.atribuido };
      }
    }
  }

  if (workflow) {
    ticket.lateralForm = { ...(ticket.lateralForm || lf), workflow, escalonar: escalonar || lf.escalonar };
  }

  if (activated && template) {
    injectWorkflowSystemMessage(ticket, template, escalonar);
  }

  return { activated, advanced: false, workflow, template };
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

export function injectWorkflowSystemMessage(ticket, template, escalonar) {
  if (!ticket || !template) return ticket;
  const lf = ticket.lateralForm || {};
  if (lf.workflow?.systemMessageInjected) return ticket;

  const text = buildWorkflowSystemMessage(template, escalonar);
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

export function sortTicketEntries(entries, activeSort) {
  return [...entries].sort((a, b) => {
    if (activeSort === 'prioridade') {
      const prio = { critica: 0, alta: 1, normal: 2, baixa: 3 };
      return (prio[a.ticket.priority] || 9) - (prio[b.ticket.priority] || 9);
    }
    if (activeSort === 'sla') {
      return (a.ticket.slaRemaining || 999) - (b.ticket.slaRemaining || 999);
    }
    return new Date(b.ticket.updatedAt || 0) - new Date(a.ticket.updatedAt || 0);
  });
}

export function filterTickets(activeQueue, searchQuery, activeSort) {
  const q = (searchQuery || '').toLowerCase();
  const filtered = getAllCockpitTickets()
    .filter((entry) => {
      if (entry.queueId !== activeQueue) return false;
      if (!ticketMatchesAgentResponsavel(entry.ticket)) return false;
      if (!q) return true;
      const t = entry.ticket;
      const cpf = normalizeCpf(t.lateralForm?.cpf || t.clientCPF || '');
      const hay = [t.id, t.title, t.description, t.clientName, t.solicitante, cpf, formatCpf(cpf)].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  return sortTicketEntries(filtered, activeSort);
}

/** Busca global por Enter: número do ticket ou todos os tickets do CPF. */
export function resolveDeskSearchEntries(rawQuery, activeSort) {
  const trimmed = String(rawQuery || '').trim();
  if (!trimmed) return [];

  const digits = normalizeCpf(trimmed.replace(/^#/, ''));
  const all = getAllCockpitTickets();

  if (digits.length === 11) {
    const byCpf = all.filter(({ ticket: t }) => {
      if (!ticketMatchesAgentResponsavel(t)) return false;
      const tCpf = normalizeCpf(t.lateralForm?.cpf || t.clientCPF || '');
      return tCpf === digits;
    });
    return sortTicketEntries(byCpf, activeSort);
  }

  const idQuery = trimmed.replace(/^#/, '').trim();
  const idDigits = digits;

  if (idDigits.length >= 4) {
    const exact = all.filter(({ ticket: t }) => {
      if (!ticketMatchesAgentResponsavel(t)) return false;
      return String(t.id) === idQuery || String(t.id) === idDigits;
    });
    if (exact.length) return sortTicketEntries(exact, activeSort);

    const partial = all.filter(({ ticket: t }) => {
      if (!ticketMatchesAgentResponsavel(t)) return false;
      return String(t.id).includes(idDigits);
    });
    if (partial.length) return sortTicketEntries(partial, activeSort);
  }

  if (idQuery.length >= 3) {
    const loose = all.filter(({ ticket: t }) => {
      if (!ticketMatchesAgentResponsavel(t)) return false;
      const hay = [t.id, t.title, t.clientName, t.solicitante].join(' ').toLowerCase();
      return hay.includes(idQuery.toLowerCase());
    });
    if (loose.length) return sortTicketEntries(loose, activeSort);
  }

  return [];
}

export function countByQueue(queueId) {
  return getAllCockpitTickets().filter((e) => e.queueId === queueId && ticketMatchesAgentResponsavel(e.ticket)).length;
}

export function pickDefaultTicket(activeQueue) {
  const list = filterTickets(activeQueue || 'em-andamento', '', 'data');
  if (list.length) return list[0].ticket.id;
  const all = getAllCockpitTickets();
  return all[0]?.ticket?.id ?? null;
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
          text: String(m.text || m.message || '').trim(),
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
    return {
      type: bubbleType,
      initials: getInitials(isClient ? ticket.clientName || m.author : authorName),
      text: String(m.text || m.message || '').trim(),
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

export function collectClientTickets(cpf, clientName) {
  const cpfDigits = normalizeCpf(cpf);
  const nameKey = (clientName || '').toLowerCase().trim();
  const seen = new Set();
  const list = [];

  getAllCockpitTickets().forEach(({ ticket: t }) => {
    const id = String(t.id || t._id);
    if (seen.has(id)) return;
    const tCpf = normalizeCpf(t.lateralForm?.cpf || t.clientCPF || '');
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

  const statusChanged = Boolean(
    entry.status
    && prevStatus !== null
    && String(entry.status) !== String(prevStatus)
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
  const historico = ticket.registroHistorico || ticket.registroAlteracoes || [];
  historico.forEach((entry) => {
    if (!isAgentRegistroEntry(entry)) return;
    const text = String(entry.anotacaoInterna ?? '').trim();
    if (!text) return;

    const mapped = {
      id: `${ticket.id || ticket._id}:${entry.id}`,
      kind: 'agent',
      author: resolveRegistroAutorLabel(entry, ticket, null),
      initials: getInitials(resolveRegistroAutorLabel(entry, ticket, null)),
      badge: 'Interna',
      timestamp: entry.time || entry.timestamp || ticket.updatedAt,
      body: text,
      tags: [],
      ticketId: String(ticket.id || ticket._id),
      ticketTitle: getTicketTitle(ticket),
      boldSegments: [],
    };
    if (seen.has(mapped.id)) return;
    seen.add(mapped.id);
    merged.push(mapped);
  });

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
    if (mapped && !seen.has(mapped.id)) {
      seen.add(mapped.id);
      merged.push(mapped);
    }
    applyAlteracoesToTabulationState(tabulationState, entry.alteracoes);
    if (entry.status) prevStatus = entry.status;
  });

  merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return merged;
}

export function buildClientInternalNotesFeed(ticket, client, options = {}) {
  const { supervisorView = false } = options;
  if (!ticket) return [];

  if (supervisorView) {
    return buildSupervisorRegistroFeed(ticket, client);
  }

  return buildAgentInternalNotesFeed(ticket);
}

export function applySendStatus(entry, queueId) {
  const statusMap = {
    'em-andamento': { box: 'em-andamento', status: 'em-aberto' },
    pendente: { box: 'em-espera', status: 'pendente' },
    resolvidos: { box: 'resolvidos', status: 'resolvido' },
  };
  const cfg = statusMap[queueId] || statusMap['em-andamento'];
  entry.ticket.status = cfg.status;
  delete entry.ticket.boxId;
  moveTicketToBox(entry, cfg.box);
}

export function moveTicketToBox(entry, targetBoxId) {
  if (!entry || !targetBoxId) return;
  const columns = getTicketColumns();
  const ticket = entry.ticket;
  const ticketId = String(ticket.id);
  columns.forEach((box) => {
    if (!box.tickets) return;
    box.tickets = box.tickets.filter((t) => String(t.id) !== ticketId && String(t._id) !== ticketId);
  });
  const target = columns.find((b) => b.id === targetBoxId);
  if (!target) return;
  if (!target.tickets) target.tickets = [];
  target.tickets.push(ticket);
  saveTicketColumns(columns);
  entry.boxId = targetBoxId;
}

export { getAgentName };
