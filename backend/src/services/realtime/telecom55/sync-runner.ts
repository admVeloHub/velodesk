/**
 * Runner de sincronização 55Telecom - pode ser chamado via cron (sem sessão).
 * Garante idempotência via upsert em call_id e event_id.
 */

import { getRealtimeSupabaseClient, type RealtimeSupabaseClient } from '../../../config/supabaseRealtime';
import { DEFAULT_QUEUE_EXTERNAL_IDS, queueDisplayName } from '../telephony/queueDisplay';
import { fetchReport, type Telecom55ReportParams } from './client';
import { extractRecords, mapToCallRaw, mapToOperatorEvent, mapToScaleEvent, mapToReport01Raw, parseReport01Aggregates, parseApiResponseToMetrics } from './mappers';

/**
 * Resolve Wy_branch_mask_agent (gravado em operators.external_id) → operators.id.
 * Mapa com trim(external_id). Ver docs/VINCULO_OPERADOR_55_WY_BRANCH_MASK.md.
 */
function createResolverCache(supabase: RealtimeSupabaseClient) {
  let operatorRamalToId: Map<string, string> | null = null;
  const queueCache = new Map<string, string | null>();

  async function loadOperatorRamalToId(): Promise<Map<string, string>> {
    if (operatorRamalToId) return operatorRamalToId;
    const { data } = await supabase
      .from('operators')
      .select('id, external_id')
      .is('deleted_at', null);
    const m = new Map<string, string>();
    for (const row of data ?? []) {
      const k = String(row.external_id ?? '').trim();
      if (k && !m.has(k)) m.set(k, row.id as string);
    }
    operatorRamalToId = m;
    return m;
  }

  async function resolveOperatorId(externalId: string | null): Promise<string | null> {
    const t = externalId?.trim() ?? '';
    if (!t) return null;
    const m = await loadOperatorRamalToId();
    return m.get(t) ?? null;
  }

  async function resolveQueueId(queueExternalId: string | null): Promise<string | null> {
    if (!queueExternalId) return null;
    const k = queueExternalId;
    if (queueCache.has(k)) return queueCache.get(k)!;
    const { data } = await supabase
      .from('queues')
      .select('id')
      .eq('external_id', queueExternalId)
      .maybeSingle();
    const id = data?.id ?? null;
    queueCache.set(k, id);
    return id;
  }

  async function ensureQueue(externalId: string): Promise<string | null> {
    if (queueCache.has(externalId)) return queueCache.get(externalId)!;
    const { data: existing } = await supabase.from('queues').select('id').eq('external_id', externalId).maybeSingle();
    if (existing) {
      queueCache.set(externalId, existing.id);
      return existing.id;
    }
    const { data: inserted } = await supabase
      .from('queues')
      .insert({ name: queueDisplayName(null, externalId), external_id: externalId, sla_target_sec: 30, active: true })
      .select('id')
      .single();
    const id = inserted?.id ?? null;
    queueCache.set(externalId, id);
    return id;
  }

  return { resolveOperatorId, resolveQueueId, ensureQueue };
}

const ALL_QUEUES_UUID = '00000000-0000-0000-0000-000000000001';
const BATCH_SIZE = 300;

/** Remove duplicatas por chave; em conflito, mantém a última ocorrência (evita erro "cannot affect row a second time") */
function dedupeByKey<T extends Record<string, unknown>>(arr: T[], keyField: string): T[] {
  const map = new Map<string, T>();
  for (const row of arr) {
    const k = String(row[keyField] ?? '');
    if (k) map.set(k, row);
  }
  return Array.from(map.values());
}

export interface SyncRunnerResult {
  success: boolean;
  error?: string;
  syncLogId?: string;
  kpiProcessed?: number;
  metricsInserted?: number;
  callsProcessed?: number;
  callsInserted?: number;
  eventsProcessed?: number;
  eventsInserted?: number;
  scaleEventsProcessed?: number;
  scaleEventsInserted?: number;
  report01Processed?: number;
  report01Inserted?: number;
}

