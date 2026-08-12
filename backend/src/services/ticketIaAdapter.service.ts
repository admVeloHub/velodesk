/**
 * ticketIaAdapter.service v1.1.1 — notas internas do registro para contexto IA
 * VERSION: v1.1.1 | DATE: 2026-08-12
 *
 * A IA deve receber prioritariamente a fala direta do cliente. Em tickets criados
 * manualmente, onde não há mensagem originada pelo cliente, o detalhe informado pelo
 * atendente é usado apenas como fallback e identificado como texto transcrito.
 */
import type { IChamadoN1, IRegistro } from '../models/ChamadoN1';
import { decodeBasicHtmlEntities } from './emailHtml.util';
import { extractEmailReplyContent } from './emailReplyContent.util';
import { resolveRegistroOrigin } from './chamado.mapper';
import {
  readWhatsAppMensagens,
  WHATSAPP_THREAD_SOURCE,
} from './twilio/whatsappThread.service';

export type TicketIaSourceQuality = 'direto_cliente' | 'resumo_atendente';

export type TicketIaConversationRole = 'cliente' | 'agente';

export interface TicketIaConversationMessage {
  role: TicketIaConversationRole;
  text: string;
  timestamp: Date;
  channel?: string;
}

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
  for (const reg of sortedRegistros(chamado).reverse()) {
    const metadata = registroMetadata(reg);
    const source = String(metadata.source ?? '').trim().toLowerCase();
    if (source === WHATSAPP_THREAD_SOURCE || metadata.channel === 'whatsapp') return 'whatsapp';
    if (source) return source;
  }
  return 'velodesk';
}

function messageTextOrAttachmentFallback(text: string, hasAttachments: boolean): string {
  const normalized = normalizeText(text);
  if (normalized) return normalized;
  return hasAttachments ? '[Anexo recebido]' : '';
}

function sortedRegistros(chamado: IChamadoN1): IRegistro[] {
  return [...(chamado.registro ?? [])]
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
}

/** Histórico público cronológico — e-mail, portal e thread WhatsApp (whatsappMensagens). */
export function buildTicketIaMessagesFromChamado(chamado: IChamadoN1): TicketIaConversationMessage[] {
  const items: TicketIaConversationMessage[] = [];

  for (const reg of sortedRegistros(chamado)) {
    const metadata = registroMetadata(reg);
    const source = String(metadata.source ?? '').trim().toLowerCase();

    if (source === WHATSAPP_THREAD_SOURCE) {
      for (const wa of readWhatsAppMensagens(reg)) {
        const text = messageTextOrAttachmentFallback(wa.texto, wa.anexos.length > 0);
        if (!text) continue;
        items.push({
          role: wa.origin === 'cliente' ? 'cliente' : 'agente',
          text,
          timestamp: new Date(wa.data || reg.data),
          channel: 'whatsapp',
        });
      }
      continue;
    }

    const text = textFromRegistro(reg);
    const hasAttachments = (reg.anexosMensagemPublica?.length ?? 0) > 0;
    const resolvedText = messageTextOrAttachmentFallback(text, hasAttachments);
    if (!resolvedText) continue;

    items.push({
      role: resolveRegistroOrigin(reg) === 'cliente' ? 'cliente' : 'agente',
      text: resolvedText,
      timestamp: new Date(reg.data),
      channel: source || undefined,
    });
  }

  return items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/** Bloco de anotações internas persistidas no chamado (ordem cronológica). */
export function buildTicketIaInternalNotesFromChamado(chamado: IChamadoN1): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const reg of sortedRegistros(chamado)) {
    const note = decodeBasicHtmlEntities(String(reg.anotacaoInterna ?? '').trim());
    if (!note) continue;
    const key = note.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) continue;
    seen.add(key);
    const when = reg.data ? new Date(reg.data).toISOString() : '';
    lines.push(when ? `[${when}] ${note}` : note);
  }
  return lines.join('\n\n').trim();
}

function uniqueChronologicalCustomerMessages(chamado: IChamadoN1): string[] {
  const seen = new Set<string>();
  return buildTicketIaMessagesFromChamado(chamado)
    .filter((item) => item.role === 'cliente')
    .map((item) => item.text)
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
