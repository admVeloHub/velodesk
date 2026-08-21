/**
 * ticketAdapter v1.8.0 — origin sistema / e-mail padrão → bolha system
 * VERSION: v1.8.0 | DATE: 2026-08-21
 */
import { getAgentName } from '../../services/clientDb';
import { stripPendingWorkflowForApiPayload } from '../../services/desk/pendingWorkflowStart';
import { applyResponsavelDisplayToTicket } from '../../services/desk/responsavelDisplay';
import { DEFAULT_TIPO, sanitizeResponsavel } from '../../services/tabulationConfig';
import { repairUtf8Mojibake } from '../../services/desk/utils';

const MEUS_CHAMADOS_BOX_MAP = {
  'meus-novos': 'novos',
  'meus-em-aberto': 'em-andamento',
  'meus-em-andamento': 'em-andamento',
  'meus-pendente': 'em-espera',
  'meus-resolvidos': 'resolvidos',
};

const DEFAULT_BOXES = [
  { id: 'novos', name: 'Novos', tickets: [] },
  { id: 'em-andamento', name: 'Em Andamento', tickets: [] },
  { id: 'em-espera', name: 'Pendente', tickets: [] },
  { id: 'pendentes', name: 'Aguardando retorno', tickets: [] },
  { id: 'resolvidos', name: 'Resolvidos', tickets: [] },
];

function normalizeMessage(msg) {
  if (!msg) return msg;
  const isInternal = msg.type === 'internal';
  const isSystem = !isInternal && (
    msg.type === 'system'
    || msg.origin === 'sistema'
    || msg.sender === 'system'
    || Boolean(msg.metadados?.emailPadraoId)
    || String(msg.author || msg.autor || '').trim().toLowerCase() === 'e-mail padrão'
  );
  const isClient = !isInternal && !isSystem && (
    msg.fromClient === true
    || msg.type === 'client'
    || msg.origin === 'cliente'
    || (msg.type !== 'agent' && msg.sender === 'them')
  );
  return {
    ...msg,
    text: repairUtf8Mojibake(msg.text || msg.message || ''),
    timestamp: msg.timestamp || msg.time || msg.createdAt || '',
    origin: msg.origin || (isSystem ? 'sistema' : (msg.sender === 'them' ? 'cliente' : 'agente')),
    fromClient: isClient,
    type: isInternal ? 'internal' : (isSystem ? 'system' : (isClient ? 'client' : 'agent')),
    author: msg.author || (isInternal ? '' : msg.sender) || '',
    deliveryStatus: msg.deliveryStatus,
    deliveryErrorMessage: msg.deliveryErrorMessage,
  };
}

export function isDraftTicket(ticket) {
  if (!ticket) return false;
  if (ticket.isDraft === true) return true;
  const id = String(ticket._id || ticket.id || '');
  return id.startsWith('draft-');
}

export function apiTicketToCockpit(ticket) {
  if (!ticket) return ticket;
  const id = ticket._id || ticket.id;
  const lf = ticket.lateralForm || {};
  const clienteId = ticket.clienteId || lf.clienteId;
  const title = repairUtf8Mojibake(
    ticket.title || ticket.chamadoTitulo || ticket.chamadoProtocolo || 'Sem título',
  );
  return applyResponsavelDisplayToTicket({
    ...ticket,
    id,
    _id: id,
    clienteId,
    title,
    workflow: ticket.workflow,
    chamadoTitulo: repairUtf8Mojibake(ticket.chamadoTitulo || ticket.title || title),
    status: ticket.status || 'novo',
    messages: (ticket.messages || []).map(normalizeMessage),
    internalNotes: (ticket.internalNotes || []).map(normalizeMessage),
    registroHistorico: (ticket.registroHistorico || ticket.registroAlteracoes || []).map((entry) => ({
      ...entry,
      autor: entry.autor ?? entry.author ?? '',
      time: entry.time || entry.timestamp,
      timestamp: entry.timestamp || entry.time,
    })),
    lateralForm: {
      ...lf,
      clienteId: clienteId || lf.clienteId,
    },
    createdAt: ticket.createdAt || new Date().toISOString(),
    updatedAt: ticket.updatedAt || ticket.createdAt || new Date().toISOString(),
    listOnly: ticket.listOnly === true,
    queueEntryAt: ticket.queueEntryAt,
  });
}

export function adaptColumnsFromApi(columns, options = {}) {
  if (options.fila === 'meus-chamados') {
    return adaptMeusChamadosColumns(columns);
  }
  return (columns || []).map((col) => ({
    ...col,
    tickets: (col.tickets || []).map(apiTicketToCockpit),
  }));
}