export async function runSync55Telecom(
  dateStart: string,
  dateEnd: string,
  options?: { skipRevalidate?: boolean; syncType?: string }
): Promise<SyncRunnerResult> {
  const supabase = getRealtimeSupabaseClient();
  const logId = crypto.randomUUID();
  const syncType = options?.syncType ?? 'manual';

  try {
    await supabase.from('sync_logs').insert({
      id: logId,
      sync_type: syncType,
      started_at: new Date().toISOString(),
      status: 'running',
      metadata: { dateStart, dateEnd, source: options?.syncType === 'cron' || options?.syncType === 'cron_d2' ? 'cron' : 'manual' },
    });
  } catch {
    // ignora
  }

  // Parse YYYY-MM-DD como data local (evita bug de timezone)
  const parseLocalDate = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const startDate = /^\d{4}-\d{2}-\d{2}/.test(dateStart) ? parseLocalDate(dateStart) : new Date(dateStart);
  const endDate = /^\d{4}-\d{2}-\d{2}/.test(dateEnd) ? parseLocalDate(dateEnd) : new Date(dateEnd);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateEnd)) {
    endDate.setHours(23, 59, 59, 999);
  }
  const baseParams: Omit<Telecom55ReportParams, 'report'> = {
    dateStart: startDate,
    dateEnd: endDate,
    queue: 'all_queues',
    number: 'all_numbers',
    agent: 'all_agent',
    timezone: -3,
  };

  let kpiProcessed = 0;
  let metricsInserted = 0;
  let callsProcessed = 0;
  let callsInserted = 0;
  let eventsProcessed = 0;
  let eventsInserted = 0;
  let scaleEventsProcessed = 0;
  let scaleEventsInserted = 0;
  let report01Processed = 0;
  let report01Inserted = 0;

  const { resolveOperatorId, resolveQueueId, ensureQueue } = createResolverCache(supabase);

  try {
    const { data: queues } = await supabase.from('queues').select('id, external_id').eq('active', true);
    let queueIdsToTry = (queues ?? []).filter((q) => q.external_id).map((q) => q.external_id!);
    if (queueIdsToTry.length === 0) {
      queueIdsToTry = ['all_queues', ...DEFAULT_QUEUE_EXTERNAL_IDS];
    }

    // Busca todos report_01 em paralelo (era o maior gargalo)
    const report01Promises = queueIdsToTry.map((qId) =>
      fetchReport<unknown>({ ...baseParams, queue: qId, report: 'report_01' }).then((data) => ({ qId, data }))
    );
    const report01Results = await Promise.all(report01Promises);

    for (const { qId, data: report01Data } of report01Results) {
      const queueUuid: string =
        qId === 'all_queues'
          ? ALL_QUEUES_UUID
          : (await resolveQueueId(qId)) ?? (await ensureQueue(qId)) ?? ALL_QUEUES_UUID;
      const dateStr = dateStart.slice(0, 10);
      const queueExtId = qId === 'all_queues' ? 'all_queues' : qId;

      try {
        const report01Row = mapToReport01Raw(report01Data, dateStr, queueExtId);
        if (Object.keys(report01Row).length > 3) {
          const payload = Object.fromEntries(
            Object.entries({ ...report01Row, queue_id: queueUuid === ALL_QUEUES_UUID ? null : queueUuid }).filter((entry) => entry[1] !== undefined)
          );
          const { error: r01Err } = await supabase.from('report_01_raw').upsert(payload, {
            onConflict: 'date,queue_external_id',
            ignoreDuplicates: false,
          });
          report01Processed++;
          if (!r01Err) report01Inserted++;
        }
      } catch {
        // skip
      }

      const metricRows = parseApiResponseToMetrics(report01Data);
      const metricBatch: Record<string, unknown>[] = [];
      for (const row of metricRows) {
        const operatorUuid = row.external_operator_id
          ? await resolveOperatorId(row.external_operator_id)
          : null;
        metricBatch.push({
          date: dateStr,
          queue_id: queueUuid,
          queue_external_id: qId === 'all_queues' ? 'all_queues' : qId,
          report: 'report_01',
          metric_name: row.metric_name,
          value_numeric: row.value_numeric,
          value_text: row.value_text ?? null,
          operator_id: operatorUuid,
          external_operator_id: row.external_operator_id ?? null,
          event_at: row.event_at ?? null,
          call_id: row.call_id ?? null,
          raw_payload: row.raw_payload ?? null,
        });
      }
      for (let i = 0; i < metricBatch.length; i += BATCH_SIZE) {
        const chunk = metricBatch.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('telecom_metrics_raw').upsert(chunk, {
          onConflict: 'upsert_key',
          ignoreDuplicates: false,
        });
        metricsInserted += error ? 0 : chunk.length;
      }
      if (metricRows.length > 0) kpiProcessed++;

      const agg = parseReport01Aggregates(report01Data);
      if (agg && queueUuid) {
        const totalAbandoned = agg.totalCallAbandonedQueue + agg.totalCallAbandonedURA;
        const totalTalkSec = Math.round(agg.timeMediumDurationCall * agg.totalCallAttendedReceptive);
        await supabase.from('kpi_daily').upsert(
          {
            date: dateStr,
            queue_id: queueUuid === ALL_QUEUES_UUID ? null : queueUuid,
            operator_id: null,
            calls_received: agg.totalCallProcessedURA,
            calls_answered: agg.totalCallAttendedReceptive,
            calls_abandoned: totalAbandoned,
            total_wait_sec: 0,
            total_talk_sec: totalTalkSec,
          },
          { onConflict: 'date,queue_id,operator_id', ignoreDuplicates: false }
        );
      }
    }

    // Busca report_02, report_03 e report_04 em paralelo
    const [report02Data, report03Data, report04Data] = await Promise.all([
      fetchReport<unknown>({ ...baseParams, queue: 'all_queues', report: 'report_02' }),
      fetchReport<unknown>({ ...baseParams, queue: 'all_queues', report: 'report_03' }),
      fetchReport<unknown>({ ...baseParams, report: 'report_04' }),
    ]);

    for (const data of [report02Data, report03Data]) {
      try {
        const rows = extractRecords(data);
        const callsBatch: Record<string, unknown>[] = [];
        for (const row of rows) {
          try {
            const mapped = mapToCallRaw(row as Record<string, unknown>);
            const operatorId = await resolveOperatorId(mapped.external_operator_id);
            const queueId = (mapped.queue_external_id ?? mapped.wx_queue_id)
              ? await resolveQueueId(mapped.queue_external_id ?? mapped.wx_queue_id)
              : null;

            callsBatch.push({
              call_id: mapped.call_id,
              started_at: mapped.started_at,
              ended_at: mapped.ended_at,
              queue_id: queueId,
              queue_name: mapped.queue_name,
              operator_id: operatorId,
              external_operator_id: mapped.external_operator_id,
              status: mapped.status,
              wait_time_sec: mapped.wait_time_sec,
              talk_time_sec: mapped.talk_time_sec,
              customer_number: mapped.customer_number,
              chamada: mapped.chamada,
              operador: mapped.operador,
              pais: mapped.pais,
              ddd: mapped.ddd,
              numero: mapped.numero,
              tempo_ura_sec: mapped.tempo_ura_sec,
              tempo_total_sec: mapped.tempo_total_sec,
              desconexao: mapped.desconexao,
              telefone_entrada: mapped.telefone_entrada,
              caminho_ura: mapped.caminho_ura,
              cpf_cnpj: mapped.cpf_cnpj,
              pedido: mapped.pedido,
              id_ligacao_origem: mapped.id_ligacao_origem,
              id_ticket: mapped.id_ticket,
              fluxo_filas: mapped.fluxo_filas,
              agentes_chamados: mapped.agentes_chamados,
              humor_cliente: mapped.humor_cliente,
              qualidade_ligacao: mapped.qualidade_ligacao,
              qtd_transbordos: mapped.qtd_transbordos,
              motivo_desconexao: mapped.motivo_desconexao,
              wz_branch_number_id: mapped.wz_branch_number_id,
              wx_branch_number_agent: mapped.wx_branch_number_agent,
              wy_branch_email_agent: mapped.wy_branch_email_agent,
              wy_branch_mask_agent: mapped.wy_branch_mask_agent,
              branch_number: mapped.branch_number,
              wx_queue_id: mapped.wx_queue_id,
              xa_call_overflow_time: mapped.xa_call_overflow_time,
              data_atendimento: mapped.data_atendimento,
              source: 'api',
              raw_payload: mapped.raw_payload,
            });
          } catch {
            // skip
          }
        }
        const callsDeduped = dedupeByKey(callsBatch, 'call_id');
        for (let i = 0; i < callsDeduped.length; i += BATCH_SIZE) {
          const chunk = callsDeduped.slice(i, i + BATCH_SIZE);
          const { error } = await supabase.from('calls_raw').upsert(chunk, {
            onConflict: 'call_id',
            ignoreDuplicates: false,
          });
          callsProcessed += chunk.length;
          if (!error) callsInserted += chunk.length;
        }
      } catch {
        // report_02/03 podem não retornar ligações individuais
      }
    }

    const eventRows = extractRecords(report04Data);
    const eventsBatch: Record<string, unknown>[] = [];
    const scaleBatch: Record<string, unknown>[] = [];

    for (const row of eventRows) {
      try {
        const mapped = mapToOperatorEvent(row as Record<string, unknown>);
        const resolvedOperatorId = await resolveOperatorId(mapped.external_operator_id);

        eventsBatch.push({
          event_id: mapped.event_id,
          operator_id: resolvedOperatorId,
          external_operator_id: mapped.external_operator_id,
          event_type: mapped.event_type,
          pause_type: mapped.pause_type,
          started_at: mapped.started_at,
          ended_at: mapped.ended_at,
          raw_payload: mapped.raw_payload,
        });

        try {
          const scaleMapped = mapToScaleEvent(row as Record<string, unknown>);
          scaleBatch.push({
            event_id: scaleMapped.event_id,
            operator_id: resolvedOperatorId,
            name: scaleMapped.name,
            wz_branch_number_id: scaleMapped.wz_branch_number_id,
            branch: scaleMapped.branch,
            number: scaleMapped.number,
            user_email: scaleMapped.user_email,
            queue_name: scaleMapped.queue_name,
            queue_id: scaleMapped.queue_id,
            event: scaleMapped.event,
            time_at: scaleMapped.time_at,
            date_str: scaleMapped.date_str,
            hour_start: scaleMapped.hour_start,
            date_end: scaleMapped.date_end,
            hour_end: scaleMapped.hour_end,
            duration: scaleMapped.duration,
            pause_reason: scaleMapped.pause_reason,
            pause_id: scaleMapped.pause_id,
            dif_time: scaleMapped.dif_time,
            quantity: scaleMapped.quantity,
            pause_type: scaleMapped.pause_type,
            work_journey: scaleMapped.work_journey,
            emails: scaleMapped.emails,
            work_journey_id: scaleMapped.work_journey_id,
            user_ip: scaleMapped.user_ip,
            raw_payload: scaleMapped.raw_payload,
          });
        } catch {
          // skip scale
        }
      } catch {
        // skip
      }
    }

    const eventsDeduped = dedupeByKey(eventsBatch, 'event_id');
    for (let i = 0; i < eventsDeduped.length; i += BATCH_SIZE) {
      const chunk = eventsDeduped.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('operator_events').upsert(chunk, {
        onConflict: 'event_id',
        ignoreDuplicates: false,
      });
      eventsProcessed += chunk.length;
      if (!error) eventsInserted += chunk.length;
    }
    const scaleDeduped = dedupeByKey(scaleBatch, 'event_id');
    for (let i = 0; i < scaleDeduped.length; i += BATCH_SIZE) {
      const chunk = scaleDeduped.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('scale_events').upsert(chunk, {
        onConflict: 'event_id',
        ignoreDuplicates: false,
      });
      scaleEventsProcessed += chunk.length;
      if (!error) scaleEventsInserted += chunk.length;
    }

    await supabase
      .from('sync_logs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'completed',
        records_processed: kpiProcessed + callsProcessed + eventsProcessed + scaleEventsProcessed + report01Processed,
        records_inserted: callsInserted + eventsInserted + scaleEventsInserted + report01Inserted,
        metadata: {
          dateStart,
          dateEnd,
          kpiProcessed,
          metricsInserted,
          callsProcessed,
          callsInserted,
          eventsProcessed,
          eventsInserted,
          scaleEventsProcessed,
          scaleEventsInserted,
          report01Processed,
          report01Inserted,
        },
      })
      .eq('id', logId);

    return {
      success: true,
      syncLogId: logId,
      kpiProcessed,
      metricsInserted,
      callsProcessed,
      callsInserted,
      eventsProcessed,
      eventsInserted,
      scaleEventsProcessed,
      scaleEventsInserted,
      report01Processed,
      report01Inserted,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from('sync_logs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'failed',
        error_message: msg,
        records_processed: kpiProcessed + callsProcessed + eventsProcessed + scaleEventsProcessed + report01Processed,
        records_inserted: callsInserted + eventsInserted + scaleEventsInserted + report01Inserted,
      })
      .eq('id', logId);

    return {
      success: false,
      error: msg,
      syncLogId: logId,
      kpiProcessed,
      metricsInserted,
      callsProcessed,
      callsInserted,
      eventsProcessed,
      eventsInserted,
      scaleEventsProcessed,
      scaleEventsInserted,
      report01Processed,
      report01Inserted,
    };
  }
}

