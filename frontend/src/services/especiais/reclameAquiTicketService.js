/**
 * reclameAquiTicketService — bridge Reclame Aqui ↔ API tickets
 */
import { ticketsApi } from '../../api/client';
import { apiTicketToCockpit } from '../../api/adapters/ticketAdapter';
import { getAgentName } from '../clientDb';
import { createWorkflowState, getWorkflowTemplateById } from '../desk/workflowEngine';
import { RA_STATUS } from './reclameAquiData';
import {
  buildRegistroDefaults,
  registerReclamacao,
  getReclamacaoById,
} from './reclameAquiStore';

const RA_WORKFLOW_SLUG = 'reclame-aqui-tratativa';

function normalizeCpf(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildReclameAquiMeta(form) {
  const defaults = buildRegistroDefaults(form);
  return {
    protocoloRa: defaults.protocoloRa,
    idReclamacaoRa: defaults.idReclamacaoRa || defaults.protocoloRa,
    statusRa: RA_STATUS.NAO_RESPONDIDA,
    prazoRa: defaults.prazoRa,
    dataReclamacao: defaults.dataReclamacao,
    passivelNota: defaults.passivelNota,
    assunto: defaults.assunto,
    descricao: defaults.descricao,
    consumidor: defaults.consumidor,
    cpf: defaults.cpf,
    produto: defaults.produto,
    tipo: defaults.tipo,
    motivo: defaults.motivo,
    urlRa: defaults.urlRa || '',
  };
}

export function buildTicketPayloadFromReclamacao(form, workflow = null) {
  const meta = buildReclameAquiMeta(form);
  const cpf = normalizeCpf(form.cpf);
  const author = getAgentName();

  return {
    chamadoTitulo: String(form.assunto || '').trim() || 'Reclamação Reclame Aqui',
    title: String(form.assunto || '').trim() || 'Reclamação Reclame Aqui',
    text: String(form.descricao || '').trim(),
    description: String(form.descricao || '').trim(),
    status: 'novo',
    clientName: String(form.consumidor || '').trim(),
    clientCPF: cpf || undefined,
    author,
    lateralForm: {
      classificacaoTipo: form.tipo || 'Reclamação',
      tipoChamado: form.tipo || 'Reclamação',
      produto: form.produto || '',
      motivo: form.motivo || form.assunto || '',
      detalhe: 'Reclamação Reclame Aqui',
      canal: 'Reclame Aqui',
      responsavel: author,
      clienteCpf: cpf,
      cpf,
      clienteNome: form.consumidor || '',
      clienteTelefone: form.telefoneWhatsapp ? [form.telefoneWhatsapp] : [],
      clienteEmail: form.email ? [form.email] : [],
      reclameAqui: meta,
      workflow: workflow || undefined,
    },
  };
}

function buildFallbackRaWorkflow() {
  const now = new Date().toISOString();
  const author = getAgentName() || 'sistema';
  return {
    templateId: RA_WORKFLOW_SLUG,
    definicaoSlug: RA_WORKFLOW_SLUG,
    title: 'TRATATIVA RECLAME AQUI',
    currentStepId: 'ra-triagem',
    step: 0,
    startedAt: now,
    stepHistory: [{
      stepId: 'ra-triagem',
      status: 'active',
      at: now,
      by: author,
      trigger: 'reclame-aqui-register',
    }],
    status: 'active',
    systemMessageInjected: false,
  };
}

export function buildRaWorkflowState() {
  const template = getWorkflowTemplateById(RA_WORKFLOW_SLUG);
  if (template) {
    return createWorkflowState(template, {
      by: getAgentName() || 'sistema',
      trigger: 'reclame-aqui-register',
    });
  }
  return buildFallbackRaWorkflow();
}

export async function createTicketFromReclamacao(form, workflow) {
  const payload = buildTicketPayloadFromReclamacao(form, workflow);
  const created = await ticketsApi.create(payload);
  return apiTicketToCockpit(created);
}

export async function activateRaWorkflow(ticketId, form) {
  const workflow = buildRaWorkflowState();
  const author = getAgentName();
  const updated = await ticketsApi.update(ticketId, {
    author,
    lateralForm: {
      workflow,
      canal: 'Reclame Aqui',
      reclameAqui: buildReclameAquiMeta(form),
    },
  });
  return apiTicketToCockpit(updated);
}

export async function registerReclamacaoAndCreateTicket(form) {
  const workflow = buildRaWorkflowState();
  const payload = buildTicketPayloadFromReclamacao(form, workflow);
  const created = await ticketsApi.create(payload);
  const ticket = apiTicketToCockpit(created);
  const ticketId = String(ticket.id || ticket._id);

  const publicText = String(form.respostaPublica || '').trim();
  if (publicText) {
    await ticketsApi.addMessage(ticketId, {
      text: publicText,
      author: getAgentName(),
      sender: 'me',
    });
  }

  const raItem = registerReclamacao({
    ...form,
    ticketId,
    chamadoProtocolo: ticket.chamadoProtocolo,
    workflowAtivo: true,
    workflow: 'Tratativa RA',
    statusRa: RA_STATUS.NAO_RESPONDIDA,
  });

  return {
    id: raItem.id,
    ticketId,
    raItem,
    ticket,
  };
}

export async function fetchRaTicketView(raId) {
  const raItem = getReclamacaoById(raId);
  if (!raItem) return null;

  if (!raItem.ticketId) {
    return { raItem, ticket: null };
  }

  const raw = await ticketsApi.get(raItem.ticketId);
  const ticket = apiTicketToCockpit(raw);
  const apiRa = ticket.lateralForm?.reclameAqui;

  return {
    raItem: {
      ...raItem,
      ...(apiRa && typeof apiRa === 'object' ? apiRa : {}),
      ticketId: raItem.ticketId,
      chamadoProtocolo: ticket.chamadoProtocolo || raItem.chamadoProtocolo,
    },
    ticket,
  };
}

export async function sendRaWaMessage(ticketId, text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  await ticketsApi.addMessage(ticketId, {
    text: trimmed,
    author: getAgentName(),
    sender: 'me',
  });
  const raw = await ticketsApi.get(ticketId);
  return apiTicketToCockpit(raw);
}

export async function publishRaPublicResponse(ticketId, text) {
  await ticketsApi.addMessage(ticketId, {
    text: String(text || '').trim(),
    author: getAgentName(),
    sender: 'me',
  });
  const raw = await ticketsApi.get(ticketId);
  return apiTicketToCockpit(raw);
}

export async function saveRaInternalNote(ticketId, text) {
  await ticketsApi.addMessage(ticketId, {
    internalText: String(text || '').trim(),
    text: '',
    author: getAgentName(),
    sender: 'me',
  });
  const raw = await ticketsApi.get(ticketId);
  return apiTicketToCockpit(raw);
}

export function getRaThreadMessages(ticket, raItem) {
  const messages = ticket?.messages || [];
  if (!messages.length) return [];

  const complaintText = String(raItem?.descricao || messages[0]?.text || '').trim();
  return messages.filter((msg, index) => {
    if (index === 0 && msg.fromClient && String(msg.text || '').trim() === complaintText) {
      return false;
    }
    return Boolean(String(msg.text || '').trim());
  });
}

export function formatRaDeadlineLabel(iso) {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Prazo vencido';
  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) {
    return `${days} dia${days > 1 ? 's' : ''} e ${hours} hora${hours !== 1 ? 's' : ''}`;
  }
  return `${hours} hora${hours !== 1 ? 's' : ''}`;
}
