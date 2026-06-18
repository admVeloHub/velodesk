/**
 * ticketAdapter v1.0.0 — normaliza ticket API ↔ cockpit
 * VERSION: v1.0.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team
 */

function normalizeMessage(msg) {
  if (!msg) return msg;
  const isClient = msg.fromClient || msg.type === 'client' || msg.sender === 'them' || msg.type === 'public';
  return {
    ...msg,
    text: msg.text || msg.message || '',
    timestamp: msg.timestamp || msg.time || msg.createdAt || new Date().toISOString(),
    fromClient: isClient,
    type: isClient ? 'client' : (msg.type === 'system' ? 'system' : 'agent'),
    author: msg.author || msg.sender || '',
  };
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
  const id = ticket._id || ticket.id;
  return {
    chamadoProtocolo: ticket.chamadoProtocolo,
    chamadoTitulo: ticket.chamadoTitulo || ticket.title,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    channel: ticket.channel,
    source: ticket.source,
    boxId: ticket.boxId,
    clientName: ticket.clientName || ticket.solicitante,
    clientCPF: ticket.clientCPF,
    responsibleAgent: ticket.responsibleAgent || ticket.lateralForm?.responsavel,
    lateralForm: ticket.lateralForm,
    formData: ticket.formData,
  };
}

export function buildCreatePayload(form) {
  return {
    chamadoTitulo: form.assunto || form.title,
    title: form.assunto || form.title,
    description: form.descricao || form.description || form.assunto,
    text: form.descricao || form.description || form.assunto,
    status: 'novo',
    channel: form.channel,
    clientName: form.clientName,
    clientCPF: form.clientCPF,
    lateralForm: {
      cpf: (form.clientCPF || '').replace(/\D/g, ''),
      canal: form.channel,
      classificacaoTipo: form.tipo,
      produto: form.produto,
      motivo: form.motivo,
      responsavel: (form.atribuir || '').replace(' (eu)', ''),
    },
  };
}

export function generateProtocolo() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `VD-${stamp}-${suffix}`;
}