/**
 * Só report_04 (eventos de agente): preenche operator_events e scale_events.
 * Não chama report_01, report_02/03 (ligações) — bem mais leve que runSync55Telecom completo.
 */
export async function runSync55TelecomEventsOnly(
  dateStart: string,
  dateEnd: string,
  options?: { skipRevalidate?: boolean; syncType?: string; exactDateTime?: boolean },
): Promise<SyncRunnerResult> {
  const supabase = getRealtimeSupabaseClient();
  const logId = crypto.randomUUID();
  const syncType = options?.syncType ?? 'manual_events_only';

  try {
    await supabase.from('sync_logs').insert({
      id: logId,
      sync_type: syncType,
      started_at: new Date().toISOString(),
      status: 'running',
      metadata: { dateStart, dateEnd, mode: 'events_only', source: 'manual' },
    });
  } catch {
    // ignora
  }

  const parseLocalDate = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const startDate = /^\d{4}-\d{2}-\d{2}/.test(dateStart) ? parseLocalDate(dateStart) : new Date(dateStart);
  const endDate = /^\d{4}-\d{2}-\d{2}/.test(dateEnd) ? parseLocalDate(dateEnd) : new Date(dateEnd);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateEnd)) {
    endDate.setHours(23, 59, 59, 999);
  }
  const baseParams: Omit<Telecom55ReportParams, 'report'> = {
    dateStart: startDate,
    dateEnd: endDate,
    queue: 'all_queues',
    number: 'all_numbers',
    agent: 'all_agent',
    timezone: -3,
    exactDateTime: options?.exactDateTime === true,
  };

  let eventsProcessed = 0;
  let eventsInserted = 0;
  let scaleEventsProcessed = 0;
  let scaleEventsInserted = 0;

  const { resolveOperatorId } = createResolverCache(supabase);

  try {
    const report04Data = await fetchReport<unknown>({ ...baseParams, report: 'report_04' });

    const eventRows = extractRecords(report04Data);
    const eventsBatch: Record<string, unknown>[] = [];
    const scaleBatch: Record<string, unknown>[] = [];

    for (const row of eventRows) {
      try {
        const mapped = mapToOperatorEvent(row as Record<string, unknown>);
        const resolvedOperatorId = await resolveOperatorId(mapped.external_operator_id);

        eventsBatch.push({
          event_id: mapped.event_id,
          operator_id: resolvedOperatorId,
          external_operator_id: mapped.external_operator_id,
          event_type: mapped.event_type,
          pause_type: mapped.pause_type,
          started_at: mapped.started_at,
          ended_at: mapped.ended_at,
          raw_payload: mapped.raw_payload,
        });

        try {
          const scaleMapped = mapToScaleEvent(row as Record<string, unknown>);
          scaleBatch.push({
            event_id: scaleMapped.event_id,
            operator_id: resolvedOperatorId,
            name: scaleMapped.name,
            wz_branch_number_id: scaleMapped.wz_branch_number_id,
            branch: scaleMapped.branch,
            number: scaleMapped.number,
            user_email: scaleMapped.user_email,
            queue_name: scaleMapped.queue_name,
            queue_id: scaleMapped.queue_id,
            event: scaleMapped.event,
            time_at: scaleMapped.time_at,
            date_str: scaleMapped.date_str,
            hour_start: scaleMapped.hour_start,
            date_end: scaleMapped.date_end,
            hour_end: scaleMapped.hour_end,
            duration: scaleMapped.duration,
            pause_reason: scaleMapped.pause_reason,
            pause_id: scaleMapped.pause_id,
            dif_time: scaleMapped.dif_time,
            quantity: scaleMapped.quantity,
            pause_type: scaleMapped.pause_type,
            work_journey: scaleMapped.work_journey,
            emails: scaleMapped.emails,
            work_journey_id: scaleMapped.work_journey_id,
            user_ip: scaleMapped.user_ip,
            raw_payload: scaleMapped.raw_payload,
          });
        } catch {
          // skip scale
        }
      } catch {
        // skip
      }
    }

    const eventsDeduped = dedupeByKey(eventsBatch, 'event_id');
    for (let i = 0; i < eventsDeduped.length; i += BATCH_SIZE) {
      const chunk = eventsDeduped.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('operator_events').upsert(chunk, {
        onConflict: 'event_id',
        ignoreDuplicates: false,
      });
      eventsProcessed += chunk.length;
      if (!error) eventsInserted += chunk.length;
    }
    const scaleDeduped = dedupeByKey(scaleBatch, 'event_id');
    for (let i = 0; i < scaleDeduped.length; i += BATCH_SIZE) {
      const chunk = scaleDeduped.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('scale_events').upsert(chunk, {
        onConflict: 'event_id',
        ignoreDuplicates: false,
      });
      scaleEventsProcessed += chunk.length;
      if (!error) scaleEventsInserted += chunk.length;
    }

    await supabase
      .from('sync_logs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'completed',
        records_processed: eventsProcessed + scaleEventsProcessed,
        records_inserted: eventsInserted + scaleEventsInserted,
        metadata: {
          dateStart,
          dateEnd,
          mode: 'events_only',
          eventsProcessed,
          eventsInserted,
          scaleEventsProcessed,
          scaleEventsInserted,
        },
      })
      .eq('id', logId);

    return {
      success: true,
      syncLogId: logId,
      kpiProcessed: 0,
      metricsInserted: 0,
      callsProcessed: 0,
      callsInserted: 0,
      eventsProcessed,
      eventsInserted,
      scaleEventsProcessed,
      scaleEventsInserted,
      report01Processed: 0,
      report01Inserted: 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from('sync_logs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'failed',
        error_message: msg,
        records_processed: eventsProcessed + scaleEventsProcessed,
        records_inserted: eventsInserted + scaleEventsInserted,
      })
      .eq('id', logId);

    return {
      success: false,
      error: msg,
      syncLogId: logId,
      kpiProcessed: 0,
      metricsInserted: 0,
      callsProcessed: 0,
      callsInserted: 0,
      eventsProcessed,
      eventsInserted,
      scaleEventsProcessed,
      scaleEventsInserted,
      report01Processed: 0,
      report01Inserted: 0,
    };
  }
}
