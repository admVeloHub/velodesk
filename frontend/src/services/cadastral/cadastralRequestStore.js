/**
 * cadastralRequestStore — solicitações ao time de Produtos (local v1)
 */
import { getAgentName } from '../desk/utils';
import { updateTicketInCache } from '../ticketsStorage';
import {
  getCategoriaTitulo,
  getTipoInformacaoLabel,
  SOLICITACAO_STATUS,
} from './solicitacoesProdutosData';

const STORAGE_KEY = 'velodesk_cadastral_requests';
const UPDATED_AT_KEY = 'velodesk_cadastral_requests_updated_at';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  localStorage.setItem(UPDATED_AT_KEY, new Date().toISOString());
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function buildTitulo(categoria, cpfDigits, payload) {
  const cpfPlain = String(cpfDigits || '').replace(/\D/g, '');
  const label = getCategoriaTitulo(categoria, payload);
  return `${cpfPlain} - ${label}`;
}

function normalizeLegacyItem(item) {
  if (item.categoria === 'erros-bugs') {
    return {
      ...item,
      status: item.status === 'feito' ? SOLICITACAO_STATUS.FEITO : SOLICITACAO_STATUS.ENVIADO,
      ticketId: item.ticketId || '',
      tipoErro: item.tipoErro || 'app',
      marca: item.marca || '',
      modelo: item.modelo || '',
      clienteRecusouEvidencias: Boolean(item.clienteRecusouEvidencias),
      anexosImagens: Array.isArray(item.anexosImagens) ? item.anexosImagens : [],
      anexosVideos: Array.isArray(item.anexosVideos) ? item.anexosVideos : [],
      observacoes: item.observacoes || item.dadoNovo || '',
      urgente: Boolean(item.urgente),
      titulo: item.titulo || buildTitulo('erros-bugs', item.cpf, item),
    };
  }

  if (item.categoria === 'liberacao-pix') {
    return {
      ...item,
      status: item.status === 'feito' ? SOLICITACAO_STATUS.FEITO : SOLICITACAO_STATUS.ENVIADO,
      ticketId: item.ticketId || '',
      urgente: Boolean(item.urgente),
      titulo: item.titulo || buildTitulo('liberacao-pix', item.cpf, item),
    };
  }

  if (item.categoria && item.status) return item;

  return {
    ...item,
    categoria: 'solicitacoes',
    status: item.status === 'feito' ? SOLICITACAO_STATUS.FEITO : SOLICITACAO_STATUS.ENVIADO,
    ticketId: item.ticketId || '',
    tipoSolicitacao: item.tipoSolicitacao || 'alteracao-dados-cadastrais',
    tipoInformacao: item.tipoInformacao || (item.campos?.[0] || 'telefone'),
    fotosVerificadas: Boolean(item.fotosVerificadas),
    dadoAntigo: item.dadoAntigo || '',
    dadoNovo: item.dadoNovo || item.descricao || '',
    observacoes: item.observacoes || item.descricao || '',
    urgente: Boolean(item.urgente),
    titulo: item.titulo || buildTitulo('solicitacoes', item.cpf, item),
  };
}

function seedDemoIfEmpty() {
  const existing = readAll();
  if (existing.length) return existing.map(normalizeLegacyItem);

  const now = Date.now();
  const demo = [
    {
      id: 'cad-demo-1',
      categoria: 'solicitacoes',
      status: SOLICITACAO_STATUS.ENVIADO,
      cpf: '215.234.738-27',
      ticketId: 'TK-1024',
      tipoSolicitacao: 'alteracao-dados-cadastrais',
      tipoInformacao: 'telefone',
      fotosVerificadas: true,
      dadoAntigo: '(11) 99999-0000',
      dadoNovo: '(11) 98888-7777',
      observacoes: '',
      urgente: false,
      destino: 'produtos',
      createdAt: new Date(now - 3600000).toISOString(),
      titulo: '21523473827 - Alteração de Dados Cadastrais',
    },
    {
      id: 'cad-demo-2',
      categoria: 'solicitacoes',
      status: SOLICITACAO_STATUS.FEITO,
      cpf: '123.456.789-00',
      ticketId: 'TK-998',
      tipoSolicitacao: 'alteracao-dados-cadastrais',
      tipoInformacao: 'email',
      fotosVerificadas: false,
      dadoAntigo: 'antigo@email.com',
      dadoNovo: 'novo@email.com',
      observacoes: 'Cliente confirmou por telefone.',
      urgente: false,
      destino: 'produtos',
      createdAt: new Date(now - 86400000).toISOString(),
      titulo: '12345678900 - Alteração de Dados Cadastrais',
    },
    {
      id: 'cad-demo-3',
      categoria: 'solicitacoes',
      status: SOLICITACAO_STATUS.ENVIADO,
      cpf: '987.654.321-00',
      ticketId: 'TK-1201',
      tipoSolicitacao: 'alteracao-dados-cadastrais',
      tipoInformacao: 'nome',
      fotosVerificadas: true,
      dadoAntigo: 'Maria Silva',
      dadoNovo: 'Maria Silva Santos',
      observacoes: '',
      urgente: true,
      destino: 'produtos',
      createdAt: new Date(now - 7200000).toISOString(),
      titulo: '98765432100 - Alteração de Dados Cadastrais',
    },
  ];
  writeAll(demo);
  return demo;
}