function adaptMeusChamadosColumns(columns) {
  const merged = DEFAULT_BOXES.map((box) => ({ ...box, tickets: [] }));

  (columns || []).forEach((col) => {
    const targetId = MEUS_CHAMADOS_BOX_MAP[col.id];
    if (!targetId) return;
    const target = merged.find((box) => box.id === targetId);
    if (!target) return;
    target.tickets.push(...(col.tickets || []).map(apiTicketToCockpit));
  });

  return merged;
}

export function cockpitTicketToApi(ticket) {
  const safe = stripPendingWorkflowForApiPayload(ticket);
  const lf = safe.lateralForm || {};
  const emailList = lf.clienteEmail ?? (safe.clientEmail ? [safe.clientEmail] : []);
  const replyEmail = lf.clienteEmailResposta
    || (emailList.length === 1 ? emailList[0] : undefined)
    || safe.clientEmail
    || undefined;
  const phoneList = lf.clienteTelefone ?? (safe.clientPhone ? [safe.clientPhone] : []);
  const clientName = safe.clientName || safe.solicitante || lf.clienteNome;
  const tipo = String(lf.tipoChamado || lf.classificacaoTipo || DEFAULT_TIPO).trim() || DEFAULT_TIPO;
  const responsavel = sanitizeResponsavel(lf.responsavel) || sanitizeResponsavel(safe.responsibleAgent);
  return {
    chamadoProtocolo: safe.chamadoProtocolo,
    chamadoTitulo: safe.chamadoTitulo || safe.title,
    title: safe.title,
    description: safe.description,
    text: safe.text || safe.description,
    status: safe.status,
    priority: safe.priority,
    channel: safe.channel,
    source: safe.source,
    messageOrigin: safe.messageOrigin,
    boxId: safe.boxId,
    clienteId: safe.clienteId || lf.clienteId,
    clientName,
    clientCPF: safe.clientCPF || lf.clienteCpf || lf.cpf,
    responsibleAgent: responsavel,
    author: safe.author || getAgentName() || undefined,
    lateralForm: {
      ...lf,
      classificacaoTipo: tipo,
      tipoChamado: tipo,
      responsavel,
      cpf: safe.clientCPF || lf.clienteCpf || lf.cpf,
      clienteCpf: safe.clientCPF || lf.clienteCpf || lf.cpf,
      clienteNome: clientName || '',
      clienteEmail: emailList,
      clienteEmailResposta: replyEmail,
      clienteTelefone: phoneList,
      clienteTelefoneWhatsapp: lf.clienteTelefoneWhatsapp || safe.clientPhone || phoneList[0] || undefined,
      clienteId: safe.clienteId || lf.clienteId,
      ...(lf.workflow ? { workflow: lf.workflow } : {}),
    },
    formData: safe.formData,
  };
}

export function buildCreatePayload(form) {
  const title = String(form.title ?? form.assunto ?? '').trim();
  const description = String(form.descricao ?? form.description ?? '').trim();
  const cpf = String(form.clientCPF || form.lateralForm?.clienteCpf || form.lateralForm?.cpf || '').replace(/\D/g, '');
  const lf = form.lateralForm || {};
  return {
    chamadoTitulo: title,
    title,
    description,
    text: form.text ?? description,
    status: form.status || 'novo',
    channel: form.channel || lf.canal,
    messageOrigin: form.messageOrigin,
    clienteId: form.clienteId,
    clientName: form.clientName || lf.clienteNome,
    clientCPF: cpf,
    lateralForm: {
      cpf,
      clienteCpf: cpf,
      clienteNome: form.clientName || lf.clienteNome || '',
      clienteEmail: lf.clienteEmail ?? (form.clientEmail ? [form.clientEmail] : []),
      clienteEmailResposta: lf.clienteEmailResposta || form.clientEmail || undefined,
      clienteTelefone: lf.clienteTelefone ?? (form.clientPhone ? [form.clientPhone] : []),
      clienteId: form.clienteId || lf.clienteId,
      canal: form.channel || lf.canal,
      classificacaoTipo: form.tipo || lf.classificacaoTipo,
      produto: form.produto || lf.produto,
      motivo: form.motivo || lf.motivo,
      responsavel: (form.atribuir || lf.responsavel || '').replace(' (eu)', ''),
      detalhe: lf.detalhe || form.detalhe || '',
      workflow: lf.workflow,
    },
  };
}

export function generateProtocolo() {
  throw new Error('generateProtocolo() é responsabilidade do backend — use chamadoProtocolo da API.');
}
