/** gmailInbound.service v1.1.0 — Pub/Sub push em lotes (evita timeout 60s Cloud Run) */
import { env } from '../../config/env';
import { processInboundEmail } from '../email-inbound.service';
import type { InboundEmailProcessResult } from '../inbound-email/types';
import { createGmailClient, GMAIL_SCOPE_READONLY } from './gmailAuth';
import { gmailMessageToInboundPayload, shouldSkipGmailMessage } from './gmailMessageParser';
import {
  getStoredHistoryId,
  updateStoredHistoryId,
} from './gmailWatch.service';
import { getDelegatedUserEmail } from '../emailTransport.service';

export interface GmailPubSubPushBody {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
}

export interface GmailPushNotification {
  emailAddress?: string;
  historyId?: string;
}

export interface GmailHistoryProcessResult {
  results: InboundEmailProcessResult[];
  hasMore: boolean;
  latestHistoryId: string;
}

export function decodePubSubMessage(body: GmailPubSubPushBody): GmailPushNotification | null {
  const dataB64 = body.message?.data;
  if (!dataB64) return null;
  try {
    const json = Buffer.from(dataB64, 'base64').toString('utf8');
    return JSON.parse(json) as GmailPushNotification;
  } catch {
    return null;
  }
}

function budgetExceeded(startedAt: number, processedCount: number): boolean {
  if (processedCount >= env.gmailInboundMaxMessagesPerPush) return true;
  return Date.now() - startedAt >= env.gmailInboundBudgetMs;
}

export async function processGmailHistory(
  startHistoryId: string,
): Promise<GmailHistoryProcessResult> {
  const gmail = await createGmailClient([GMAIL_SCOPE_READONLY]);
  const delegated = getDelegatedUserEmail();
  const results: InboundEmailProcessResult[] = [];
  let pageToken: string | undefined;
  let latestHistoryId = startHistoryId;
  let processedCount = 0;
  let hasMore = false;
  const startedAt = Date.now();

  try {
    do {
      const historyRes = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        pageToken,
      });

      if (historyRes.data.historyId) {
        latestHistoryId = String(historyRes.data.historyId);
      }

      for (const record of historyRes.data.history ?? []) {
        for (const added of record.messagesAdded ?? []) {
          if (budgetExceeded(startedAt, processedCount)) {
            hasMore = true;
            break;
          }

          const msgRef = added.message;
          if (!msgRef?.id) continue;

          const full = await gmail.users.messages.get({
            userId: 'me',
            id: msgRef.id,
            format: 'full',
          });

          if (shouldSkipGmailMessage(full.data, delegated)) continue;

          const payload = gmailMessageToInboundPayload(full.data);
          if (!payload) continue;

          try {
            const result = await processInboundEmail(payload);
            results.push(result);
            processedCount += 1;
          } catch (err) {
            console.error('[gmailInbound] processInboundEmail falhou:', (err as Error).message);
          }
        }
        if (hasMore) break;
      }

      if (hasMore) break;
      pageToken = historyRes.data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (err) {
    const message = (err as Error).message || String(err);
    if (/historyId|404|not found/i.test(message)) {
      console.warn('[gmailInbound] historyId inválido/expirado — será realinhado na próxima notificação:', message);
      return { results, hasMore: false, latestHistoryId: startHistoryId };
    }
    throw err;
  }

  if (!hasMore && latestHistoryId && latestHistoryId !== startHistoryId) {
    await updateStoredHistoryId(latestHistoryId);
  }

  return { results, hasMore, latestHistoryId };
}

export async function handleGmailPubSubPush(
  body: GmailPubSubPushBody,
): Promise<{ processed: number; results: InboundEmailProcessResult[]; hasMore: boolean }> {
  if (!env.gmailInboundEnabled) {
    return { processed: 0, results: [], hasMore: false };
  }

  const notification = decodePubSubMessage(body);
  if (!notification?.historyId) {
    console.warn('[gmailInbound] notificação Pub/Sub sem historyId');
    return { processed: 0, results: [], hasMore: false };
  }

  const stored = await getStoredHistoryId();
  const startId = stored ?? String(notification.historyId);

  const { results, hasMore } = await processGmailHistory(startId);
  return { processed: results.length, results, hasMore };
}
