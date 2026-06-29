/**
 * ticketAdapter v1.2.1 — normaliza ticket API ↔ cockpit + draft
 * VERSION: v1.2.1 | DATE: 2026-06-25 | AUTHOR: VeloHub Development Team
 */

function normalizeMessage(msg) {
  if (!msg) return msg;
  const isClient = msg.fromClient === true
    || msg.type === 'client'
    || (msg.type !== 'agent' && msg.type !== 'internal' && msg.sender === 'them');
  return {
    ...msg,
    text: msg.text || msg.message || '',
    timestamp: msg.timestamp || msg.time || msg.createdAt || new Date().toISOString(),
    fromClient: isClient,
    type: isClient ? 'client' : (msg.type === 'system' ? 'system' : 'agent'),
    author: msg.author || msg.sender || '',
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
  return {
    ...ticket,
    id,
    _id: id,
    title: ticket.title || ticket.chamadoTitulo || ticket.chamadoProtocolo || 'Sem título',
    chamadoTitulo: ticket.chamadoTitulo || ticket.title,
    status: ticket.status || 'novo',
    messages: (ticket.messages || []).map(normalizeMessage),
    internalNotes: (ticket.internalNotes || []).map(normalizeMessage),
    lateralForm: ticket.lateralForm || {},
    createdAt: ticket.createdAt || new Date().toISOString(),
    updatedAt: ticket.updatedAt || ticket.createdAt || new Date().toISOString(),
  };
}

export function adaptColumnsFromApi(columns) {
  return (columns || []).map((col) => ({
    ...col,
    tickets: (col.tickets || []).map(apiTicketToCockpit),
  }));
}

export function cockpitTicketToApi(ticket) {
  const lf = ticket.lateralForm || {};
  return {
    chamadoProtocolo: ticket.chamadoProtocolo,
    chamadoTitulo: ticket.chamadoTitulo || ticket.title,
    title: ticket.title,
    description: ticket.description,
    text: ticket.text || ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    channel: ticket.channel,
    source: ticket.source,
    boxId: ticket.boxId,
    clienteId: ticket.clienteId || lf.clienteId,
    clientName: ticket.clientName || ticket.solicitante || lf.clienteNome,
    clientCPF: ticket.clientCPF || lf.clienteCpf || lf.cpf,
    responsibleAgent: ticket.responsibleAgent || lf.responsavel,
    lateralForm: lf,
    formData: ticket.formData,
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
    clienteId: form.clienteId,
    clientName: form.clientName || lf.clienteNome,
    clientCPF: cpf,
    lateralForm: {
      cpf,
      clienteCpf: cpf,
      clienteNome: form.clientName || lf.clienteNome || '',
      clienteEmail: lf.clienteEmail ?? (form.clientEmail ? [form.clientEmail] : []),
      clienteTelefone: lf.clienteTelefone ?? (form.clientPhone ? [form.clientPhone] : []),
      clienteId: form.clienteId || lf.clienteId,
      canal: form.channel || lf.canal,
      classificacaoTipo: form.tipo || lf.classificacaoTipo,
      produto: form.produto || lf.produto,
      motivo: form.motivo || lf.motivo,
      responsavel: (form.atribuir || lf.responsavel || '').replace(' (eu)', ''),
      detalhe: lf.detalhe || form.detalhe || '',
      escalonar: lf.escalonar,
      wasEscalated: lf.wasEscalated,
      lastWorkflow: lf.lastWorkflow,
      retornoN1: lf.retornoN1,
    },
  };
}

export function generateProtocolo() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `VD-${stamp}-${suffix}`;
}
