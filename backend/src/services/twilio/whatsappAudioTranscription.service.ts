/** whatsappAudioTranscription.service v1.1.0 — transcrição iniciada somente por solicitação */
import OpenAI, { toFile } from 'openai';
import { Types } from 'mongoose';
import { env } from '../../config/env';
import { ChamadoN1 } from '../../models/ChamadoN1';
import { ChamadoIaAnalise } from '../../models/ChamadoIaAnalise';
import {
  parseInboundAttachmentStorageKeyFromApiUrl,
  readInboundAttachmentBuffer,
} from '../inboundAttachmentStorage.service';

const WORKER_INTERVAL_MS = 30_000;
const MAX_PER_CYCLE = 5;
const active = new Set<string>();
let workerStarted = false;
let client: OpenAI | null = null;

interface RawWhatsAppMessage {
  twilioMessageSid?: string;
  texto?: string;
  anexos?: string[];
  mediaContentTypes?: string[];
  transcriptionStatus?: string;
}

function getOpenAiClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env.openaiApiKey });
  return client;
}

function isAudioType(value: string): boolean {
  return String(value || '').toLowerCase().startsWith('audio/');
}

function findRawWhatsAppMessage(
  doc: Record<string, unknown>,
  messageSid: string,
): RawWhatsAppMessage | null {
  const registros = Array.isArray(doc.registro) ? doc.registro as Array<Record<string, unknown>> : [];
  for (const reg of registros) {
    const meta = (reg.metadados ?? {}) as Record<string, unknown>;
    const messages = Array.isArray(meta.whatsappMensagens)
      ? meta.whatsappMensagens as RawWhatsAppMessage[]
      : [];
    const found = messages.find((item) => String(item.twilioMessageSid || '') === messageSid);
    if (found) return found;
  }
  return null;
}

function buildTranscribedText(current: string, transcription: string): string {
  const normalized = String(current || '').trim();
  const prefix = /^\[Áudio recebido/i.test(normalized) ? '' : normalized;
  return [prefix, `Transcrição do áudio:\n${transcription.trim()}`].filter(Boolean).join('\n\n');
}

async function updateMessageFields(
  chamadoId: string,
  messageSid: string,
  fields: Record<string, unknown>,
  expectedStatus?: string,
): Promise<boolean> {
  const msgFilter: Record<string, unknown> = { 'msg.twilioMessageSid': messageSid };
  if (expectedStatus) msgFilter['msg.transcriptionStatus'] = expectedStatus;
  const result = await ChamadoN1.collection.updateOne(
    {
      _id: new Types.ObjectId(chamadoId),
      'registro.metadados.whatsappMensagens': {
        $elemMatch: {
          twilioMessageSid: messageSid,
          ...(expectedStatus ? { transcriptionStatus: expectedStatus } : {}),
        },
      },
    },
    {
      $set: Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
          `registro.$[reg].metadados.whatsappMensagens.$[msg].${key}`,
          value,
        ]),
      ),
    },
    {
      arrayFilters: [
        {
          'reg.metadados.whatsappMensagens': {
            $elemMatch: {
              twilioMessageSid: messageSid,
              ...(expectedStatus ? { transcriptionStatus: expectedStatus } : {}),
            },
          },
        },
        msgFilter,
      ],
    },
  );
  return result.modifiedCount > 0;
}

async function transcribeClaimedMessage(chamadoId: string, messageSid: string): Promise<void> {
  const doc = await ChamadoN1.findById(chamadoId).lean();
  if (!doc) throw new Error('Ticket não encontrado para transcrição');
  const message = findRawWhatsAppMessage(doc as unknown as Record<string, unknown>, messageSid);
  if (!message) throw new Error('Mensagem WhatsApp não encontrada para transcrição');

  const attachments = Array.isArray(message.anexos) ? message.anexos : [];
  const contentTypes = Array.isArray(message.mediaContentTypes) ? message.mediaContentTypes : [];
  const audioIndex = contentTypes.findIndex(isAudioType);
  const attachmentUrl = attachments[audioIndex >= 0 ? audioIndex : 0];
  if (!attachmentUrl) throw new Error('Anexo de áudio ausente');

  const storageKey = parseInboundAttachmentStorageKeyFromApiUrl(attachmentUrl);
  if (!storageKey) throw new Error('URL interna do áudio inválida');
  const loaded = await readInboundAttachmentBuffer(storageKey);
  if (!loaded?.buffer.length) throw new Error('Arquivo de áudio indisponível');

  let filename = loaded.filename || `whatsapp-${messageSid}.ogg`;
  if (!/\.(ogg|opus|mp3|mp4|mpeg|mpga|m4a|wav|webm)$/i.test(filename)) {
    filename += '.ogg';
  }
  const contentType = contentTypes[audioIndex >= 0 ? audioIndex : 0]
    || loaded.contentType
    || 'audio/ogg';
  const result = await getOpenAiClient().audio.transcriptions.create({
    file: await toFile(loaded.buffer, filename, { type: contentType }),
    model: env.whatsappAudioTranscriptionModel,
    language: 'pt',
  });
  const transcription = String(result.text || '').trim();
  if (!transcription) throw new Error('Transcrição retornou vazia');

  await updateMessageFields(chamadoId, messageSid, {
    texto: buildTranscribedText(String(message.texto || ''), transcription),
    transcriptionStatus: 'completed',
    transcriptionText: transcription,
    transcriptionError: '',
  }, 'processing');
  await ChamadoIaAnalise.updateOne(
    { chamadoId: new Types.ObjectId(chamadoId), origem: { $ne: 'manual' } },
    { $set: { needsReanalysis: true } },
  );
  console.info('[whatsapp-audio] transcrição concluída', { chamadoId, messageSid });
}

