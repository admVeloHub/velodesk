/**
 * agentSuggestionCache.util v1.1.0 — fingerprint SEMPRE derivado direto do chamado (registro[])
 * via buildTicketIaMessagesFromChamado/buildTicketIaInternalNotesFromChamado — nunca do texto
 * que um chamador (frontend, script) formatou por conta própria. Antes disso, a checagem usava
 * o `internalNote` já "enriquecido" (mesclado com o texto que o frontend monta em outro
 * formato), e como os dois textos não batiam byte-a-byte, a fusão sempre produzia um conteúdo
 * diferente do que foi usado na escrita — o cache nunca era reaproveitado. Fingerprint calculado
 * só a partir do dado gravado no ticket elimina essa divergência de formatação entre chamadores.
 * VERSION: v1.1.0 | DATE: 2026-09-02
 */
import crypto from 'crypto';
import { ChamadoN1 } from '../../models/ChamadoN1';
import type { IAiSuggestionCache, IChamadoN1 } from '../../models/ChamadoN1';
import type { TicketAiContextSource, TicketAiTabulationResult } from './agentTypes';
import { isPersistedMongoTicketId } from '../../utils/persistedTicketId';
import { buildTicketIaInternalNotesFromChamado, buildTicketIaMessagesFromChamado } from '../ticketIaAdapter.service';

/** Assinatura determinística do estado atual do chamado — muda só se registro[] mudar de fato. */
export function computeCanonicalFingerprint(
  chamado: IChamadoN1,
  contextSource?: TicketAiContextSource,
): string {
  const messages = buildTicketIaMessagesFromChamado(chamado).map((m) => `${m.role}:${m.text}`);
  const internalNote = buildTicketIaInternalNotesFromChamado(chamado).trim();
  const payload = { contextSource: contextSource || '', messages, internalNote };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export interface CacheableSuggestionResult {
  respostaSugerida?: string;
  tabulacao?: TicketAiTabulationResult;
  tabulacaoDisplay?: string;
  tabulacaoFonte?: string;
  auditScore?: number;
  auditAprovado?: boolean;
  auditDecisao?: string;
  confidence?: string;
  model?: string;
}

export async function writeAiSuggestionCache(
  ticketId: string,
  fingerprint: string,
  result: CacheableSuggestionResult,
): Promise<void> {
  if (!isPersistedMongoTicketId(ticketId)) return;
  if (!result.respostaSugerida || !result.tabulacao) return;

  const doc: IAiSuggestionCache = {
    fingerprint,
    respostaSugerida: result.respostaSugerida,
    tabulacao: result.tabulacao,
    tabulacaoDisplay: result.tabulacaoDisplay || '',
    tabulacaoFonte: result.tabulacaoFonte,
    auditScore: result.auditScore,
    auditAprovado: result.auditAprovado,
    auditDecisao: result.auditDecisao,
    confidence: result.confidence,
    model: result.model,
    generatedAt: new Date(),
  };

  await ChamadoN1.updateOne({ _id: ticketId }, { $set: { aiSuggestionCache: doc } });
}

export async function readAiSuggestionCache(ticketId: string): Promise<IAiSuggestionCache | null> {
  if (!isPersistedMongoTicketId(ticketId)) return null;
  const chamado = await ChamadoN1.findById(ticketId, { aiSuggestionCache: 1 }).lean();
  return chamado?.aiSuggestionCache || null;
}

/** Chamado no momento em que a resposta é de fato enviada ao cliente — a sugestão pré-gerada não serve mais. */
export async function clearAiSuggestionCache(ticketId: string): Promise<void> {
  if (!isPersistedMongoTicketId(ticketId)) return;
  await ChamadoN1.updateOne({ _id: ticketId }, { $unset: { aiSuggestionCache: 1 } });
}
