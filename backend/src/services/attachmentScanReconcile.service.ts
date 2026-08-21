/**
 * attachmentScanReconcile.service v1.1.0 — reconcilia pending via gate, quarentena e stale TTL
 * VERSION: v1.1.0 | DATE: 2026-08-21
 */
import { env } from '../config/env';
import { ChamadoN1, type IRegistro } from '../models/ChamadoN1';
import { applyAttachmentScanResult } from './attachmentScanCallback.service';
import {
  getInboundQuarantinePrefix,
  inboundCleanObjectExists,
  readQuarantineAttachmentMeta,
} from './gcsAttachmentStorage.service';
import {
  inspectInboundAttachmentGate,
  parseInboundAttachmentStorageKeyFromApiUrl,
} from './inboundAttachmentStorage.service';
import { parseSentAttachmentStorageKeyFromApiUrl, isSentAttachmentApiUrl } from './sentAttachmentStorage.service';
import { readWhatsAppMensagens } from './twilio/whatsappThread.service';

const STALE_PENDING_MS = Math.max(
  60_000,
  parseInt(process.env.ATTACHMENT_SCAN_STALE_MS || '300000', 10),
);

export type ReconcileStorageKeyResult = 'clean' | 'pending' | 'infected' | 'unchanged';

function readEmailAttachments(reg: { metadados?: unknown }): Array<Record<string, unknown>> {
  const meta = (reg.metadados && typeof reg.metadados === 'object' && !Array.isArray(reg.metadados))
    ? reg.metadados as Record<string, unknown>
    : {};
  const items = Array.isArray(meta.emailAttachments) ? meta.emailAttachments : [];
  return items.filter((raw): raw is Record<string, unknown> => Boolean(raw && typeof raw === 'object'));
}

function resolveAttachmentAgeMs(
  registroDate?: Date,
  quarantineUpdatedAt?: Date,
): number {
  const candidates = [registroDate, quarantineUpdatedAt]
    .map((value) => (value instanceof Date ? value.getTime() : NaN))
    .filter((value) => Number.isFinite(value));
  if (!candidates.length) return 0;
  return Date.now() - Math.min(...candidates);
}

function parseStorageKeyFromApiUrl(apiUrl: string): string | null {
  const raw = String(apiUrl || '').trim();
  if (!raw) return null;
  if (isSentAttachmentApiUrl(raw)) {
    return parseSentAttachmentStorageKeyFromApiUrl(raw);
  }
  return parseInboundAttachmentStorageKeyFromApiUrl(raw);
}

async function markStorageKeyClean(storageKey: string, reason: string): Promise<boolean> {
  const result = await applyAttachmentScanResult({ storageKey, status: 'clean' });
  if (result.updated) {
    console.info('[attachmentScan] reconcile → clean', {
      storageKey,
      reason,
      protocolo: result.chamadoProtocolo ?? null,
    });
  }
  return result.updated;
}

/**
 * Tenta destravar um anexo inbound com scanStatus pending no Mongo/GCS.
 * Retorna clean quando o arquivo já está liberado ou pending expirou (fail-open controlado).
 */
export async function reconcilePendingStorageKey(
  storageKey: string,
  context?: { registroDate?: Date },
): Promise<ReconcileStorageKeyResult> {
  const key = String(storageKey || '').trim();
  if (!key) return 'unchanged';

  const gate = await inspectInboundAttachmentGate(key);
  if (gate.state === 'ready') {
    await markStorageKeyClean(key, 'gate-ready');
    return 'clean';
  }
  if (gate.state === 'infected') return 'infected';

  if (await inboundCleanObjectExists(key).catch(() => false)) {
    await markStorageKeyClean(key, 'clean-prefix');
    return 'clean';
  }

  const qMeta = await readQuarantineAttachmentMeta(key);
  if (qMeta) {
    const qStatus = String(qMeta.scanStatus || 'pending').toLowerCase();
    if (qStatus === 'clean') {
      await markStorageKeyClean(key, 'quarantine-meta-clean');
      return 'clean';
    }
    if (qStatus === 'pending') {
      const ageMs = resolveAttachmentAgeMs(context?.registroDate, qMeta.updatedAt);
      if (ageMs >= STALE_PENDING_MS) {
        console.warn('[attachmentScan] stale pending auto-clean', {
          storageKey: key,
          ageMs,
          staleMs: STALE_PENDING_MS,
          bucket: env.gcpStorageBucket,
          prefix: getInboundQuarantinePrefix(),
        });
        await markStorageKeyClean(key, 'stale-pending');
        return 'clean';
      }
    }
  }

  return gate.state === 'pending' ? 'pending' : 'unchanged';
}

type PendingTarget = { storageKey: string; registroDate?: Date; sentOutbound?: boolean };

function collectPendingTargets(chamado: { registro?: Array<Record<string, unknown>> }): PendingTarget[] {
  const targets: PendingTarget[] = [];
  const seen = new Set<string>();

  const pushTarget = (target: PendingTarget) => {
    const key = String(target.storageKey || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    targets.push(target);
  };

  for (const reg of chamado.registro ?? []) {
    const registroDate = reg.data ? new Date(String(reg.data)) : undefined;

    for (const item of readEmailAttachments(reg)) {
      const storageKey = String(item.storageKey || '').trim();
      const scanStatus = String(item.scanStatus || '').trim().toLowerCase();
      if (!storageKey || scanStatus !== 'pending') continue;
      pushTarget({ storageKey, registroDate });
    }

    const waMsgs = readWhatsAppMensagens(reg as unknown as IRegistro);
    for (const msg of waMsgs) {
      const statuses = Array.isArray(msg.anexosScanStatus) ? msg.anexosScanStatus : [];
      const msgDate = msg.data ? new Date(String(msg.data)) : registroDate;
      (msg.anexos || []).forEach((url, index) => {
        const scanStatus = String(statuses[index] || '').trim().toLowerCase();
        if (scanStatus !== 'pending') return;
        const apiUrl = String(url || '').trim();
        if (isSentAttachmentApiUrl(apiUrl)) {
          const sentKey = parseSentAttachmentStorageKeyFromApiUrl(apiUrl);
          if (sentKey) pushTarget({ storageKey: sentKey, registroDate: msgDate, sentOutbound: true });
          return;
        }
        const storageKey = parseStorageKeyFromApiUrl(apiUrl);
        if (storageKey) pushTarget({ storageKey, registroDate: msgDate });
      });
    }
  }

  return targets;
}

/** Atualiza scanStatus no Mongo quando o arquivo já está liberado ou pending expirou. */
export async function reconcileChamadoAttachmentScanStatuses(chamadoId: string): Promise<boolean> {
  const chamado = await ChamadoN1.findById(chamadoId).lean();
  if (!chamado?.registro?.length) return false;

  const targets = collectPendingTargets(chamado as { registro?: Array<Record<string, unknown>> });
  if (!targets.length) return false;

  let updated = false;
  for (const target of targets) {
    if (target.sentOutbound) {
      const result = await applyAttachmentScanResult({ storageKey: target.storageKey, status: 'clean' });
      if (result.updated) updated = true;
      continue;
    }
    const reconciled = await reconcilePendingStorageKey(target.storageKey, {
      registroDate: target.registroDate,
    });
    if (reconciled === 'clean') updated = true;
  }

  return updated;
}
