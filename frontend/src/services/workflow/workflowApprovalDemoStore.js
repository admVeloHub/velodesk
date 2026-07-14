/**
 * workflowApprovalDemoStore — fila demo WF-TEST-007/008/009 (dev / fila vazia)
 */
import { getWorkflowProgress } from '../desk/utils';
import { ticketAwaitingDecision } from '../desk/workflowDefinitions';

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

function buildWorkflowState(stepActiveHoursAgo = 1.33) {
  const startedAt = hoursAgo(stepActiveHoursAgo + 1);
  const activeAt = hoursAgo(stepActiveHoursAgo);
  return {
    templateId: 'reembolso-7dias',
    title: 'REEMBOLSO DENTRO DOS 7 DIAS',
    currentStepId: 'aprovacao-financeiro',
    startedAt,
    stepHistory: [
      { stepId: 'abertura', status: 'completed', at: startedAt, by: 'sistema' },
      { stepId: 'elegibilidade', status: 'completed', at: startedAt, by: 'sistema' },
      { stepId: 'aprovacao-financeiro', status: 'active', at: activeAt, by: 'sistema' },
    ],
  };
}

function buildDemoTicket(config) {
  const startedAt = hoursAgo(config.stepActiveHoursAgo + 1);
  return {
    id: config.id,
    chamadoProtocolo: config.protocol,
    chamadoTitulo: config.title,
    title: config.title,
    clientName: config.clientName,
    solicitante: config.clientName,
    status: 'em-aberto',
    createdAt: startedAt,
    updatedAt: hoursAgo(config.stepActiveHoursAgo),
    messages: [{
      id: `${config.id}-msg`,
      type: 'client',
      fromClient: true,
      origin: 'cliente',
      text: config.clientMessage,
      timestamp: hoursAgo(config.stepActiveHoursAgo + 2),
    }],
    internalNotes: [{
      id: `${config.id}-note`,
      type: 'internal',
      origin: 'agente',
      text: config.internalNote,
      timestamp: hoursAgo(config.stepActiveHoursAgo),
    }],
    lateralForm: {
      tipoChamado: 'Solicitação',
      produto: config.produto,
      motivo: config.motivo,
      detalhe: config.detalhe,
      responsavel: 'Ana Silva (Atendimento)',
      workflow: buildWorkflowState(config.stepActiveHoursAgo),
      approval: {
        valor: config.valor,
        pedido: config.pedido || '#PED-2026-98732',
        formaPagamento: config.formaPagamento || 'Cartão · final 4521',
        dataCompra: hoursAgo(4 * 24),
        diasDesdeCompra: config.diasDesdeCompra ?? 4,
        canal: config.canal,
        clientSummary: config.clientMessage,
        forwardingNote: config.internalNote,
      },
    },
    ...(config.slaStatus ? { slaStatus: config.slaStatus } : {}),
  };
}

const INITIAL_DEMO_TICKETS = [
  buildDemoTicket({
    id: 'wf-demo-007',
    protocol: 'WF-TEST-007',
    title: '[TESTE] Aprovação reembolso — Maria Oliveira',
    clientName: 'Maria Oliveira',
    produto: 'Produto X',
    motivo: 'Reembolso',
    detalhe: 'Dentro de 7 dias',
    valor: 249.9,
    canal: 'WhatsApp',
    stepActiveHoursAgo: 1.33,
    clientMessage: 'Comprei o Produto X há 4 dias e quero solicitar o reembolso. Ainda estou dentro do prazo de 7 dias.',
    internalNote: 'Atendimento confirmou elegibilidade e encaminhou para aprovação.',
  }),
  buildDemoTicket({
    id: 'wf-demo-008',
    protocol: 'WF-TEST-008',
    title: '[TESTE] Estorno duplicidade — Roberto Alves',
    clientName: 'Roberto Alves',
    produto: 'duplicidade',
    motivo: 'Estorno',
    detalhe: 'Em análise',
    valor: 89.9,
    canal: 'E-mail',
    stepActiveHoursAgo: 2.75,
    clientMessage: 'Fui cobrado duas vezes pelo mesmo produto. Solicito estorno da duplicidade.',
    internalNote: 'Duplicidade confirmada — encaminhado ao financeiro.',
  }),
  buildDemoTicket({
    id: 'wf-demo-009',
    protocol: 'WF-TEST-009',
    title: '[TESTE] Reembolso Produto Y — Fernanda Lima (SLA crítico)',
    clientName: 'Fernanda Lima',
    produto: 'Produto Y',
    motivo: 'Reembolso',
    detalhe: 'Dentro de 7 dias',
    valor: 599,
    canal: 'Telefone',
    stepActiveHoursAgo: 3.83,
    diasDesdeCompra: 3,
    slaStatus: 'critical',
    clientMessage: 'Liguei para solicitar reembolso do Produto Y. A compra foi há 3 dias e preciso de urgência.',
    internalNote: 'Urgente — SLA financeiro prestes a vencer.',
  }),
];

let demoTickets = INITIAL_DEMO_TICKETS.map((t) => structuredClone(t));

export function isDemoApprovalTicket(ticketId) {
  return String(ticketId).startsWith('wf-demo-');
}

export function shouldUseApprovalDemoFallback(realPendingCount) {
  if (realPendingCount > 0) return false;
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

export function getDemoApprovalEntries() {
  return demoTickets
    .map((ticket) => ({ ticket, boxId: 'demo', queueId: 'demo' }))
    .filter(({ ticket }) => {
      const progress = getWorkflowProgress(ticket);
      return ticketAwaitingDecision(ticket, progress);
    });
}

export function findDemoApprovalEntry(ticketId) {
  const id = String(ticketId);
  const ticket = demoTickets.find((t) => String(t.id) === id);
  if (!ticket) return null;
  return { ticket, boxId: 'demo', queueId: 'demo' };
}

export function updateDemoApprovalTicket(ticketId, updater) {
  const id = String(ticketId);
  const idx = demoTickets.findIndex((t) => String(t.id) === id);
  if (idx < 0) return null;
  const next = typeof updater === 'function' ? updater(structuredClone(demoTickets[idx])) : updater;
  if (next) demoTickets[idx] = next;
  notifyDemoQueueChanged();
  return demoTickets[idx];
}

export function removeDemoApprovalTicket(ticketId) {
  const id = String(ticketId);
  demoTickets = demoTickets.filter((t) => String(t.id) !== id);
  notifyDemoQueueChanged();
}

export function resetDemoApprovalTickets() {
  demoTickets = INITIAL_DEMO_TICKETS.map((t) => structuredClone(t));
  notifyDemoQueueChanged();
}

export function notifyDemoQueueChanged() {
  window.dispatchEvent(new CustomEvent('velodesk:workflow-demo-changed'));
}
