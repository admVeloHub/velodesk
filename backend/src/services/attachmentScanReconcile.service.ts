/**
 * attachmentScanReconcile.service v1.0.0 — corrige pending quando o GCS já promoveu o anexo
 * VERSION: v1.0.0 | DATE: 2026-08-19
 */
import { inboundCleanObjectExists } from './gcsAttachmentStorage.service';
import { applyAttachmentScanResult } from './attachmentScanCallback.service';
import { ChamadoN1 } from '../models/ChamadoN1';

function readEmailAttachments(reg: { metadados?: unknown }): Array<Record<string, unknown>> {
  const meta = (reg.metadados && typeof reg.metadados === 'object' && !Array.isArray(reg.metadados))
    ? reg.metadados as Record<string, unknown>
    : {};
  const items = Array.isArray(meta.emailAttachments) ? meta.emailAttachments : [];
  return items.filter((raw): raw is Record<string, unknown> => Boolean(raw && typeof raw === 'object'));
}

/** Atualiza scanStatus no Mongo quando o arquivo já está no prefixo limpo do GCS. */
export async function reconcileChamadoAttachmentScanStatuses(chamadoId: string): Promise<boolean> {
  const chamado = await ChamadoN1.findById(chamadoId).lean();
  if (!chamado?.registro?.length) return false;

  const pendingKeys = new Set<string>();
  for (const reg of chamado.registro) {
    for (const item of readEmailAttachments(reg)) {
      const storageKey = String(item.storageKey || '').trim();
      const scanStatus = String(item.scanStatus || '').trim().toLowerCase();
      if (!storageKey || scanStatus !== 'pending') continue;
      pendingKeys.add(storageKey);
    }
  }
  if (!pendingKeys.size) return false;

  let updated = false;
  for (const storageKey of pendingKeys) {
    const inClean = await inboundCleanObjectExists(storageKey).catch(() => false);
    if (!inClean) continue;
    const result = await applyAttachmentScanResult({ storageKey, status: 'clean' });
    if (result.updated) updated = true;
  }
  return updated;
}
