/** whatsappThread.service v1.0.1 — thread WhatsApp em um único registro (array aninhado) */
import type { IChamadoN1, IRegistro } from '../../models/ChamadoN1';

export const WHATSAPP_THREAD_SOURCE = 'whatsapp-thread';
export const WHATSAPP_MENSAGENS_KEY = 'whatsappMensagens';

export interface WhatsAppMensagemItem {
  id: string;
  data: string;
  origin: 'cliente' | 'agente';
  autor: string;
  texto: string;
  anexos: string[];
  twilioMessageSid?: string;
}

export interface AppendWhatsAppMensagemInput {
  origin: 'cliente' | 'agente';
  autor?: string;
  texto: string;
  anexos?: string[];
  twilioMessageSid?: string;
  waChatId?: string;
}

function currentStatus(chamado: IChamadoN1): string {
  const last = chamado.registro?.[chamado.registro.length - 1];
  return String(last?.status ?? 'novo').trim() || 'novo';
}

function registroMetadados(reg: IRegistro): Record<string, unknown> {
  return (reg.metadados ?? {}) as Record<string, unknown>;
}

function normalizeWaChatId(value: unknown): string {
  return String(value ?? '')
    .replace(/^whatsapp:/i, '')
    .replace(/\D/g, '')
    .trim();
}

export function resolveWaChatIdFromChamado(chamado: IChamadoN1, hint?: string): string {
  const fromHint = normalizeWaChatId(hint);
  if (fromHint) return fromHint;

  for (let i = (chamado.registro?.length ?? 0) - 1; i >= 0; i -= 1) {
    const meta = registroMetadados(chamado.registro![i]);
    if (String(meta.source ?? '') === WHATSAPP_THREAD_SOURCE) {
      const fromMeta = normalizeWaChatId(meta.waChatId);
      if (fromMeta) return fromMeta;
    }
  }

  for (let i = (chamado.registro?.length ?? 0) - 1; i >= 0; i -= 1) {
    const meta = registroMetadados(chamado.registro![i]);
    const from = normalizeWaChatId(meta.waFrom);
    if (from) return from;
  }

  return '';
}

export function findWhatsAppThreadRegistro(
  chamado: IChamadoN1,
  waChatId?: string,
): { registro: IRegistro; index: number } | null {
  const targetChatId = normalizeWaChatId(waChatId);
  const registros = chamado.registro ?? [];

  for (let index = registros.length - 1; index >= 0; index -= 1) {
    const reg = registros[index];
    const meta = registroMetadados(reg);
    if (String(meta.source ?? '') !== WHATSAPP_THREAD_SOURCE) continue;
    if (!targetChatId) return { registro: reg, index };
    if (normalizeWaChatId(meta.waChatId) === targetChatId) return { registro: reg, index };
  }

  return null;
}

function createWhatsAppThreadRegistro(chamado: IChamadoN1, waChatId: string): IRegistro {
  return {
    data: new Date(),
    origin: '',
    autor: '',
    mensagemPublica: '',
    anexosMensagemPublica: [],
    anotacaoInterna: '',
    anexosAnotacaoInterna: [],
    alteracoes: [],
    metadados: {
      source: WHATSAPP_THREAD_SOURCE,
      channel: 'whatsapp',
      waChatId: waChatId || undefined,
      [WHATSAPP_MENSAGENS_KEY]: [] as WhatsAppMensagemItem[],
    },
    status: currentStatus(chamado),
  };
}

export function getOrCreateWhatsAppThreadRegistro(
  chamado: IChamadoN1,
  waChatId?: string,
): { registro: IRegistro; index: number; created: boolean } {
  const chatId = resolveWaChatIdFromChamado(chamado, waChatId);
  const existing = findWhatsAppThreadRegistro(chamado, chatId || undefined);
  if (existing) return { ...existing, created: false };

  if (!chamado.registro) chamado.registro = [];
  const registro = createWhatsAppThreadRegistro(chamado, chatId);
  chamado.registro.push(registro);
  return {
    registro,
    index: chamado.registro.length - 1,
    created: true,
  };
}

export function readWhatsAppMensagens(reg: IRegistro): WhatsAppMensagemItem[] {
  const meta = registroMetadados(reg);
  const raw = meta[WHATSAPP_MENSAGENS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        id: String(row.id ?? '').trim(),
        data: String(row.data ?? '').trim(),
        origin: String(row.origin ?? '').trim() === 'cliente' ? 'cliente' : 'agente',
        autor: String(row.autor ?? '').trim(),
        texto: String(row.texto ?? row.text ?? '').trim(),
        anexos: Array.isArray(row.anexos)
          ? row.anexos.map((url) => String(url ?? '').trim()).filter(Boolean)
          : [],
        twilioMessageSid: String(row.twilioMessageSid ?? '').trim() || undefined,
      } satisfies WhatsAppMensagemItem;
    })
    .filter((item) => item.texto || item.anexos.length);
}

export function appendWhatsAppMensagemToChamado(
  chamado: IChamadoN1,
  input: AppendWhatsAppMensagemInput,
): { registroIndex: number; mensagem: WhatsAppMensagemItem; createdThread: boolean } {
  const texto = String(input.texto ?? '').trim();
  const anexos = (input.anexos ?? []).map((item) => String(item ?? '').trim()).filter(Boolean);
  if (!texto && !anexos.length) {
    throw new Error('Texto ou anexo é obrigatório');
  }

  const waChatId = resolveWaChatIdFromChamado(chamado, input.waChatId);
  const { registro, index, created } = getOrCreateWhatsAppThreadRegistro(chamado, waChatId);
  const meta = registroMetadados(registro);
  const list = readWhatsAppMensagens(registro);
  const now = new Date();

  const mensagem: WhatsAppMensagemItem = {
    id: `wa-${now.getTime()}-${list.length}`,
    data: now.toISOString(),
    origin: input.origin,
    autor: String(input.autor ?? '').trim(),
    texto,
    anexos,
    twilioMessageSid: input.twilioMessageSid,
  };

  list.push(mensagem);
  meta[WHATSAPP_MENSAGENS_KEY] = list;
  meta.source = WHATSAPP_THREAD_SOURCE;
  meta.channel = 'whatsapp';
  if (waChatId) meta.waChatId = waChatId;
  registro.metadados = meta;
  registro.data = now;

  return {
    registroIndex: index,
    mensagem,
    createdThread: created,
  };
}

export function resolveWhatsAppDestinationPhone(chamado: IChamadoN1): string | null {
  const chatId = resolveWaChatIdFromChamado(chamado);
  if (chatId) return chatId.startsWith('+') ? chatId : `+${chatId}`;

  for (let i = (chamado.registro?.length ?? 0) - 1; i >= 0; i -= 1) {
    const meta = registroMetadados(chamado.registro![i]);
    const waFrom = String(meta.waFrom ?? '').replace(/^whatsapp:/i, '').trim();
    if (waFrom) return waFrom.startsWith('+') ? waFrom : `+${waFrom.replace(/\D/g, '')}`;
  }

  return null;
}
