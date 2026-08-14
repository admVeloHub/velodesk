/**
 * processosCatalog v1.0.0 — catálogo de POPs (.docx) por produto, para o quadro de Processos
 * VERSION: v1.0.0 | DATE: 2026-08-14 | AUTHOR: VeloHub Development Team
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
