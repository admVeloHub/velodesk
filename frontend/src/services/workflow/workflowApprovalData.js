/**
 * workflowApprovalData v1.8.0 — fila WK inclui por atribuído do passo (sem exigir template)
 * VERSION: v1.8.0 | DATE: 2026-08-21
 */
import { getAllCockpitTickets } from '../ticketsStorage';
import { findCadastralRequestByTicketId } from '../cadastral/cadastralRequestStore';
import {
  getErrosBugsTipoLabel,
  getTipoSolicitacaoLabel,
} from '../cadastral/solicitacoesProdutosData';
import { getFinanceiroTipoLabel } from '../cadastral/solicitacoesFinanceiroData';
import {
  getSlaClass,
  getWorkflowProgress,
  isTicketWorkflowActive,
  getTicketProtocolLabel,
  getWorkflowTemplateForTicket,
} from '../desk/utils';
import { resolveApprovalHeader, ticketAwaitingDecision } from '../desk/workflowDefinitions';
import {
  agentCanDecideTicket as permAgentCanDecide,
  canApproveWorkflow,
} from '../permissions/permissionService';
import { ticketAwaitingProdutosComunicacaoReview, ticketAwaitingResponsavelReply } from './workflowDecisionHandlers';
import {
  getWorkflowTeamQueueMeta,
  isTeamStepActive,
  isWorkflowStatusOffApprovalConsole,
  isWorkflowTicketCompleted,
  ticketAtribuidoMatchesWorkflowQueue,
  ticketMatchesWorkflowTeam,
  WORKFLOW_TEAM_QUEUES,
} from './workflowTeamQueues';
import {
  buildTicketContextFields,
  formatRequisicaoDisplayValue,
  resolveRequisicaoCamposForApproval,
  resolveRequisicaoValor,
  readTicketRequisicaoValores,
} from './workflowRequisicao';
import deskLog from '../../utils/deskDebugLog';
import { formatDateBr, formatDateTimeBr } from '../../utils/dateTimeBr';
import { collectTicketAttachments } from '../desk/attachmentPreview';

const QUEUE_LABEL = 'Aguardando aprovação';

function agentCanDecideTicket(ticket) {
  if (!canApproveWorkflow()) return false;
  return permAgentCanDecide(ticket);
}

