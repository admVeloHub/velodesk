import type { SupabaseClient } from '@supabase/supabase-js';

export type WebhookHealthSummary = {
  eventsLast45Min: number;
  eventsToday: number;
  lastReceivedAt: string | null;
  lastOccurredAt: string | null;
  liveCallsTableTalking: number;
  /** Nenhum evento recebido nos últimos 45 min (usa `received_at`). */
  emSilencio: boolean;
};

export async function getWebhookHealthSummary(
  supabase: SupabaseClient,
  todayStr: string,
): Promise<WebhookHealthSummary> {
  const since45 = new Date(Date.now() - 45 * 60_000).toISOString();
  const dayStart = `${todayStr}T00:00:00-03:00`;
  const dayEnd = `${todayStr}T23:59:59-03:00`;

  const [count45, countToday, latest, liveTalking] = await Promise.all([
    supabase
      .from('telecom_webhook_events')
      .select('id', { count: 'exact', head: true })
      .gte('received_at', since45),
    supabase
      .from('telecom_webhook_events')
      .select('id', { count: 'exact', head: true })
      .gte('occurred_at', dayStart)
      .lte('occurred_at', dayEnd),
    supabase
      .from('telecom_webhook_events')
      .select('received_at, occurred_at')
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('telecom_live_calls')
      .select('external_call_id', { count: 'exact', head: true })
      .eq('call_status', 'talking')
      .is('ended_at', null),
  ]);

  const eventsLast45Min = count45.count ?? 0;

  return {
    eventsLast45Min,
    eventsToday: countToday.count ?? 0,
    lastReceivedAt: latest.data?.received_at ?? null,
    lastOccurredAt: latest.data?.occurred_at ?? null,
    liveCallsTableTalking: liveTalking.count ?? 0,
    emSilencio: eventsLast45Min === 0,
  };
}

export function formatWebhookLastEvent(iso: string | null): string {
  if (!iso) return 'nunca hoje';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
