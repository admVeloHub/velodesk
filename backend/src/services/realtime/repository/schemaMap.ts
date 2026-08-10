/** schemaMap — mapeamento de tabelas/coleções por provider (Fase 4: migração Supabase → Mongo). */
export const REALTIME_SCHEMA_MAP = {
  supabase: {
    callsRaw: 'calls_raw',
    telecomWebhookEvents: 'telecom_webhook_events',
    telecomLiveCalls: 'telecom_live_calls',
    syncLogs: 'sync_logs',
    operators: 'operators',
    queues: 'queues',
    operatorEvents: 'operator_events',
    scaleEvents: 'scale_events',
  },
  mongo: {
    callsRaw: 'realtime_calls_raw',
    telecomWebhookEvents: 'realtime_telecom_webhook_events',
    telecomLiveCalls: 'realtime_telecom_live_calls',
    syncLogs: 'realtime_sync_logs',
  },
} as const;

export type RealtimeTelephonyProvider = keyof typeof REALTIME_SCHEMA_MAP;