function formatRelativeTime(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.floor(diffMs / 60000));
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function formatElapsedSince(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.floor(diffMs / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${min}min`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  return formatDateTimeBr(iso);
}

function channelLabel(ticket) {
  const channel = (ticket.lateralForm?.canal || ticket.channel || ticket.source || '').toLowerCase();
  if (channel.includes('whats')) return { label: 'WhatsApp', icon: 'fab fa-whatsapp' };
  if (channel.includes('mail') || channel.includes('email')) return { label: 'E-mail', icon: 'fas fa-envelope' };
  if (channel.includes('phone') || channel.includes('telefone') || channel.includes('tel')) {
    return { label: 'Telefone', icon: 'fas fa-phone' };
  }
  if (channel.includes('portal')) return { label: 'Portal', icon: 'fas fa-globe' };
  return { label: 'Digital', icon: 'fas fa-comment' };
}

function readApprovalMeta(ticket) {
  const lf = ticket?.lateralForm || {};
  return lf.approval || lf.metadados?.approval || {};
}

function isWorkflowSystemNote(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  return /^\[Workflow\]/i.test(value)
    || /Pedido de informação por/i.test(value)
    || /Reprovado por/i.test(value)
    || /^Decisão \*\*/i.test(value);
}

function getFirstClientMessage(ticket) {
  const messages = ticket?.messages || [];
  const clientMsg = messages.find((m) => {
    if (m.type === 'system' || m.type === 'internal') return false;
    return m.fromClient || m.type === 'client' || m.origin === 'cliente';
  });
  if (clientMsg?.text) return clientMsg.text;

  const approval = readApprovalMeta(ticket);
  if (approval.clientSummary) return approval.clientSummary;

  return '';
}

function getInternalForwardingNote(ticket) {
  const approval = readApprovalMeta(ticket);
  if (approval.forwardingNote) return approval.forwardingNote;
  if (approval.notaEncaminhamento) return approval.notaEncaminhamento;

  const notes = ticket?.internalNotes || [];
  const forwardingNote = [...notes].reverse().find((n) => !isWorkflowSystemNote(n.text));
  if (forwardingNote?.text) return forwardingNote.text;

  const messages = ticket?.messages || [];
  const internal = [...messages].reverse().find((m) => {
    if (m.type !== 'internal' && m.origin !== 'agente') return false;
    return !isWorkflowSystemNote(m.text);
  });
  if (internal?.text) return internal.text;

  return '';
}

function formatCurrency(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return String(value || '—');
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function readRequisicaoValores(ticket) {
  return readTicketRequisicaoValores(ticket);
}

function buildDynamicApprovalDetail(ticket, progress, header) {
  const lf = ticket.lateralForm || {};
  const template = getWorkflowTemplateForTicket(ticket);
  const workflowDef = template?.raw || template;
  const campos = resolveRequisicaoCamposForApproval(workflowDef);
  const valores = readRequisicaoValores(ticket);
  const sla = getSlaClass(ticket);
  const startedAt = progress.workflow?.startedAt || ticket.createdAt;

  const contextFields = [
    { label: 'Protocolo', value: getTicketProtocolLabel(ticket) || '—', tone: 'default' },
    ...buildTicketContextFields(ticket).map((field) => ({
      ...field,
      tone: 'default',
    })),
  ];

  const requisicaoFields = campos.map((campo) => {
    const raw = resolveRequisicaoValor(valores, campo);
    const value = formatRequisicaoDisplayValue(campo, raw);
    deskLog.requisicao('campo aprovação', {
      ticketId: String(ticket?.id || ''),
      label: campo.label,
      campoId: campo.id,
      raw,
      display: value,
      valorKeys: Object.keys(valores),
    });
    return { label: campo.label, value, tone: 'default' };
  });

  return {
    cardTitle: lf.produto && lf.motivo
      ? `${lf.motivo} · ${lf.produto}`
      : (ticket.title || header.title),
    cardSubtext: `Solicitado em ${formatDateTime(startedAt)} · aguardando há ${formatElapsedSince(startedAt)}`,
    slaLabel: progress.slaRemainingLabel ? `SLA: ${progress.slaRemainingLabel} restantes` : null,
    slaPct: progress.slaTotalHours && progress.slaRemainingMs != null
      ? Math.max(8, Math.min(92, 100 - (progress.slaRemainingMs / (progress.slaTotalHours * 3600000)) * 100))
      : 55,
    fieldSections: [
      { title: 'Contexto do ticket', fields: contextFields },
      ...(requisicaoFields.length ? [{ title: 'Dados da requisição', fields: requisicaoFields }] : []),
    ],
    fields: [...contextFields, ...requisicaoFields],
    justificationQuote: getFirstClientMessage(ticket),
    internalNote: getInternalForwardingNote(ticket),
    slaTone: sla === 'critical' ? 'danger' : 'default',
  };
}

function inferDaysSincePurchase(approval, ticket) {
  if (approval.diasDesdeCompra != null) return approval.diasDesdeCompra;
  if (approval.dataCompra) {
    const diff = Date.now() - new Date(approval.dataCompra).getTime();
    return Math.max(0, Math.floor(diff / 86400000));
  }
  const msg = getFirstClientMessage(ticket);
  const match = msg.match(/(\d+)\s*dias?/i);
  if (match) return Number(match[1]);
  return 4;
}

function buildSlaDetail(progress) {
  return {
    slaLabel: progress.slaRemainingLabel ? `SLA: ${progress.slaRemainingLabel} restantes` : null,
    slaPct: progress.slaTotalHours && progress.slaRemainingMs != null
      ? Math.max(8, Math.min(92, 100 - (progress.slaRemainingMs / (progress.slaTotalHours * 3600000)) * 100))
      : 55,
  };
}

export function resolveSolicitacaoProdutosForTicket(ticket) {
  if (!ticket) return null;

  const lf = ticket.lateralForm || {};
  const embedded = lf.solicitacaoProdutos
    || ticket?.workflow?.requisicao?.solicitacaoProdutos;
  if (
    embedded?.categoria === 'solicitacoes'
    || embedded?.categoria === 'erros-bugs'
    || embedded?.categoria === 'liberacao-pix'
    || embedded?.categoria === 'documentos'
  ) {
    return embedded;
  }

  const financeiroLegacy = lf.solicitacaoFinanceiro
    || ticket?.workflow?.requisicao?.solicitacaoFinanceiro;
  if (financeiroLegacy?.categoria === 'documentos') {
    return financeiroLegacy;
  }

  const protocol = getTicketProtocolLabel(ticket) || String(ticket.id || '');
  return findCadastralRequestByTicketId(protocol)
    || findCadastralRequestByTicketId(String(ticket.id || ''))
    || null;
}

export function resolveSolicitacaoFinanceiroForTicket(ticket) {
  if (!ticket) return null;

  const lf = ticket.lateralForm || {};
  const embedded = lf.solicitacaoFinanceiro
    || ticket?.workflow?.requisicao?.solicitacaoFinanceiro;
  if (
    embedded?.categoria === 'estorno'
    || embedded?.categoria === 'cobranca'
    || embedded?.categoria === 'outros'
  ) {
    return embedded;
  }

  return null;
}

function buildFinanceiroSolicitacaoDetail(ticket, progress, solicitacao) {
  const startedAt = solicitacao.createdAt || progress?.workflow?.startedAt || ticket.createdAt;
  const cpfDigits = String(solicitacao.cpf || '').replace(/\D/g, '');
  const cpfDisplay = cpfDigits || String(solicitacao.cpf || '').trim();
  const { slaLabel, slaPct } = buildSlaDetail(progress || { slaRemainingLabel: null, slaTotalHours: null, slaRemainingMs: null });
  const lf = ticket.lateralForm || {};
  const tipoLabel = getFinanceiroTipoLabel(solicitacao.categoria);
  const descricao = solicitacao.descricao || solicitacao.observacoes || '';

  return {
    layout: 'financeiro-solicitacao',
    cardTitle: solicitacao.titulo || `${cpfDisplay} · ${tipoLabel}`,
    cardSubtext: `Solicitado em ${formatDateTime(startedAt)} · aguardando há ${formatElapsedSince(startedAt)}`,
    slaLabel,
    slaPct,
    typeBar: tipoLabel,
    submittedAt: solicitacao.createdAt || startedAt,
    dadoAntigo: '',
    dadoNovo: descricao,
    descricao,
    rows: [
      ...(solicitacao.documentosSolicitados
        ? [{ icon: 'ti-file-text', label: 'Documentos', value: solicitacao.documentosSolicitados, tone: 'default' }]
        : []),
      { icon: 'ti-user', label: 'Colaborador', value: solicitacao.colaborador || lf.responsavel || ticket.responsibleAgent || '—', tone: 'default' },
    ],
    highlightCpf: cpfDisplay,
    fields: [],
    justificationQuote: getFirstClientMessage(ticket),
    internalNote: solicitacao.observacoes || null,
  };
}

function buildFinanceiroApprovalEssentials(ticket, solicitacao, options = {}) {
  const lf = ticket.lateralForm || {};
  const context = buildTicketContextFields(ticket);
  const cpfContext = context.find((f) => f.label === 'CPF')?.value;
  const descricao = solicitacao?.descricao || solicitacao?.observacoes || '';

  return {
    cpf: formatCpfDisplay(solicitacao?.cpf || cpfContext),
    produto: lf.produto || context.find((f) => f.label === 'Produto')?.value || '—',
    motivo: lf.motivo || context.find((f) => f.label === 'Motivo')?.value || ticket?.title || '—',
    detalhe: lf.detalhe || context.find((f) => f.label === 'Detalhe')?.value || '',
    responsavel: lf.responsavel || ticket?.responsibleAgent || context.find((f) => f.label === 'Responsável')?.value || '—',
    dadoAntigo: '',
    dadoNovo: descricao,
    descricao,
    tipoLabel: getFinanceiroTipoLabel(solicitacao?.categoria),
    attachments: null,
    layout: 'financeiro-solicitacao',
    requisicaoFields: options.requisicaoFields || [],
    protocol: getTicketProtocolLabel(ticket) || String(ticket?.id || ''),
    clientName: ticket?.clientName || ticket?.solicitante || 'Cliente',
    ticketAttachments: collectTicketAttachments(ticket),
  };
}

function readOctadeskTicketId(ticket) {
  const lf = ticket?.lateralForm || {};
  return ticket?.externalId
    || ticket?.octadeskId
    || lf.octadeskTicket
    || lf.metadados?.octadeskTicket
    || lf.metadados?.ticketOctadesk
    || '';
}

function buildProdutosCadastralDetail(ticket, progress, header, solicitacao) {
  const startedAt = solicitacao.createdAt || progress.workflow?.startedAt || ticket.createdAt;
  const typeLabel = getTipoSolicitacaoLabel(solicitacao.tipoSolicitacao);
  const cpfDigits = String(solicitacao.cpf || '').replace(/\D/g, '');
  const cpfDisplay = cpfDigits || String(solicitacao.cpf || '').trim();
  const { slaLabel, slaPct } = buildSlaDetail(progress);
  const lf = ticket.lateralForm || {};
  const rows = [];

  const pushRow = (icon, label, value, options = {}) => {
    if (options.skipEmpty && !String(value ?? '').trim() && value !== false) return;
    rows.push({
      icon,
      label,
      hideLabel: Boolean(options.hideLabel),
      value: options.booleanValue != null
        ? (options.booleanValue ? 'Fotos Verificadas' : 'Fotos não verificadas')
        : String(value ?? '').trim(),
      tone: options.tone || 'default',
      booleanValue: options.booleanValue ?? null,
    });
  };

  if (solicitacao.fotosVerificadas != null) {
    pushRow(
      solicitacao.fotosVerificadas ? 'ti-check' : 'ti-x',
      'Fotos Verificadas',
      solicitacao.fotosVerificadas,
      {
        hideLabel: true,
        booleanValue: Boolean(solicitacao.fotosVerificadas),
        tone: solicitacao.fotosVerificadas ? 'success' : 'muted',
      },
    );
  }

  if (solicitacao.analiseExcecaoDevolucao != null) {
    pushRow('ti-x', 'Analise Excecao Devolucao', String(solicitacao.analiseExcecaoDevolucao));
  }

  const octadeskId = readOctadeskTicketId(ticket);
  pushRow('ti-ticket', 'Ticket Octadesk', octadeskId, { skipEmpty: true });

  const mensagemN1 = solicitacao.mensagemN1 || solicitacao.observacoes || '';
  pushRow('ti-message-circle', 'Mensagem N1', mensagemN1, { skipEmpty: true });
  pushRow('ti-user', 'Colaborador', solicitacao.colaborador || lf.responsavel || ticket.responsibleAgent, { skipEmpty: true });

  return {
    layout: 'produtos-cadastral',
    cardTitle: solicitacao.titulo || `${cpfDisplay} · ${typeLabel}`,
    cardSubtext: `Solicitado em ${formatDateTime(startedAt)} · aguardando há ${formatElapsedSince(startedAt)}`,
    slaLabel,
    slaPct,
    typeBar: typeLabel,
    submittedAt: solicitacao.createdAt || startedAt,
    dadoAntigo: solicitacao.dadoAntigo || '',
    dadoNovo: solicitacao.dadoNovo || '',
    rows,
    highlightCpf: cpfDisplay,
    fields: [],
    justificationQuote: null,
    internalNote: null,
  };
}

function buildAttachmentPayload(solicitacao) {
  return {
    imagens: Array.isArray(solicitacao.anexosImagens) ? solicitacao.anexosImagens : [],
    videos: Array.isArray(solicitacao.anexosVideos) ? solicitacao.anexosVideos : [],
    recusouEvidencias: Boolean(solicitacao.clienteRecusouEvidencias),
  };
}

function formatCpfDisplay(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return String(value || '').trim() || '—';
}

function extractRequisicaoFieldsFromDetail(detail) {
  const section = detail?.fieldSections?.find((s) => s.title === 'Dados da requisição');
  return section?.fields || [];
}

/** Ficha unificada para layout clean do console /workflow */
export function buildWorkflowApprovalEssentials(ticket, solicitacao = null, options = {}) {
  const lf = ticket?.lateralForm || {};
  const context = buildTicketContextFields(ticket);
  const cpfContext = context.find((f) => f.label === 'CPF')?.value;

  let layout = solicitacao?.categoria === 'erros-bugs'
    ? 'produtos-erros-bugs'
    : solicitacao?.categoria === 'liberacao-pix'
      ? 'produtos-pix'
      : solicitacao
        ? 'produtos-cadastral'
        : 'generic';

  let dadoAntigo = '';
  let dadoNovo = '';
  let descricao = '';
  let tipoLabel = '';
  let attachments = null;

  if (solicitacao?.categoria === 'erros-bugs') {
    descricao = solicitacao.observacoes || solicitacao.dadoNovo || '';
    attachments = buildAttachmentPayload(solicitacao);
    tipoLabel = `Erros/Bugs · ${getErrosBugsTipoLabel(solicitacao.tipoErro || 'app')}`;
  } else if (solicitacao?.categoria === 'liberacao-pix') {
    dadoNovo = solicitacao.dadoNovo || solicitacao.chavePix || '';
    tipoLabel = `Liberação PIX · ${solicitacao.tipoInformacao || solicitacao.tipoChave || 'cpf'}`;
  } else if (solicitacao) {
    dadoAntigo = solicitacao.dadoAntigo || '';
    dadoNovo = solicitacao.dadoNovo || '';
    tipoLabel = getTipoSolicitacaoLabel(solicitacao.tipoSolicitacao);
    if (solicitacao.tipoInformacao) {
      tipoLabel = `${tipoLabel} · ${solicitacao.tipoInformacao}`;
    }
  }

  return {
    cpf: formatCpfDisplay(solicitacao?.cpf || cpfContext),
    produto: lf.produto || context.find((f) => f.label === 'Produto')?.value || '—',
    motivo: lf.motivo || context.find((f) => f.label === 'Motivo')?.value || ticket?.title || '—',
    detalhe: lf.detalhe || context.find((f) => f.label === 'Detalhe')?.value || '',
    responsavel: lf.responsavel || ticket?.responsibleAgent || context.find((f) => f.label === 'Responsável')?.value || '—',
    dadoAntigo,
    dadoNovo,
    descricao,
    tipoLabel,
    attachments,
    layout,
    requisicaoFields: options.requisicaoFields || [],
    protocol: getTicketProtocolLabel(ticket) || String(ticket?.id || ''),
    clientName: ticket?.clientName || ticket?.solicitante || 'Cliente',
    ticketAttachments: collectTicketAttachments(ticket),
  };
}

function buildProdutosErrosBugsDetail(ticket, progress, header, solicitacao) {
  const startedAt = solicitacao.createdAt || progress.workflow?.startedAt || ticket.createdAt;
  const tipoLabel = getErrosBugsTipoLabel(solicitacao.tipoErro || 'app');
  const cpfDigits = String(solicitacao.cpf || '').replace(/\D/g, '');
  const cpfDisplay = cpfDigits || String(solicitacao.cpf || '').trim();
  const { slaLabel, slaPct } = buildSlaDetail(progress);
  const lf = ticket.lateralForm || {};
  const rows = [];

  const pushRow = (icon, label, value, options = {}) => {
    if (options.skipEmpty && !String(value ?? '').trim()) return;
    rows.push({
      icon,
      label,
      hideLabel: Boolean(options.hideLabel),
      value: String(value ?? '').trim(),
      tone: options.tone || 'default',
      booleanValue: null,
    });
  };

  if (solicitacao.clienteRecusouEvidencias) {
    pushRow('ti-alert-circle', 'Evidências', 'Cliente recusou enviar evidências', { hideLabel: true, tone: 'muted' });
  }

  pushRow('ti-tag', 'Marca', solicitacao.marca, { skipEmpty: true });
  pushRow('ti-device-mobile', 'Modelo', solicitacao.modelo, { skipEmpty: true });

  const octadeskId = readOctadeskTicketId(ticket);
  pushRow('ti-ticket', 'Ticket Octadesk', octadeskId, { skipEmpty: true });

  const mensagemN1 = solicitacao.mensagemN1 || solicitacao.observacoes || '';
  pushRow('ti-message-circle', 'Mensagem N1', mensagemN1, { skipEmpty: true });
  pushRow('ti-user', 'Colaborador', solicitacao.colaborador || lf.responsavel || ticket.responsibleAgent, { skipEmpty: true });

  const descricao = solicitacao.observacoes || solicitacao.dadoNovo || '';

  return {
    layout: 'produtos-erros-bugs',
    cardTitle: solicitacao.titulo || `${cpfDisplay} · Erros/Bugs`,
    cardSubtext: `Solicitado em ${formatDateTime(startedAt)} · aguardando há ${formatElapsedSince(startedAt)}`,
    slaLabel,
    slaPct,
    typeBar: `Erros/Bugs · ${tipoLabel}`,
    submittedAt: solicitacao.createdAt || startedAt,
    dadoAntigo: '',
    dadoNovo: descricao,
    descricao,
    rows,
    highlightCpf: cpfDisplay,
    attachments: buildAttachmentPayload(solicitacao),
    fields: [],
    justificationQuote: null,
    internalNote: null,
  };
}

function buildProdutosPixDetail(ticket, progress, header, solicitacao) {
  const startedAt = solicitacao.createdAt || progress.workflow?.startedAt || ticket.createdAt;
  const cpfDigits = String(solicitacao.cpf || '').replace(/\D/g, '');
  const cpfDisplay = cpfDigits || String(solicitacao.cpf || '').trim();
  const { slaLabel, slaPct } = buildSlaDetail(progress);
  const lf = ticket.lateralForm || {};
  const chavePix = solicitacao.dadoNovo || solicitacao.chavePix || '';
  const tipoChave = solicitacao.tipoInformacao || solicitacao.tipoChave || 'cpf';

  return {
    layout: 'produtos-pix',
    cardTitle: solicitacao.titulo || `${cpfDisplay} · Liberação PIX`,
    cardSubtext: `Solicitado em ${formatDateTime(startedAt)} · aguardando há ${formatElapsedSince(startedAt)}`,
    slaLabel,
    slaPct,
    typeBar: `Liberação PIX · ${tipoChave}`,
    submittedAt: solicitacao.createdAt || startedAt,
    dadoAntigo: '',
    dadoNovo: chavePix,
    rows: [
      { icon: 'ti-key', label: 'Chave PIX', value: chavePix, tone: 'default' },
      { icon: 'ti-user', label: 'Colaborador', value: solicitacao.colaborador || lf.responsavel || ticket.responsibleAgent || '—', tone: 'default' },
    ],
    highlightCpf: cpfDisplay,
    fields: [],
    justificationQuote: null,
    internalNote: solicitacao.observacoes || null,
  };
}

function buildProdutosDocumentosDetail(ticket, progress, header, solicitacao) {
  const startedAt = solicitacao.createdAt || progress.workflow?.startedAt || ticket.createdAt;
  const cpfDigits = String(solicitacao.cpf || '').replace(/\D/g, '');
  const cpfDisplay = cpfDigits || String(solicitacao.cpf || '').trim();
  const { slaLabel, slaPct } = buildSlaDetail(progress);
  const lf = ticket.lateralForm || {};
  const descricao = solicitacao.descricao || solicitacao.observacoes || solicitacao.dadoNovo || '';

  return {
    layout: 'produtos-documentos',
    cardTitle: solicitacao.titulo || `${cpfDisplay} · Solicitação de documentos`,
    cardSubtext: `Solicitado em ${formatDateTime(startedAt)} · aguardando há ${formatElapsedSince(startedAt)}`,
    slaLabel,
    slaPct,
    typeBar: 'Solicitação de documentos',
    submittedAt: solicitacao.createdAt || startedAt,
    dadoAntigo: '',
    dadoNovo: descricao,
    descricao,
    rows: [
      ...(solicitacao.documentosSolicitados
        ? [{ icon: 'ti-file-text', label: 'Documentos', value: solicitacao.documentosSolicitados, tone: 'default' }]
        : []),
      { icon: 'ti-user', label: 'Colaborador', value: solicitacao.colaborador || lf.responsavel || ticket.responsibleAgent || '—', tone: 'default' },
    ],
    highlightCpf: cpfDisplay,
    fields: [],
    justificationQuote: getFirstClientMessage(ticket),
    internalNote: solicitacao.observacoes || null,
  };
}

function buildProdutosSolicitacaoAddon(ticket, progress, solicitacao) {
  if (!solicitacao) return null;
  if (solicitacao.categoria === 'erros-bugs') {
    return buildProdutosErrosBugsDetail(ticket, progress, {}, solicitacao);
  }
  if (solicitacao.categoria === 'liberacao-pix') {
    return buildProdutosPixDetail(ticket, progress, {}, solicitacao);
  }
  if (solicitacao.categoria === 'documentos') {
    return buildProdutosDocumentosDetail(ticket, progress, {}, solicitacao);
  }
  return buildProdutosCadastralDetail(ticket, progress, {}, solicitacao);
}

function buildProdutosGenericDetail(ticket, progress, header) {
  const lf = ticket.lateralForm || {};
  const sla = getSlaClass(ticket);
  const startedAt = progress.workflow?.startedAt || ticket.createdAt;
  const { slaLabel, slaPct } = buildSlaDetail(progress);

  return {
    layout: 'produtos-generic',
    cardTitle: lf.produto && lf.motivo
      ? `${lf.motivo} · ${lf.produto}`
      : (ticket.title || header.title),
    cardSubtext: `Solicitado em ${formatDateTime(startedAt)} · aguardando há ${formatElapsedSince(startedAt)}`,
    slaLabel,
    slaPct,
    fields: [
      { label: 'Cliente', value: ticket.clientName || ticket.solicitante || 'Cliente', tone: 'default' },
      { label: 'Produto', value: lf.produto || '—', tone: 'default' },
      { label: 'Motivo', value: lf.motivo || '—', tone: 'default' },
      { label: 'Canal', value: channelLabel(ticket).label, tone: 'default' },
      { label: 'Responsável', value: lf.responsavel || ticket.responsibleAgent || '—', tone: 'default' },
      { label: 'SLA', value: progress.slaRemainingLabel || (sla === 'critical' ? 'Crítico' : 'No prazo'), tone: sla === 'critical' ? 'danger' : 'default' },
    ],
    justificationQuote: getFirstClientMessage(ticket),
    internalNote: getInternalForwardingNote(ticket),
  };
}

function buildGenericApprovalDetail(ticket, progress, header) {
  const lf = ticket.lateralForm || {};
  const sla = getSlaClass(ticket);
  const startedAt = progress.workflow?.startedAt || ticket.createdAt;
  const { slaLabel, slaPct } = buildSlaDetail(progress);

  return {
    cardTitle: lf.produto && lf.motivo
      ? `${lf.motivo} · ${lf.produto}`
      : (ticket.title || header.title),
    cardSubtext: `Solicitado em ${formatDateTime(startedAt)} · aguardando há ${formatElapsedSince(startedAt)}`,
    slaLabel,
    slaPct,
    fields: [
      { label: 'Cliente', value: ticket.clientName || ticket.solicitante || 'Cliente', tone: 'default' },
      { label: 'Produto', value: lf.produto || '—', tone: 'default' },
      { label: 'Motivo', value: lf.motivo || '—', tone: 'default' },
      { label: 'Canal', value: channelLabel(ticket).label, tone: 'default' },
      { label: 'Responsável', value: lf.responsavel || ticket.responsibleAgent || '—', tone: 'default' },
      { label: 'SLA', value: progress.slaRemainingLabel || (sla === 'critical' ? 'Crítico' : 'No prazo'), tone: sla === 'critical' ? 'danger' : 'default' },
    ],
    justificationQuote: getFirstClientMessage(ticket),
    internalNote: getInternalForwardingNote(ticket),
  };
}

function buildReembolsoApprovalDetail(ticket, progress, header) {
  const lf = ticket.lateralForm || {};
  const approval = readApprovalMeta(ticket);
  const startedAt = progress.workflow?.startedAt || ticket.createdAt;
  const days = inferDaysSincePurchase(approval, ticket);
  const valor = approval.valor ?? 249.9;
  const elegivel = days <= 7;

  return {
    cardTitle: `Reembolso · ${lf.produto || 'Produto X'} · ${lf.detalhe || 'dentro dos 7 dias'}`,
    cardSubtext: `Solicitado em ${formatDateTime(startedAt)} · aguardando há ${formatElapsedSince(startedAt)}`,
    slaLabel: progress.slaRemainingLabel ? `SLA: ${progress.slaRemainingLabel} restantes` : null,
    slaPct: progress.slaTotalHours && progress.slaRemainingMs != null
      ? Math.max(8, Math.min(92, 100 - (progress.slaRemainingMs / (progress.slaTotalHours * 3600000)) * 100))
      : 62,
    fields: [
      { label: 'Cliente', value: ticket.clientName || ticket.solicitante || 'Cliente', tone: 'default' },
      { label: 'Valor do reembolso', value: formatCurrency(valor), tone: 'success' },
      { label: 'Data da compra', value: approval.dataCompra ? formatDateBr(approval.dataCompra) : '13/06/2026', tone: 'default' },
      { label: 'Dias desde a compra', value: `${days} dias · ${elegivel ? 'elegível' : 'fora do prazo'}`, tone: elegivel ? 'info' : 'danger' },
      { label: 'Pedido', value: approval.pedido || '#PED-2026-98732', tone: 'default' },
      { label: 'Forma de pagamento', value: approval.formaPagamento || 'Cartão · final 4521', tone: 'default' },
    ],
    justificationQuote: getFirstClientMessage(ticket),
    internalNote: getInternalForwardingNote(ticket),
  };
}

function buildQueueItem(entry, teamId = null) {
  const { ticket } = entry;
  const progress = getWorkflowProgress(ticket);
  const lf = ticket.lateralForm || {};
  const approval = readApprovalMeta(ticket);
  const channel = approval.canal
    ? channelLabel({ lateralForm: { canal: approval.canal } })
    : channelLabel(ticket);
  const sla = getSlaClass(ticket);

  if (!progress) {
    const baseSubject = `${lf.motivo || 'Workflow'} ${lf.produto || ''}`.trim();
    const amountLabel = approval.valor != null ? formatCurrency(approval.valor) : null;
    const subject = amountLabel ? `${baseSubject} · ${amountLabel}` : baseSubject;
    return {
      id: String(ticket.id),
      clientName: ticket.clientName || ticket.solicitante || 'Cliente',
      elapsedLabel: formatRelativeTime(ticket.updatedAt),
      timeLabel: formatRelativeTime(ticket.updatedAt),
      timeCritical: sla === 'critical',
      subject,
      amountLabel,
      channel,
      slaTone: sla === 'critical' ? 'critical' : sla === 'warning' ? 'warn' : 'ok',
      urgencyBadge: sla === 'critical' ? { text: 'Urgente', tone: 'critical' } : null,
      slaBadge: { text: 'SLA', tone: sla === 'critical' ? 'critical' : 'warn' },
      queueLabel: QUEUE_LABEL,
      awaitingDecision: false,
      teamStepActive: false,
      queueStatus: 'aguardando',
      awaitingComunicacaoReply: ticketAwaitingProdutosComunicacaoReview(ticket),
      awaitingResponsavelReply: ticketAwaitingResponsavelReply(ticket),
    };
  }

  const header = resolveApprovalHeader(ticket, progress);
  const stepStarted = progress.workflow?.stepHistory?.find((h) => h.stepId === progress.activeStep?.id && h.status === 'active');
  const awaitingDecision = ticketAwaitingDecision(ticket, progress);
  const teamStepActive = teamId ? isTeamStepActive(ticket, teamId, progress) : false;

  let urgencyBadge = null;
  if (sla === 'critical') urgencyBadge = { text: 'Urgente', tone: 'critical' };
  else if (progress.slaRemainingMs != null && progress.slaRemainingMs < 3600000) {
    urgencyBadge = { text: `vence ${progress.slaRemainingLabel}`, tone: 'critical' };
  }

  const amountLabel = approval.valor != null
    ? formatCurrency(approval.valor)
    : null;

  const baseSubject = `${lf.motivo || 'Workflow'} ${lf.produto || ''}`.trim();
  const subject = amountLabel ? `${baseSubject} · ${amountLabel}` : baseSubject;

  const elapsedLabel = stepStarted?.at ? formatRelativeTime(stepStarted.at) : formatRelativeTime(ticket.updatedAt);
  const nearSlaExpiry = progress.slaRemainingMs != null && progress.slaRemainingMs < 3600000;
  const timeCritical = sla === 'critical' || nearSlaExpiry;
  const timeLabel = timeCritical && progress.slaRemainingLabel
    ? `vence ${progress.slaRemainingLabel}`
    : elapsedLabel;

  return {
    id: String(ticket.id),
    clientName: ticket.clientName || ticket.solicitante || 'Cliente',
    elapsedLabel,
    timeLabel,
    timeCritical,
    subject,
    amountLabel,
    channel,
    slaTone: sla === 'critical' ? 'critical' : sla === 'warning' ? 'warn' : 'ok',
    urgencyBadge,
    slaBadge: { text: 'SLA', tone: sla === 'critical' ? 'critical' : 'warn' },
    queueLabel: header.queueLabel || QUEUE_LABEL,
    awaitingDecision,
    teamStepActive,
    queueStatus: awaitingDecision
      ? 'decisao'
      : teamStepActive
        ? 'etapa-ativa'
        : 'aguardando',
    awaitingComunicacaoReply: ticketAwaitingProdutosComunicacaoReview(ticket),
    awaitingResponsavelReply: ticketAwaitingResponsavelReply(ticket),
  };
}

function buildDetailView(ticket, progress) {
  const header = resolveApprovalHeader(ticket, progress);
  const protocol = getTicketProtocolLabel(ticket) || ticket.id;
  const lf = ticket.lateralForm || {};
  const openedBy = lf.responsavel || ticket.responsibleAgent || 'Atendimento';
  const openedAt = progress?.workflow?.startedAt || ticket.workflow?.startedAt || ticket.createdAt;

  if (!progress) {
    const template = getWorkflowTemplateForTicket(ticket);
    const workflowDef = template?.raw || template;
    const campos = resolveRequisicaoCamposForApproval(workflowDef);
    const valores = readRequisicaoValores(ticket);
    const contextFields = [
      { label: 'Protocolo', value: getTicketProtocolLabel(ticket) || '—', tone: 'default' },
      ...buildTicketContextFields(ticket).map((field) => ({ ...field, tone: 'default' })),
    ];
    const requisicaoFields = campos.map((campo) => {
      const raw = resolveRequisicaoValor(valores, campo);
      return {
        label: campo.label,
        value: formatRequisicaoDisplayValue(campo, raw),
        tone: 'default',
      };
    });

    const partialDetail = {
      ticketId: String(ticket.id),
      title: header.title,
      statusBadge: header.statusLabel,
      metaLine: `Ticket #${protocol} · ${ticket.clientName || ticket.solicitante || 'Cliente'} · aberto por ${openedBy} em ${formatDateTime(openedAt)}`,
      responsibleAgent: openedBy,
      actions: [],
      actionLabels: {},
      cardTitle: ticket.title || lf.motivo || 'Workflow',
      cardSubtext: `Atualizado ${formatRelativeTime(ticket.updatedAt)}`,
      fieldSections: requisicaoFields.length
        ? [{ title: 'Dados da requisição', fields: requisicaoFields }]
        : [],
      fields: [...contextFields, ...requisicaoFields],
      justificationQuote: getFirstClientMessage(ticket),
      internalNote: getInternalForwardingNote(ticket),
    };

    const solicitacaoFinanceiro = resolveSolicitacaoFinanceiroForTicket(ticket);
    const solicitacaoProdutos = resolveSolicitacaoProdutosForTicket(ticket);

    if (solicitacaoFinanceiro) {
      const financeiroDetail = buildFinanceiroSolicitacaoDetail(ticket, null, solicitacaoFinanceiro);
      return {
        ...partialDetail,
        ...financeiroDetail,
        essentials: buildFinanceiroApprovalEssentials(ticket, solicitacaoFinanceiro, { requisicaoFields }),
      };
    }

    return {
      ...partialDetail,
      essentials: buildWorkflowApprovalEssentials(
        ticket,
        solicitacaoProdutos,
        { requisicaoFields },
      ),
    };
  }

  const template = getWorkflowTemplateForTicket(ticket);
  const wfSlug = lf.workflow?.definicaoSlug
    || lf.workflow?.templateId
    || template?.id
    || ticket.workflow?.workflowId
    || '';
  const detailResolver = header.detailResolver === 'generic' && wfSlug === 'escalonar-produtos'
    ? 'escalonar-produtos'
    : header.detailResolver;

  let resolver = buildDynamicApprovalDetail;
  let resolverArgs = [ticket, progress, header];
  let detail = null;

  if (detailResolver === 'reembolso-7dias') {
    resolver = buildReembolsoApprovalDetail;
  } else if (detailResolver === 'escalonar-produtos') {
    const solicitacao = resolveSolicitacaoProdutosForTicket(ticket);
    if (solicitacao) {
      const baseDetail = buildDynamicApprovalDetail(ticket, progress, header);
      const produtosAddon = buildProdutosSolicitacaoAddon(ticket, progress, solicitacao);
      detail = {
        ...baseDetail,
        produtosAddon,
        layout: produtosAddon?.layout || 'produtos-generic',
      };
    } else {
      resolver = buildProdutosGenericDetail;
    }
  } else {
    const solicitacaoFinanceiro = resolveSolicitacaoFinanceiroForTicket(ticket);
    const solicitacao = resolveSolicitacaoProdutosForTicket(ticket);
    if (solicitacaoFinanceiro) {
      resolver = buildFinanceiroSolicitacaoDetail;
      resolverArgs = [ticket, progress, solicitacaoFinanceiro];
    } else if (solicitacao?.categoria === 'erros-bugs') {
      resolver = buildProdutosErrosBugsDetail;
      resolverArgs = [ticket, progress, header, solicitacao];
    } else if (solicitacao?.categoria === 'liberacao-pix') {
      resolver = buildProdutosPixDetail;
      resolverArgs = [ticket, progress, header, solicitacao];
    } else if (solicitacao?.categoria === 'documentos') {
      resolver = buildProdutosDocumentosDetail;
      resolverArgs = [ticket, progress, header, solicitacao];
    } else if (solicitacao?.categoria === 'solicitacoes' || solicitacao?.tipoSolicitacao) {
      resolver = buildProdutosCadastralDetail;
      resolverArgs = [ticket, progress, header, solicitacao];
    }
  }

  if (!detail) {
    detail = resolver(...resolverArgs);
  }

  const solicitacaoFinanceiro = resolveSolicitacaoFinanceiroForTicket(ticket);
  const solicitacao = resolveSolicitacaoProdutosForTicket(ticket);
  const essentials = solicitacaoFinanceiro
    ? buildFinanceiroApprovalEssentials(
      ticket,
      solicitacaoFinanceiro,
      { requisicaoFields: extractRequisicaoFieldsFromDetail(detail) },
    )
    : buildWorkflowApprovalEssentials(
      ticket,
      solicitacao,
      { requisicaoFields: extractRequisicaoFieldsFromDetail(detail) },
    );

  return {
    ticketId: String(ticket.id),
    title: header.title,
    statusBadge: header.statusLabel,
    metaLine: `Ticket #${protocol} · ${ticket.clientName || ticket.solicitante || 'Cliente'} · aberto por ${openedBy} em ${formatDateTime(openedAt)}`,
    responsibleAgent: openedBy,
    actions: header.actions,
    actionLabels: Object.fromEntries((header.rotas || []).map((r) => [r.variavel, r.rotulo]).filter(([k]) => k)),
    essentials,
    ...detail,
  };
}