export async function processWhatsAppAudioTranscription(
  chamadoId: string,
  messageSid: string,
): Promise<void> {
  if (!env.whatsappAudioTranscriptionEnabled || !env.openaiApiKey) return;
  const key = `${chamadoId}:${messageSid}`;
  if (active.has(key)) return;
  active.add(key);
  try {
    const claimed = await updateMessageFields(
      chamadoId,
      messageSid,
      { transcriptionStatus: 'processing', transcriptionError: '' },
      'pending',
    );
    if (!claimed) return;
    await transcribeClaimedMessage(chamadoId, messageSid);
  } catch (err) {
    const message = (err as Error).message || String(err);
    console.error('[whatsapp-audio] transcrição falhou', { chamadoId, messageSid, error: message });
    await updateMessageFields(chamadoId, messageSid, {
      texto: '[Áudio recebido — transcrição indisponível]',
      transcriptionStatus: 'failed',
      transcriptionError: message.slice(0, 500),
    }, 'processing').catch(() => undefined);
  } finally {
    active.delete(key);
  }
}

export function queueWhatsAppAudioTranscription(chamadoId: string, messageSid: string): void {
  setImmediate(() => {
    void processWhatsAppAudioTranscription(chamadoId, messageSid);
  });
}

export async function requestWhatsAppAudioTranscription(
  chamadoId: string,
  messageSid: string,
): Promise<'pending' | 'processing' | 'completed'> {
  if (!env.whatsappAudioTranscriptionEnabled) {
    throw new Error('Transcrição de áudio está desabilitada');
  }
  if (!env.openaiApiKey) {
    throw new Error('OPENAI_API_KEY não configurada para transcrição');
  }

  let requested = await updateMessageFields(
    chamadoId,
    messageSid,
    { transcriptionStatus: 'pending', transcriptionError: '' },
    'available',
  );
  if (!requested) {
    requested = await updateMessageFields(
      chamadoId,
      messageSid,
      { transcriptionStatus: 'pending', transcriptionError: '' },
      'failed',
    );
  }
  if (requested) {
    queueWhatsAppAudioTranscription(chamadoId, messageSid);
    return 'pending';
  }

  const doc = await ChamadoN1.findById(chamadoId).lean();
  if (!doc) throw new Error('Ticket não encontrado');
  const message = findRawWhatsAppMessage(doc as unknown as Record<string, unknown>, messageSid);
  if (!message) throw new Error('Mensagem de áudio não encontrada');
  if (message.transcriptionStatus === 'pending' || message.transcriptionStatus === 'processing') {
    return message.transcriptionStatus;
  }
  if (message.transcriptionStatus === 'completed') return 'completed';
  throw new Error('A mensagem selecionada não possui áudio disponível para transcrição');
}

async function scanPendingTranscriptions(): Promise<void> {
  if (!env.whatsappAudioTranscriptionEnabled || !env.openaiApiKey) return;
  const docs = await ChamadoN1.find({
    'registro.metadados.whatsappMensagens.transcriptionStatus': 'pending',
  })
    .select('_id registro')
    .limit(MAX_PER_CYCLE)
    .lean();

  for (const doc of docs) {
    const registros = Array.isArray(doc.registro) ? doc.registro : [];
    for (const reg of registros) {
      const meta = (reg.metadados ?? {}) as Record<string, unknown>;
      const messages = Array.isArray(meta.whatsappMensagens)
        ? meta.whatsappMensagens as RawWhatsAppMessage[]
        : [];
      const pending = messages.find(
        (item) => item.transcriptionStatus === 'pending' && item.twilioMessageSid,
      );
      if (pending?.twilioMessageSid) {
        queueWhatsAppAudioTranscription(String(doc._id), pending.twilioMessageSid);
        break;
      }
    }
  }
}

export function startWhatsAppAudioTranscriptionWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  if (!env.whatsappAudioTranscriptionEnabled || !env.openaiApiKey) {
    console.info('[whatsapp-audio] worker desabilitado');
    return;
  }
  const timer = setInterval(() => {
    void scanPendingTranscriptions().catch((err) => {
      console.error('[whatsapp-audio] varredura falhou:', (err as Error).message);
    });
  }, WORKER_INTERVAL_MS);
  timer.unref();
  setTimeout(() => {
    void scanPendingTranscriptions();
  }, 5_000).unref();
  console.info('[whatsapp-audio] worker de transcrição ativo');
}
