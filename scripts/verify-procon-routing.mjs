/**
 * Verificação rápida do roteamento Procon (detecção + sync idempotente).
 * Uso: node scripts/verify-procon-routing.mjs
 */

const PC_STATUS = { NAO_RESPONDIDA: 'Não respondida' };
const STORAGE_KEY = 'velodesk_procon_items';

const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] ?? null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
};

function readAll() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

function getDemandaByTicketId(ticketId) {
  const id = String(ticketId);
  return readAll().find((i) => String(i.ticketId || '') === id) || null;
}

function normalizeCanal(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isProconChannelTicket(ticket) {
  if (!ticket) return false;
  const channel = normalizeCanal(ticket.channel ?? ticket.source);
  if (channel === 'procon') return true;
  const lf = ticket.lateralForm || {};
  if (normalizeCanal(lf.canal).includes('procon')) return true;
  const pc = lf.procon;
  return Boolean(pc && typeof pc === 'object' && !Array.isArray(pc));
}

function buildDemandaFromTicket(ticket) {
  const lf = ticket.lateralForm || {};
  const pc = (lf.procon && typeof lf.procon === 'object') ? lf.procon : {};
  const ticketId = String(ticket.id || ticket._id || '');
  return {
    id: `pc-ticket-${ticketId}`,
    ticketId,
    consumidor: String(pc.consumidor || ticket.clientName || '').trim(),
    assunto: String(pc.assunto || ticket.title || 'Demanda Procon').trim(),
    groupKey: 'nao-respondidas',
    statusPc: PC_STATUS.NAO_RESPONDIDA,
    workflowAtivo: false,
    aberta: true,
  };
}

function mirrorDemanda(item) {
  const items = readAll();
  if (items.some((i) => String(i.ticketId || '') === String(item.ticketId))) return null;
  items.unshift(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  return item;
}

function syncProconDemandaFromTicket(ticket) {
  if (!isProconChannelTicket(ticket)) return null;
  const ticketId = String(ticket.id || ticket._id || '');
  if (!ticketId || getDemandaByTicketId(ticketId)) return null;
  return mirrorDemanda(buildDemandaFromTicket(ticket));
}

function syncProconDemandasFromTickets(tickets = []) {
  let synced = 0;
  tickets.forEach((entry) => {
    const ticket = entry?.ticket ?? entry;
    if (syncProconDemandaFromTicket(ticket)) synced += 1;
  });
  return synced;
}

const deskProconTicket = {
  id: 'ticket-desk-001',
  title: 'Cobrança Procon',
  clientName: 'João Silva',
  channel: 'procon',
  lateralForm: { canal: 'Procon' },
};

const commonTicket = {
  id: 'ticket-digital-002',
  channel: 'digital',
  lateralForm: { canal: 'E-mail' },
};

localStorage.setItem(STORAGE_KEY, JSON.stringify([{
  id: 'pc-existing',
  ticketId: 'ticket-reg-003',
  consumidor: 'Maria',
}]));

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`  OK  ${label}`);
  } else {
    failed += 1;
    console.error(` FAIL ${label}`);
  }
}

console.log('1. Detecção');
assert('Desk Procon', isProconChannelTicket(deskProconTicket));
assert('Comum não Procon', !isProconChannelTicket(commonTicket));

console.log('\n2. buildDemandaFromTicket');
const d = buildDemandaFromTicket(deskProconTicket);
assert('ID pc-ticket-*', d.id === 'pc-ticket-ticket-desk-001');
assert('groupKey nao-respondidas', d.groupKey === 'nao-respondidas');

console.log('\n3. Sync');
assert('Primeiro sync', syncProconDemandasFromTickets([{ ticket: deskProconTicket }]) === 1);
assert('No store', Boolean(getDemandaByTicketId('ticket-desk-001')));
assert('Sem duplicata', syncProconDemandasFromTickets([{ ticket: deskProconTicket }]) === 0);
assert('Comum ignorado', syncProconDemandasFromTickets([{ ticket: commonTicket }]) === 0);
assert('Registro existente', syncProconDemandasFromTickets([{
  ticket: { id: 'ticket-reg-003', channel: 'procon' },
}]) === 0);

console.log(`\nResultado: ${passed} ok, ${failed} falhas`);
process.exit(failed > 0 ? 1 : 0);