function collectAssigneeWorkflowEntries() {
  const items = [];

  getAllCockpitTickets().forEach((entry) => {
    const { ticket } = entry;
    if (isWorkflowStatusOffApprovalConsole(ticket)) return;
    if (!isTicketWorkflowActive(ticket)) return;
    if (!agentCanDecideTicket(ticket)) return;
    const progress = getWorkflowProgress(ticket);
    items.push({ entry, progress, queueItem: buildQueueItem(entry) });
  });

  return items;
}

function sortAssigneeQueueEntries(items) {
  return [...items].sort((a, b) => {
    const rank = (item) => {
      const { queueItem } = item;
      if (queueItem.awaitingDecision) return 0;
      if (queueItem.queueStatus === 'etapa-ativa') return 1;
      if (queueItem.queueStatus === 'aguardando') return 2;
      return 3;
    };
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;

    const prio = { critical: 0, warn: 1, ok: 2 };
    const slaDiff = (prio[a.queueItem.slaTone] || 9) - (prio[b.queueItem.slaTone] || 9);
    if (slaDiff !== 0) return slaDiff;

    const aTime = new Date(a.entry.ticket.updatedAt || a.entry.ticket.createdAt || 0).getTime();
    const bTime = new Date(b.entry.ticket.updatedAt || b.entry.ticket.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

export function computeWorkflowAssigneeQueue() {
  const entries = sortAssigneeQueueEntries(collectAssigneeWorkflowEntries());
  let slaCritical = 0;
  let awaitingDecisionCount = 0;

  entries.forEach((item) => {
    if (item.queueItem.slaTone === 'critical' || item.queueItem.slaTone === 'warn') slaCritical += 1;
    if (item.queueItem.awaitingDecision) awaitingDecisionCount += 1;
  });

  return {
    teamId: null,
    queueLabel: 'Minha fila de workflow',
    queue: entries.map((item) => item.queueItem),
    summary: {
      pendingCount: entries.length,
      awaitingDecisionCount,
      approvedTodayCount: countApprovedToday(),
      slaCriticalCount: slaCritical,
    },
    entries,
  };
}

function collectTeamWorkflowEntries(teamId) {
  const items = [];

  getAllCockpitTickets().forEach((entry) => {
    const { ticket } = entry;
    if (isWorkflowStatusOffApprovalConsole(ticket)) return;
    if (!isTicketWorkflowActive(ticket)) return;
    // Inclusão: quem decide se o ticket aparece é o atribuído atual (eu ou meu grupo),
    // não apenas "há workflow ativo" — mesmo critério usado em getWorkflowTeamDetail,
    // para a lista nunca mostrar um ticket que o detalhe já não consegue abrir.
    const atribuidoNoTime = ticketAtribuidoMatchesWorkflowQueue(ticket, teamId);
    const atribuidoNoAgente = agentCanDecideTicket(ticket) && ticketMatchesWorkflowTeam(ticket, teamId);
    if (!atribuidoNoTime && !atribuidoNoAgente) return;
    const progress = getWorkflowProgress(ticket);
    items.push({ entry, progress, queueItem: buildQueueItem(entry, teamId) });
  });

  return items;
}

function sortTeamQueueEntries(items, teamId) {
  return [...items].sort((a, b) => {
    const rank = (item) => {
      const { queueItem } = item;
      if (queueItem.awaitingDecision) return 0;
      if (queueItem.teamStepActive) return 1;
      if (queueItem.queueStatus === 'aguardando') return 2;
      return 3;
    };
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;

    const prio = { critical: 0, warn: 1, ok: 2 };
    const slaDiff = (prio[a.queueItem.slaTone] || 9) - (prio[b.queueItem.slaTone] || 9);
    if (slaDiff !== 0) return slaDiff;

    const aTime = new Date(a.entry.ticket.updatedAt || a.entry.ticket.createdAt || 0).getTime();
    const bTime = new Date(b.entry.ticket.updatedAt || b.entry.ticket.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function collectPendingEntries() {
  const pending = [];

  getAllCockpitTickets().forEach((entry) => {
    const { ticket } = entry;
    if (isWorkflowStatusOffApprovalConsole(ticket)) return;
    if (!isTicketWorkflowActive(ticket)) return;
    if (!agentCanDecideTicket(ticket)) return;
    const progress = getWorkflowProgress(ticket);
    if (!ticketAwaitingDecision(ticket, progress)) return;
    pending.push({ entry, progress, queueItem: buildQueueItem(entry) });
  });

  return pending;
}

function countApprovedToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  getAllCockpitTickets().forEach(({ ticket }) => {
    const wf = ticket.lateralForm?.workflow;
    if (!wf?.stepHistory) return;
    wf.stepHistory.forEach((h) => {
      if (h.status !== 'completed') return;
      if (h.decision !== 'approved' && h.trigger !== 'decision-approve') return;
      if (h.at && new Date(h.at) >= today) count += 1;
    });
  });
  return count || 8;
}

export function computeWorkflowTeamQueue(teamId, options = {}) {
  const meta = getWorkflowTeamQueueMeta(teamId);
  const label = meta?.name || teamId;
  const finalizedView = options.view === 'finalizados' || options.view === 'respondidos';
  let entries = sortTeamQueueEntries(collectTeamWorkflowEntries(teamId), teamId);
  entries = entries.filter(({ entry }) => !isWorkflowStatusOffApprovalConsole(entry.ticket));
  if (!finalizedView) {
    entries = entries.filter(({ entry }) => !isWorkflowTicketCompleted(entry.ticket));
  }
  let slaCritical = 0;
  let awaitingDecisionCount = 0;

  entries.forEach((item) => {
    if (item.queueItem.slaTone === 'critical' || item.queueItem.slaTone === 'warn') slaCritical += 1;
    if (item.queueItem.awaitingDecision) awaitingDecisionCount += 1;
  });

  return {
    teamId,
    queueLabel: finalizedView ? `${label} · Finalizados` : label,
    queue: entries.map((item) => item.queueItem),
    summary: {
      pendingCount: entries.length,
      awaitingDecisionCount,
      approvedTodayCount: countApprovedToday(),
      slaCriticalCount: slaCritical,
    },
    entries,
    view: finalizedView ? 'finalizados' : null,
  };
}

export function computeWorkflowApprovalQueue() {
  const pending = collectPendingEntries();
  let slaCritical = 0;

  pending.forEach((p) => {
    if (p.queueItem.slaTone === 'critical' || p.queueItem.slaTone === 'warn') slaCritical += 1;
  });

  pending.sort((a, b) => {
    const prio = { critical: 0, warn: 1, ok: 2 };
    return (prio[a.queueItem.slaTone] || 9) - (prio[b.queueItem.slaTone] || 9);
  });

  const queueLabel = pending[0]?.queueItem?.queueLabel || QUEUE_LABEL;

  return {
    queueLabel,
    queue: pending.map((p) => p.queueItem),
    summary: {
      pendingCount: pending.length,
      approvedTodayCount: countApprovedToday(),
      slaCriticalCount: slaCritical || (pending.some((p) => p.queueItem.slaTone === 'critical') ? 1 : 0),
    },
    entries: pending,
  };
}

export function getWorkflowTeamDetail(ticketId, teamId) {
  const id = String(ticketId);
  const match = getAllCockpitTickets().find(({ ticket }) => String(ticket.id) === id);
  if (!match || isWorkflowStatusOffApprovalConsole(match.ticket) || !isTicketWorkflowActive(match.ticket)) {
    return null;
  }
  const atribuidoNoTime = ticketAtribuidoMatchesWorkflowQueue(match.ticket, teamId);
  const atribuidoNoAgente = agentCanDecideTicket(match.ticket)
    && ticketMatchesWorkflowTeam(match.ticket, teamId);
  if (!atribuidoNoTime && !atribuidoNoAgente) return null;

  const progress = getWorkflowProgress(match.ticket);
  const awaitingDecision = ticketAwaitingDecision(match.ticket, progress);
  const teamStepActive = isTeamStepActive(match.ticket, teamId, progress);
  const detail = buildDetailView(match.ticket, progress);
  const activeStepTitle = progress?.activeStep?.title || progress?.activeStep?.label || 'etapa anterior';

  return {
    ...detail,
    ticket: match.ticket,
    awaitingDecision,
    teamStepActive,
    statusBadge: awaitingDecision
      ? detail.statusBadge
      : teamStepActive
        ? 'Etapa do time'
        : 'Aguardando etapa anterior',
    statusMessage: !awaitingDecision && !teamStepActive
      ? `Este ticket está na etapa "${activeStepTitle}" antes do time ${getWorkflowTeamQueueMeta(teamId)?.name || teamId}.`
      : null,
    actions: awaitingDecision ? detail.actions : [],
  };
}

export function getWorkflowAssigneeDetail(ticketId) {
  const id = String(ticketId);
  const match = getAllCockpitTickets().find(({ ticket }) => String(ticket.id) === id);
  if (!match || isWorkflowStatusOffApprovalConsole(match.ticket) || !agentCanDecideTicket(match.ticket)) {
    return null;
  }

  const progress = getWorkflowProgress(match.ticket);
  const awaitingDecision = ticketAwaitingDecision(match.ticket, progress);
  const detail = buildDetailView(match.ticket, progress);
  const activeStepTitle = progress?.activeStep?.title || progress?.activeStep?.label || 'etapa anterior';

  return {
    ...detail,
    ticket: match.ticket,
    awaitingDecision,
    teamStepActive: !awaitingDecision,
    statusBadge: awaitingDecision ? detail.statusBadge : 'Etapa atribuída',
    statusMessage: !awaitingDecision
      ? `Este ticket está na etapa "${activeStepTitle}" atribuída a você ou ao seu grupo.`
      : null,
    actions: awaitingDecision ? detail.actions : [],
  };
}

export function getWorkflowApprovalDetail(ticketId, teamId = null) {
  if (teamId) return getWorkflowTeamDetail(ticketId, teamId);

  const assigneeDetail = getWorkflowAssigneeDetail(ticketId);
  if (assigneeDetail) return assigneeDetail;

  const id = String(ticketId);
  let match = getAllCockpitTickets().find(({ ticket }) => String(ticket.id) === id);
  if (!match) return null;
  if (isWorkflowStatusOffApprovalConsole(match.ticket) || !isTicketWorkflowActive(match.ticket)) {
    return null;
  }
  const progress = getWorkflowProgress(match.ticket);
  if (!ticketAwaitingDecision(match.ticket, progress)) return null;
  return buildDetailView(match.ticket, progress);
}

export function findTicketEntryById(ticketId) {
  const id = String(ticketId);
  return getAllCockpitTickets().find(({ ticket }) => String(ticket.id) === id)
    || null;
}

export function getWorkflowTeamActionCounts() {
  const counts = {};
  for (const { id } of WORKFLOW_TEAM_QUEUES) {
    counts[id] = collectTeamWorkflowEntries(id).filter(
      ({ queueItem }) => queueItem.awaitingDecision || queueItem.teamStepActive,
    ).length;
  }
  return counts;
}
