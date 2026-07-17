/**
 * reclameAquiStore — reclamações RA (localStorage v1)
 */
import {
  RA_GROUPS,
  RA_STATUS,
  RA_WHATSAPP_DEFAULT_MSG,
  computeIniciais,
} from './reclameAquiData';

const STORAGE_KEY = 'velodesk_reclame_aqui_items';

function todayAt(hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function daysFromNow(days, hour = 18) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const SEED_ITEMS = [
  {
    id: 'ra-001',
    consumidor: 'João Ferreira',
    iniciais: 'JF',
    assunto: 'Cancelamento não processado',
    statusRa: RA_STATUS.NAO_RESPONDIDA,
    slaPct: 95,
    slaTone: 'red',
    prazoRa: todayAt(18, 0),
    passivelNota: true,
    workflow: '—',
    tabulacao: 'Produto X',
    atendente: '—',
    groupKey: 'vencendo-hoje',
    respostaAction: 'responder',
    aberta: true,
    workflowAtivo: false,
  },
  {
    id: 'ra-002',
    consumidor: 'Carlos Barros',
    iniciais: 'CB',
    assunto: 'Cobrança indevida no cartão',
    statusRa: RA_STATUS.NAO_RESPONDIDA,
    slaPct: 88,
    slaTone: 'red',
    prazoRa: todayAt(20, 0),
    passivelNota: true,
    workflow: '—',
    tabulacao: 'Financeiro',
    atendente: '—',
    groupKey: 'vencendo-hoje',
    respostaAction: 'responder',
    aberta: true,
    workflowAtivo: false,
  },
  {
    id: 'ra-003',
    protocoloRa: 'RA-2026-00394821',
    consumidor: 'Maria Oliveira',
    iniciais: 'MO',
    cpf: '123.456.789-01',
    telefoneWhatsapp: '(11) 99821-3344',
    assunto: 'Internet cai toda noite após 22h',
    descricao:
      'Contratei fibra óptica há 3 meses e, quase todas as noites após 22h, a internet fica completamente inacessível. Já reiniciei o roteador diversas vezes e o problema persiste. Preciso de solução urgente pois trabalho em home office.',
    idReclamacaoRa: 'RA-EXT-394821',
    dataReclamacao: daysFromNow(-2, 14),
    produto: 'Fibra residencial',
    tipo: 'Reclamação',
    motivo: 'Lentidão / Instabilidade',
    respostaPublica: '',
    whatsappMensagem: RA_WHATSAPP_DEFAULT_MSG,
    statusRa: RA_STATUS.NAO_RESPONDIDA,
    slaPct: 72,
    slaTone: 'yellow',
    prazoRa: daysFromNow(2, 18),
    passivelNota: true,
    workflow: '—',
    tabulacao: 'Produto X',
    atendente: 'Ana Silva',
    groupKey: 'nao-respondidas',
    respostaAction: 'responder',
    aberta: true,
    workflowAtivo: false,
    isDraft: false,
  },
  {
    id: 'ra-004',
    consumidor: 'Lúcia Santos',
    iniciais: 'LS',
    assunto: 'Dificuldade para cancelar assinatura',
    statusRa: RA_STATUS.WORKFLOW_ATIVO,
    slaPct: 65,
    slaTone: 'yellow',
    prazoRa: daysFromNow(2),
    passivelNota: true,
    workflow: 'Cancelamento',
    tabulacao: 'TV',
    atendente: 'Pedro Lima',
    groupKey: 'nao-respondidas',
    respostaAction: 'responder',
    aberta: true,
    workflowAtivo: true,
  },
  {
    id: 'ra-005',
    consumidor: 'Roberto Almeida',
    iniciais: 'RA',
    assunto: 'Produto diferente do anunciado',
    statusRa: RA_STATUS.NAO_RESPONDIDA,
    slaPct: 58,
    slaTone: 'yellow',
    prazoRa: daysFromNow(3),
    passivelNota: false,
    workflow: '—',
    tabulacao: 'Combo',
    atendente: '—',
    groupKey: 'nao-respondidas',
    respostaAction: 'responder',
    aberta: true,
    workflowAtivo: false,
  },
  {
    id: 'ra-006',
    consumidor: 'Fernanda Costa',
    iniciais: 'FC',
    assunto: 'Estorno não creditado',
    statusRa: RA_STATUS.WORKFLOW_ATIVO,
    slaPct: 45,
    slaTone: 'green',
    prazoRa: daysFromNow(4),
    passivelNota: true,
    workflow: 'Reembolso',
    tabulacao: 'Financeiro',
    atendente: 'Carla Mendes',
    groupKey: 'nao-respondidas',
    respostaAction: 'responder',
    aberta: true,
    workflowAtivo: true,
  },
  {
    id: 'ra-007',
    consumidor: 'Patricia Nunes',
    iniciais: 'PN',
    assunto: 'Atendimento telefônico insatisfatório',
    statusRa: RA_STATUS.NAO_RESPONDIDA,
    slaPct: 40,
    slaTone: 'green',
    prazoRa: daysFromNow(5),
    passivelNota: true,
    workflow: '—',
    tabulacao: 'Telefone',
    atendente: '—',
    groupKey: 'nao-respondidas',
    respostaAction: 'responder',
    aberta: true,
    workflowAtivo: false,
  },
  {
    id: 'ra-008',
    consumidor: 'Paula Rezende',
    iniciais: 'PR',
    assunto: 'Reclamação resolvida — aguardando avaliação',
    statusRa: RA_STATUS.AGUARD_AVALIACAO,
    slaPct: 100,
    slaTone: 'green',
    prazoRa: daysFromNow(-1),
    passivelNota: true,
    workflow: '—',
    tabulacao: 'Produto X',
    atendente: 'Ana Silva',
    groupKey: 'respondidas',
    respostaAction: 'avaliacao',
    aberta: false,
    workflowAtivo: false,
    nota: 4,
  },
  {
    id: 'ra-009',
    consumidor: 'André Macedo',
    iniciais: 'AM',
    assunto: 'Problema resolvido com reembolso',
    statusRa: RA_STATUS.RESPONDIDA,
    slaPct: 100,
    slaTone: 'green',
    prazoRa: daysFromNow(-2),
    passivelNota: false,
    workflow: 'Reembolso',
    tabulacao: 'Financeiro',
    atendente: 'Pedro Lima',
    groupKey: 'respondidas',
    respostaAction: 'ver-resposta',
    aberta: false,
    workflowAtivo: false,
    nota: 5,
  },
  {
    id: 'ra-010',
    consumidor: 'Camila Souza',
    iniciais: 'CS',
    assunto: 'Dúvida esclarecida sobre fatura',
    statusRa: RA_STATUS.RESPONDIDA,
    slaPct: 100,
    slaTone: 'green',
    prazoRa: daysFromNow(-3),
    passivelNota: false,
    workflow: '—',
    tabulacao: 'Internet Fibra',
    atendente: 'Carla Mendes',
    groupKey: 'respondidas',
    respostaAction: 'ver-resposta',
    aberta: false,
    workflowAtivo: false,
    nota: 4,
  },
];

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeAll(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function ensureReclameAquiSeed() {
  const existing = readAll();
  if (existing?.length) return existing;
  writeAll(SEED_ITEMS);
  return SEED_ITEMS;
}

export function loadAllReclamacoes() {
  return ensureReclameAquiSeed();
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function matchesSearch(item, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.consumidor.toLowerCase().includes(q)
    || item.assunto.toLowerCase().includes(q)
    || item.tabulacao.toLowerCase().includes(q)
    || (item.atendente && item.atendente.toLowerCase().includes(q))
  );
}

function matchesChip(item, chipId) {
  if (!chipId) return true;
  switch (chipId) {
    case 'nao-respondidas':
      return item.statusRa === RA_STATUS.NAO_RESPONDIDA || item.groupKey === 'nao-respondidas';
    case 'abertas':
      return item.aberta;
    case 'passivel-nota':
      return item.passivelNota;
    case 'workflow-ativo':
      return item.workflowAtivo;
    case 'vencendo-hoje':
      return item.groupKey === 'vencendo-hoje';
    default:
      return true;
  }
}

export function loadReclamacoes({ search = '', activeChips = [] } = {}) {
  const items = loadAllReclamacoes();
  return items.filter((item) => {
    if (!matchesSearch(item, search)) return false;
    if (activeChips.length && !activeChips.every((chip) => matchesChip(item, chip))) return false;
    return true;
  });
}

export function getReclameAquiKpis(items = loadAllReclamacoes()) {
  const today = new Date();
  const vencendoHoje = items.filter((i) => {
    const d = new Date(i.prazoRa);
    return isSameDay(d, today) && i.aberta;
  }).length;
  const naoRespondidas = items.filter((i) =>
    i.statusRa === RA_STATUS.NAO_RESPONDIDA || i.groupKey === 'nao-respondidas',
  ).length;
  const respondidas = items.filter((i) =>
    i.statusRa === RA_STATUS.RESPONDIDA || i.statusRa === RA_STATUS.AGUARD_AVALIACAO,
  ).length;
  const workflowAtivo = items.filter((i) => i.workflowAtivo).length;
  const notas = items.filter((i) => typeof i.nota === 'number').map((i) => i.nota);
  const notaMedia = notas.length
    ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1)
    : '—';
  const respondidasComPrazo = items.filter((i) => !i.aberta);
  const noPrazo = respondidasComPrazo.filter((i) => i.slaPct >= 80).length;
  const pctNoPrazo = respondidasComPrazo.length
    ? Math.round((noPrazo / respondidasComPrazo.length) * 100)
    : 0;

  return [
    { id: 'vencendo', label: 'Vencendo hoje', value: String(vencendoHoje), tone: 'danger', icon: 'ti-clock-exclamation' },
    { id: 'nao-resp', label: 'Não respondidas', value: String(naoRespondidas), tone: 'warning', icon: 'ti-message-exclamation' },
    { id: 'respondidas', label: 'Respondidas', value: String(respondidas), tone: 'info', icon: 'ti-message-check' },
    { id: 'workflow', label: 'Workflow ativo', value: String(workflowAtivo), tone: 'purple', icon: 'ti-arrows-exchange' },
    { id: 'nota', label: 'Nota média', value: String(notaMedia), tone: 'success', icon: 'ti-star' },
    { id: 'prazo', label: 'Respondidas no prazo', value: `${pctNoPrazo}%`, tone: 'yellow', icon: 'ti-percentage' },
  ];
}

export function groupReclamacoesByStatus(items) {
  return RA_GROUPS.map((group) => ({
    ...group,
    items: items.filter((i) => i.groupKey === group.id),
  })).filter((g) => g.items.length > 0);
}

export function getKanbanColumns(items) {
  const extra = { id: 'workflow-ativo', label: 'Workflow ativo', tone: 'purple' };
  const cols = [...RA_GROUPS.filter((g) => g.id !== 'respondidas'), extra, RA_GROUPS.find((g) => g.id === 'respondidas')];
  return cols.map((col) => {
    let colItems = [];
    if (col.id === 'workflow-ativo') {
      colItems = items.filter((i) => i.workflowAtivo && i.groupKey !== 'respondidas');
    } else {
      colItems = items.filter((i) => i.groupKey === col.id);
    }
    return { ...col, items: colItems };
  }).filter((c) => c.items.length > 0 || c.id === 'nao-respondidas');
}

export function formatPrazoRa(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

export function getCalendarEvents(items, year, month) {
  return items.filter((item) => {
    const d = new Date(item.prazoRa);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function getReportSeries(items = loadAllReclamacoes()) {
  const byStatus = {
    'Não respondida': items.filter((i) => i.statusRa === RA_STATUS.NAO_RESPONDIDA).length,
    'Workflow ativo': items.filter((i) => i.workflowAtivo).length,
    Respondida: items.filter((i) => i.statusRa === RA_STATUS.RESPONDIDA).length,
    'Aguard. avaliação': items.filter((i) => i.statusRa === RA_STATUS.AGUARD_AVALIACAO).length,
  };
  const slaBuckets = {
    'No prazo (≥80%)': items.filter((i) => i.slaPct >= 80).length,
    'Atenção (50–79%)': items.filter((i) => i.slaPct >= 50 && i.slaPct < 80).length,
    'Crítico (<50%)': items.filter((i) => i.slaPct < 50).length,
  };
  const notas = items.filter((i) => typeof i.nota === 'number');
  const notaDistrib = [1, 2, 3, 4, 5].map((n) => ({
    label: `${n} estrela${n > 1 ? 's' : ''}`,
    value: notas.filter((i) => i.nota === n).length,
  }));
  return { byStatus, slaBuckets, notaDistrib, total: items.length };
}

export function getFooterSummary(items, selectedCount = 0) {
  const naoResp = items.filter((i) => i.statusRa === RA_STATUS.NAO_RESPONDIDA).length;
  const sel = selectedCount > 0 ? ` · ${selectedCount} selecionada${selectedCount > 1 ? 's' : ''}` : '';
  return `${items.length} reclamações · ${naoResp} não respondidas${sel}`;
}

function computeSlaFromPrazo(prazoRa) {
  const diff = new Date(prazoRa).getTime() - Date.now();
  const totalMs = 3 * 24 * 60 * 60 * 1000;
  const pct = Math.max(0, Math.min(100, Math.round((diff / totalMs) * 100)));
  let tone = 'green';
  if (pct < 50) tone = 'red';
  else if (pct < 80) tone = 'yellow';
  return { slaPct: pct, slaTone: tone };
}

export function generateProtocolo() {
  const year = new Date().getFullYear();
  const items = loadAllReclamacoes();
  const nums = items
    .map((i) => i.protocoloRa)
    .filter(Boolean)
    .map((p) => parseInt(String(p).split('-').pop(), 10))
    .filter((n) => !Number.isNaN(n));
  const next = Math.max(394821, ...nums, 0) + 1;
  return `RA-${year}-${String(next).padStart(8, '0')}`;
}

export function buildRegistroDefaults(item = {}) {
  const now = new Date().toISOString();
  const prazoRa = item.prazoRa || daysFromNow(3, 18);
  const sla = computeSlaFromPrazo(prazoRa);
  return {
    protocoloRa: item.protocoloRa || generateProtocolo(),
    consumidor: item.consumidor || '',
    iniciais: item.iniciais || computeIniciais(item.consumidor || ''),
    cpf: item.cpf || '',
    email: item.email || '',
    telefoneWhatsapp: item.telefoneWhatsapp || '',
    assunto: item.assunto || '',
    descricao: item.descricao || '',
    idReclamacaoRa: item.idReclamacaoRa || '',
    dataReclamacao: item.dataReclamacao || now,
    produto: item.produto || 'Fibra residencial',
    tipo: item.tipo || 'Reclamação',
    motivo: item.motivo || '',
    respostaPublica: item.respostaPublica || '',
    whatsappMensagem: item.whatsappMensagem || RA_WHATSAPP_DEFAULT_MSG,
    urlRa: item.urlRa || '',
    ticketId: item.ticketId || null,
    chamadoProtocolo: item.chamadoProtocolo || '',
    passivelNota: item.passivelNota !== false,
    statusRa: item.statusRa || RA_STATUS.NAO_RESPONDIDA,
    prazoRa,
    slaPct: item.slaPct ?? sla.slaPct,
    slaTone: item.slaTone || sla.slaTone,
    workflow: item.workflow || '—',
    tabulacao: item.tabulacao || item.produto || '—',
    atendente: item.atendente || '—',
    groupKey: item.groupKey || 'nao-respondidas',
    respostaAction: item.respostaAction || 'responder',
    aberta: item.aberta !== false,
    workflowAtivo: item.workflowAtivo || false,
    isDraft: item.isDraft ?? false,
  };
}

export function createEmptyReclamacao() {
  const id = `ra-${Date.now()}`;
  return {
    ...buildRegistroDefaults({
      protocoloRa: generateProtocolo(),
      isDraft: true,
    }),
    id,
  };
}

export function getReclamacaoById(id) {
  const items = loadAllReclamacoes();
  const found = items.find((i) => i.id === id);
  if (!found) return null;
  return { ...found, ...buildRegistroDefaults(found) };
}

function upsertReclamacao(item) {
  const items = loadAllReclamacoes();
  const idx = items.findIndex((i) => i.id === item.id);
  const normalized = {
    ...buildRegistroDefaults(item),
    ...item,
    iniciais: computeIniciais(item.consumidor || ''),
  };
  if (idx >= 0) {
    items[idx] = normalized;
  } else {
    items.unshift(normalized);
  }
  writeAll(items);
  return normalized;
}

export function saveReclamacaoDraft(item) {
  return upsertReclamacao({ ...item, isDraft: true });
}

export function registerReclamacao(item) {
  const prazoRa = item.prazoRa || daysFromNow(3, 18);
  const sla = computeSlaFromPrazo(prazoRa);
  return upsertReclamacao({
    ...item,
    isDraft: false,
    workflowAtivo: true,
    statusRa: RA_STATUS.NAO_RESPONDIDA,
    workflow: item.workflow && item.workflow !== '—' ? item.workflow : 'Tratativa RA',
    groupKey: 'nao-respondidas',
    aberta: true,
    respostaAction: 'responder',
    prazoRa,
    slaPct: sla.slaPct,
    slaTone: sla.slaTone,
  });
}
