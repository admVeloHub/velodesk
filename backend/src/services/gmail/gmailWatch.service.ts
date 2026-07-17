/** gmailWatch.service v1.1.0 — users.watch + renovação + health preciso */
import { env } from '../../config/env';
import { isDeskConfigConnected } from '../../config/database';
import { getGmailWatchStateModel, findGmailWatchSingleton } from '../../models/GmailWatchState';
import { createGmailClient, getGmailTopicName, GMAIL_SCOPE_READONLY } from './gmailAuth';
import { getDelegatedUserEmail, isEmailTransportReady } from '../emailTransport.service';

const RENEWAL_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;

let renewalTimer: ReturnType<typeof setInterval> | null = null;

export interface GmailWatchHealth {
  enabled: boolean;
  emailTransportReady: boolean;
  ready: boolean;
  mailbox: string | null;
  historyId: string | null;
  expiration: number | null;
  expiresInMs: number | null;
  lastWatchAt: string | null;
}

async function persistWatchState(mailbox: string, historyId: string, expiration: number) {
  const Model = getGmailWatchStateModel();
  await Model.findOneAndUpdate(
    { configKey: env.gmailWatchStateDocumentId },
    {
      $set: {
        configKey: env.gmailWatchStateDocumentId,
        mailbox,
        historyId: String(historyId),
        expiration,
        lastWatchAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
}

export async function setupGmailWatch(): Promise<{ historyId: string; expiration: number } | null> {
  if (!env.gmailInboundEnabled || !isEmailTransportReady()) {
    return null;
  }

  const mailbox = getDelegatedUserEmail();
  if (!mailbox.includes('@')) {
    console.warn('[gmailWatch] delegatedUserEmail inválido');
    return null;
  }

  try {
    const gmail = await createGmailClient([GMAIL_SCOPE_READONLY]);
    const topicName = getGmailTopicName();

    const res = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'],
        labelFilterBehavior: 'include',
      },
    });

    const historyId = String(res.data.historyId ?? '');
    const expiration = Number(res.data.expiration ?? 0);
    if (!historyId) throw new Error('historyId ausente na resposta watch');

    await persistWatchState(mailbox, historyId, expiration);
    console.log(`[gmailWatch] watch ativo — mailbox=${mailbox} historyId=${historyId} exp=${expiration}`);
    return { historyId, expiration };
  } catch (err) {
    console.error('[gmailWatch] setup falhou:', (err as Error).message);
    return null;
  }
}

export async function ensureGmailWatchFresh(): Promise<void> {
  try {
    if (!env.gmailInboundEnabled || !isDeskConfigConnected()) return;

    const state = await findGmailWatchSingleton();
    const now = Date.now();
    const needsRenew = !state?.expiration || state.expiration - now < RENEW_BEFORE_MS;

    if (needsRenew) {
      await setupGmailWatch();
    }
  } catch (err) {
    console.error('[gmailWatch] ensureGmailWatchFresh:', (err as Error).message);
  }
}

export function startGmailWatchRenewalLoop(): void {
  if (!env.gmailInboundEnabled || renewalTimer) return;

  renewalTimer = setInterval(() => {
    void ensureGmailWatchFresh();
  }, RENEWAL_INTERVAL_MS);

  console.log('[gmailWatch] renovação automática a cada 24h');
}

export async function getGmailWatchHealth(): Promise<GmailWatchHealth> {
  let state: Awaited<ReturnType<typeof findGmailWatchSingleton>> = null;

  try {
    if (isDeskConfigConnected()) {
      state = await findGmailWatchSingleton();
    }
  } catch (err) {
    console.warn('[gmailWatch] health — desk_config:', (err as Error).message);
  }

  const expiration = state?.expiration ?? null;
  const transportReady = isEmailTransportReady();
  const watchActive = !!(state?.historyId && state?.expiration);

  return {
    enabled: env.gmailInboundEnabled,
    emailTransportReady: transportReady,
    ready: transportReady && watchActive,
    mailbox: (state?.mailbox ?? getDelegatedUserEmail()) || null,
    historyId: state?.historyId ?? null,
    expiration,
    expiresInMs: expiration ? expiration - Date.now() : null,
    lastWatchAt: state?.lastWatchAt ? new Date(state.lastWatchAt).toISOString() : null,
  };
}

export async function getStoredHistoryId(): Promise<string | null> {
  const state = await findGmailWatchSingleton();
  return state?.historyId ? String(state.historyId) : null;
}

export async function updateStoredHistoryId(historyId: string): Promise<void> {
  const Model = getGmailWatchStateModel();
  await Model.findOneAndUpdate(
    { configKey: env.gmailWatchStateDocumentId },
    { $set: { historyId: String(historyId) } },
    { upsert: true }
  );
}
