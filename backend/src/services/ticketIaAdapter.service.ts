/**
 * ticketIaAdapter.service v1.0.0 — adapta ChamadoN1 para a visão textual da IA
 * VERSION: v1.0.0 | DATE: 2026-07-28
 *
 * A IA deve receber prioritariamente a fala direta do cliente. Em tickets criados
 * manualmente, onde não há mensagem originada pelo cliente, o detalhe informado pelo
 * atendente é usado apenas como fallback e identificado como texto transcrito.
 */
import type { IChamadoN1, IRegistro } from '../models/ChamadoN1';
import { decodeBasicHtmlEntities } from './emailHtml.util';
import { extractEmailReplyContent } from './emailReplyContent.util';
import { resolveRegistroOrigin } from './chamado.mapper';

export type TicketIaSourceQuality = 'direto_cliente' | 'resumo_atendente';

export interface TicketIaPayload {
  chamadoId: string;
  protocolo: string;
  canal: string;
  abertoEm: string;
  titulo: string;
  descricaoCliente: string;
  qualidadeFonte: TicketIaSourceQuality;
  formalCaseSource: string | null;
}

const FORMAL_CASE_SOURCES = new Set([
  'reclame-aqui',
  'bacen',
  'procon',
  'consumidor-gov',
  'consumidor.gov',
]);

function registroMetadata(reg: IRegistro): Record<string, unknown> {
  return reg.metadados && typeof reg.metadados === 'object' && !Array.isArray(reg.metadados)
    ? reg.metadados
    : {};
}

function normalizeText(raw: string): string {
  return decodeBasicHtmlEntities(String(raw ?? ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function textFromRegistro(reg: IRegistro): string {
  const metadata = registroMetadata(reg);
  const source = String(metadata.source ?? '').trim().toLowerCase();
  const raw = source === 'email-inbound'
    ? extractEmailReplyContent(reg.mensagemPublica)
    : reg.mensagemPublica;
  return normalizeText(raw);
}

export function resolveFormalCaseSource(chamado: IChamadoN1): string | null {
  for (const reg of chamado.registro ?? []) {
    const source = String(registroMetadata(reg).source ?? '').trim().toLowerCase();
    if (FORMAL_CASE_SOURCES.has(source)) return source;
  }
  return null;
}

function resolveChannel(chamado: IChamadoN1, formalSource: string | null): string {
  if (formalSource) return formalSource;
  for (const reg of chamado.registro ?? []) {
    const source = String(registroMetadata(reg).source ?? '').trim().toLowerCase();
    if (source) return source;
  }
  return 'velodesk';
}

function uniqueChronologicalCustomerMessages(chamado: IChamadoN1): string[] {
  const seen = new Set<string>();
  return [...(chamado.registro ?? [])]
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .filter((reg) => resolveRegistroOrigin(reg) === 'cliente')
    .map(textFromRegistro)
    .filter((text) => {
      const key = text.toLocaleLowerCase('pt-BR');
      if (!text || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function adaptChamadoToTicketIa(chamado: IChamadoN1): TicketIaPayload | null {
  const titulo = normalizeText(chamado.chamadoTitulo ?? '');
  const customerMessages = uniqueChronologicalCustomerMessages(chamado);
  const formalCaseSource = resolveFormalCaseSource(chamado);
  let descricaoCliente = customerMessages.join('\n\n');
  let qualidadeFonte: TicketIaSourceQuality = 'direto_cliente';

  if (!descricaoCliente) {
    const tab = chamado.tabulacao?.[chamado.tabulacao.length - 1];
    descricaoCliente = normalizeText(tab?.detalhe ?? '');
    qualidadeFonte = 'resumo_atendente';
  }

  if (!titulo && !descricaoCliente) return null;

  return {
    chamadoId: String(chamado._id),
    protocolo: String(chamado.chamadoProtocolo ?? '').trim(),
    canal: resolveChannel(chamado, formalCaseSource),
    abertoEm: new Date(chamado.createdAt ?? Date.now()).toISOString(),
    titulo,
    descricaoCliente,
    qualidadeFonte,
    formalCaseSource,
  };
}

export function buildTicketIaText(payload: TicketIaPayload, maxChars = 4000): string {
  const sourceLabel = payload.qualidadeFonte === 'direto_cliente'
    ? 'Fala direta do cliente'
    : 'Resumo transcrito pelo atendente (não é citação literal)';
  const text = [
    payload.titulo ? `Título: ${payload.titulo}` : '',
    payload.descricaoCliente ? `${sourceLabel}:\n${payload.descricaoCliente}` : '',
  ].filter(Boolean).join('\n\n');
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}
