/**
 * attachmentScanCallback.service v1.0.0 — atualiza scanStatus opcional no chamado
 * VERSION: v1.0.0 | DATE: 2026-08-13
 */
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
  });
  if (!chamado?.registro?.length) return { updated: false };

  let updated = false;
  const scannedAt = new Date().toISOString();

  chamado.registro.forEach((reg, index) => {
    const meta = (reg.metadados && typeof reg.metadados === 'object' && !Array.isArray(reg.metadados))
      ? { ...(reg.metadados as Record<string, unknown>) }
      : {};

    const emailAttachments = Array.isArray(meta.emailAttachments) ? meta.emailAttachments : [];
    let emailChanged = false;
    const nextEmail = emailAttachments.map((raw) => {
      const item = raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : null;
      if (!item) return raw;
      const key = String(item.storageKey || '').trim();
      if (key !== storageKey && !matchesStorageKey(item.url, storageKey)) return raw;
      emailChanged = true;
      return { ...item, scanStatus: status, scanReason: input.reason, scannedAt };
    });
    if (emailChanged) {
      meta.emailAttachments = nextEmail;
      updated = true;
    }

    const waMsgs = readWhatsAppMensagens(reg);
    let waChanged = false;
    const nextWa = waMsgs.map((msg) => {
      const statuses = Array.isArray(msg.anexosScanStatus) ? [...msg.anexosScanStatus] : msg.anexos.map(() => '');
      let hit = false;
      msg.anexos.forEach((url, idx) => {
        if (!matchesStorageKey(url, storageKey)) return;
        statuses[idx] = status;
        hit = true;
      });
      if (!hit) return msg;
      waChanged = true;
      return { ...msg, anexosScanStatus: statuses };
    });
    if (waChanged) {
      meta[WHATSAPP_MENSAGENS_KEY] = nextWa;
      updated = true;
    }

    if (emailChanged || waChanged) {
      reg.metadados = meta;
      chamado.markModified(`registro.${index}.metadados`);
    }
  });

  if (!updated) return { updated: false };
  await chamado.save();
  return { updated: true, chamadoProtocolo: chamado.chamadoProtocolo };
}
