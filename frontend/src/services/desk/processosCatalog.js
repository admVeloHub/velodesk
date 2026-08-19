/**
 * processosCatalog v1.3.4 — PDF inline + nova aba
 * VERSION: v1.3.4 | DATE: 2026-08-19
 */
import api from '../../api/client';

export async function fetchProdutos() {
  const { data } = await api.get('/processos/produtos');
  return data;
}

function normalizeForMatch(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Casa o produto já selecionado na tabulação do chamado com um produto de POPs (pastas
 * independentes) — evita pedir pro agente selecionar o produto de novo dentro de Processos.
 */
export function matchTabulacaoProdutoToPop(tabulacaoProduto, produtosPop) {
  const alvo = normalizeForMatch(tabulacaoProduto);
  if (!alvo || !produtosPop?.length) return null;

  const porLabel = produtosPop.find((p) => {
    const label = normalizeForMatch(p.label);
    return label === alvo || alvo.includes(label) || label.includes(alvo);
  });
  if (porLabel) return porLabel;

  const alvoPalavras = alvo.split(' ').filter((w) => w.length > 2);
  return produtosPop.find((p) => {
    const labelPalavras = normalizeForMatch(p.label).split(' ').filter((w) => w.length > 2);
    return labelPalavras.some((w) => alvoPalavras.includes(w));
  }) || null;
}

/** Casa o motivo da tabulação com um POP do produto já selecionado. */
export function matchTabulacaoMotivoToPopItem(motivo, pops) {
  const alvo = normalizeForMatch(motivo);
  if (!alvo || !pops?.length) return null;

  const porLabel = pops.find((pop) => {
    const label = normalizeForMatch(pop.label);
    return label === alvo || alvo.includes(label) || label.includes(alvo);
  });
  if (porLabel) return porLabel;

  const idMatch = pops.find((pop) => {
    const idAsText = normalizeForMatch(String(pop.id || '').replace(/-/g, ' '));
    return idAsText === alvo || alvo.includes(idAsText) || idAsText.includes(alvo);
  });
  if (idMatch) return idMatch;

  const alvoPalavras = alvo.split(' ').filter((w) => w.length > 2);
  return pops.find((pop) => {
    const labelPalavras = normalizeForMatch(pop.label).split(' ').filter((w) => w.length > 2);
    return labelPalavras.some((w) => alvoPalavras.includes(w));
  }) || null;
}

export async function fetchPops(produtoSlug) {
  const { data } = await api.get(`/processos/produtos/${encodeURIComponent(produtoSlug)}/pops`);
  return data;
}

export async function fetchPop(produtoSlug, popId) {
  const { data } = await api.get(
    `/processos/produtos/${encodeURIComponent(produtoSlug)}/pops/${encodeURIComponent(popId)}`,
  );
  return data;
}

export function popImageUrl(produtoSlug, popId, imageId) {
  return `/api/processos/produtos/${encodeURIComponent(produtoSlug)}/pops/${encodeURIComponent(popId)}/imagens/${encodeURIComponent(imageId)}`;
}

export function popCompletoVisualizarUrl(produtoSlug, popId) {
  return `/api/processos/produtos/${encodeURIComponent(produtoSlug)}/pops/${encodeURIComponent(popId)}/completo/visualizar`;
}

export async function loadPopCompletoPdfObjectUrl(produtoSlug, popId) {
  const token = localStorage.getItem('velodesk_token');
  const response = await fetch(popCompletoVisualizarUrl(produtoSlug, popId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    let detail = 'Não foi possível carregar o POP completo.';
    try {
      const data = await response.json();
      if (data?.message) detail = data.message;
    } catch {
      detail = `POP completo indisponível (HTTP ${response.status})`;
    }
    throw new Error(detail);
  }

  const blob = await response.blob();
  const pdfBlob = blob.type === 'application/pdf'
    ? blob
    : new Blob([await blob.arrayBuffer()], { type: 'application/pdf' });
  return URL.createObjectURL(pdfBlob);
}

/** Abre o PDF do POP completo em nova aba. */
export async function openPopCompletoInNewTab(produtoSlug, popId) {
  const objectUrl = await loadPopCompletoPdfObjectUrl(produtoSlug, popId);
  const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    URL.revokeObjectURL(objectUrl);
    throw new Error('Permita pop-ups neste site para visualizar o POP completo.');
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 300_000);
}
/** Carrega uma imagem autenticada (Bearer) e devolve um object URL — chame revokeObjectURL ao trocar/desmontar. */
export async function loadPopImageObjectUrl(produtoSlug, popId, imageId) {
  const token = localStorage.getItem('velodesk_token');
  const response = await fetch(popImageUrl(produtoSlug, popId, imageId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Imagem indisponível (HTTP ${response.status})`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