function getAllNormalized() {
  return seedDemoIfEmpty().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getLastUpdatedAt() {
  const raw = localStorage.getItem(UPDATED_AT_KEY);
  if (raw) return raw;
  const items = readAll();
  if (!items.length) return new Date().toISOString();
  return items[0]?.createdAt || new Date().toISOString();
}

export function loadSolicitacoes(categoria) {
  const all = getAllNormalized();
  if (!categoria) return all;
  return all.filter((item) => item.categoria === categoria);
}

export function loadCadastralRequests(categoria) {
  return loadSolicitacoes(categoria);
}

export function searchSolicitacoesByCpf(cpf, categoria) {
  const digits = String(cpf || '').replace(/\D/g, '');
  if (!digits) return loadSolicitacoes(categoria);
  return loadSolicitacoes(categoria).filter((item) =>
    String(item.cpf || '').replace(/\D/g, '').includes(digits)
  );
}

export function getSolicitacoesStats(categoria) {
  const items = loadSolicitacoes(categoria);
  const today = new Date();
  let hoje = 0;
  let pendentes = 0;
  let feitas = 0;

  items.forEach((item) => {
    const created = new Date(item.createdAt);
    if (isSameDay(created, today)) hoje += 1;
    if (item.status === SOLICITACAO_STATUS.FEITO) feitas += 1;
    else pendentes += 1;
  });

  return { hoje, pendentes, feitas };
}

export function saveCadastralRequest(payload) {
  const cpfDigits = String(payload.cpf || '').replace(/\D/g, '');
  const categoria = payload.categoria || 'solicitacoes';
  const request = normalizeLegacyItem({
    id: `cad-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: SOLICITACAO_STATUS.ENVIADO,
    destino: 'produtos',
    createdAt: new Date().toISOString(),
    ...payload,
    cpf: payload.cpf,
    titulo: buildTitulo(categoria, cpfDigits, payload),
  });

  const next = [request, ...readAll().map(normalizeLegacyItem)];
  writeAll(next);
  return request;
}

export function markSolicitacaoFeita(id) {
  const next = readAll().map(normalizeLegacyItem).map((item) =>
    item.id === id ? { ...item, status: SOLICITACAO_STATUS.FEITO } : item
  );
  writeAll(next);
  return next.find((item) => item.id === id) || null;
}

export function getCadastroFieldLabel(fieldId) {
  return getTipoInformacaoLabel(fieldId);
}

function normalizeTicketLookupKey(value) {
  return String(value || '').trim().toLowerCase();
}

export function findCadastralRequestByTicketId(ticketId) {
  const key = normalizeTicketLookupKey(ticketId);
  if (!key) return null;

  return getAllNormalized().find((item) => {
    const itemKey = normalizeTicketLookupKey(item.ticketId);
    if (!itemKey) return false;
    return itemKey === key || itemKey.includes(key) || key.includes(itemKey);
  }) || null;
}

export async function persistSolicitacaoProdutosOnTicket(ticketId, request) {
  const id = String(ticketId || '').trim();
  if (!id || !request) return null;

  const snapshot = {
    ...request,
    colaborador: request.colaborador || getAgentName() || '',
  };

  await updateTicketInCache(id, (ticket) => {
    ticket.lateralForm = {
      ...(ticket.lateralForm || {}),
      solicitacaoProdutos: snapshot,
    };
  });

  return snapshot;
}

/** Metadados de arquivo para persistência local (sem blob) */
export function toAttachmentMetadata(file) {
  return {
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
  };
}
