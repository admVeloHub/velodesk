/**
 * ticketAdapter v1.4.3 — responsavel explícito no payload lateralForm
 * VERSION: v1.4.3 | DATE: 2026-07-06 | AUTHOR: VeloHub Development Team
 */
import { getAgentName } from '../../services/clientDb';
import { DEFAULT_TIPO } from '../../services/tabulationConfig';

const MEUS_CHAMADOS_BOX_MAP = {
  'meus-novos': 'novos',
  'meus-em-aberto': 'em-andamento',
  'meus-em-andamento': 'em-andamento',
  'meus-pendente': 'em-espera',
};

const DEFAULT_KANBAN_BOXES = [
  { id: 'novos', name: 'Novos', tickets: [] },
  { id: 'em-andamento', name: 'Em Andamento', tickets: [] },
  { id: 'em-espera', name: 'Pendente', tickets: [] },
  { id: 'pendentes', name: 'Aguardando retorno', tickets: [] },
  { id: 'resolvidos', name: 'Resolvidos', tickets: [] },
];

function normalizeMessage(msg) {
  if (!msg) return msg;
  const isInternal = msg.type === 'internal';
  const isClient = !isInternal && (
    msg.fromClient === true
    || msg.type === 'client'
    || msg.origin === 'cliente'
    || (msg.type !== 'agent' && msg.sender === 'them')
  );
  return {
    ...msg,
    text: msg.text || msg.message || '',
    timestamp: msg.timestamp || msg.time || msg.createdAt || new Date().toISOString(),
    origin: msg.origin || (msg.sender === 'them' ? 'cliente' : 'agente'),
    fromClient: isClient,
    type: isInternal ? 'internal' : (isClient ? 'client' : (msg.type === 'system' ? 'system' : 'agent')),
    author: msg.author || (isInternal ? '' : msg.sender) || '',
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
    registroHistorico: (ticket.registroHistorico || ticket.registroAlteracoes || []).map((entry) => ({
      ...entry,
      autor: entry.autor ?? entry.author ?? '',
      time: entry.time || entry.timestamp,
      timestamp: entry.timestamp || entry.time,
    })),
    lateralForm: ticket.lateralForm || {},
    createdAt: ticket.createdAt || new Date().toISOString(),
    updatedAt: ticket.updatedAt || ticket.createdAt || new Date().toISOString(),
  };
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
  const merged = DEFAULT_KANBAN_BOXES.map((box) => ({ ...box, tickets: [] }));

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
  const lf = ticket.lateralForm || {};
  const emailList = lf.clienteEmail ?? (ticket.clientEmail ? [ticket.clientEmail] : []);
  const phoneList = lf.clienteTelefone ?? (ticket.clientPhone ? [ticket.clientPhone] : []);
  const clientName = ticket.clientName || ticket.solicitante || lf.clienteNome;
  const tipo = String(lf.tipoChamado || lf.classificacaoTipo || DEFAULT_TIPO).trim() || DEFAULT_TIPO;
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
    clientName,
    clientCPF: ticket.clientCPF || lf.clienteCpf || lf.cpf,
    responsibleAgent: ticket.responsibleAgent || lf.responsavel,
    author: ticket.author || getAgentName() || undefined,
    lateralForm: {
      ...lf,
      classificacaoTipo: tipo,
      tipoChamado: tipo,
      responsavel: String(lf.responsavel ?? ticket.responsibleAgent ?? '').trim(),
      cpf: ticket.clientCPF || lf.clienteCpf || lf.cpf,
      clienteCpf: ticket.clientCPF || lf.clienteCpf || lf.cpf,
      clienteNome: clientName || '',
      clienteEmail: emailList,
      clienteTelefone: phoneList,
      clienteId: ticket.clienteId || lf.clienteId,
    },
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
  throw new Error('generateProtocolo() é responsabilidade do backend — use chamadoProtocolo da API.');
}
