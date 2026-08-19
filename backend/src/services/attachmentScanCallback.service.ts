/**
 * attachmentScanCallback.service v1.1.0 — updateOne atômico evita race com hooks inbound
 * VERSION: v1.1.0 | DATE: 2026-08-18
 */
import { Types } from 'mongoose';
import { ChamadoN1 } from '../models/ChamadoN1';
import { parseInboundAttachmentStorageKeyFromApiUrl } from './inboundAttachmentStorage.service';
import { readWhatsAppMensagens, WHATSAPP_MENSAGENS_KEY } from './twilio/whatsappThread.service';

export type ScanCallbackStatus = 'clean' | 'infected' | 'unscannable';

function matchesStorageKey(url: unknown, storageKey: string): boolean {
  const raw = String(url || '').trim();
  if (!raw) return false;
  if (raw.includes(storageKey)) return true;
  const parsed = parseInboundAttachmentStorageKeyFromApiUrl(raw);
  return parsed === storageKey;
}

function attachmentMatchesStorageKey(item: unknown, storageKey: string): boolean {
  const record = item && typeof item === 'object' ? item as Record<string, unknown> : null;
  if (!record) return false;
  const key = String(record.storageKey || '').trim();
  return key === storageKey || matchesStorageKey(record.url, storageKey);
}

export async function applyAttachmentScanResult(input: {
  storageKey: string;
  status: ScanCallbackStatus;
  reason?: string;
}): Promise<{ updated: boolean; chamadoProtocolo?: string }> {
  const storageKey = String(input.storageKey || '').trim();
  const status = input.status;
  if (!storageKey) return { updated: false };
  if (status !== 'clean' && status !== 'infected' && status !== 'unscannable') {
    return { updated: false };
  }

  const chamado = await ChamadoN1.findOne({
    $or: [
      { 'registro.metadados.emailAttachments.storageKey': storageKey },
      { 'registro.metadados.whatsappMensagens.anexos': new RegExp(storageKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) },
    ],
  }).lean();
  if (!chamado?.registro?.length || !chamado._id) return { updated: false };

  const scannedAt = new Date().toISOString();
  const setFields: Record<string, unknown> = {};

  chamado.registro.forEach((reg, regIdx) => {
    const meta = (reg.metadados && typeof reg.metadados === 'object' && !Array.isArray(reg.metadados))
      ? reg.metadados as Record<string, unknown>
      : {};

    const emailAttachments = Array.isArray(meta.emailAttachments) ? meta.emailAttachments : [];
    emailAttachments.forEach((raw, attIdx) => {
      if (!attachmentMatchesStorageKey(raw, storageKey)) return;
      const base = `registro.${regIdx}.metadados.emailAttachments.${attIdx}`;
      setFields[`${base}.scanStatus`] = status;
      setFields[`${base}.scannedAt`] = scannedAt;
      if (input.reason) setFields[`${base}.scanReason`] = input.reason;
    });

    const waMsgs = readWhatsAppMensagens(reg);
    waMsgs.forEach((msg, msgIdx) => {
      msg.anexos.forEach((url, attIdx) => {
        if (!matchesStorageKey(url, storageKey)) return;
        setFields[`registro.${regIdx}.metadados.${WHATSAPP_MENSAGENS_KEY}.${msgIdx}.anexosScanStatus.${attIdx}`] = status;
      });
    });
  });

  if (!Object.keys(setFields).length) return { updated: false };

  await ChamadoN1.updateOne({ _id: chamado._id as Types.ObjectId }, { $set: setFields });
  return {
    updated: true,
    chamadoProtocolo: chamado.chamadoProtocolo,
  };
}
