import { queueByOriginPhone } from '../telephony/queueDisplay';

/**
 * Mapeamento dos relatórios 55Telecom para o modelo interno.
 * Como a estrutura exata da API pode variar, usamos fallbacks para vários nomes de campo.
 */

function getStr(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v) return v;
    if (typeof v === 'number') return String(v);
  }
  return null;
}

function getNum(obj: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string') {
      const n = parseInt(v, 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

// Fuso fixo de Brasília (-03:00). O Brasil não tem horário de verão desde 2019,
// então o offset é constante para todos os dados de 2025 em diante.
// A API 55Telecom entrega horário LOCAL (BRT), inclusive quando sufixa a string
// com "Z" (ex.: wl_time_attended). Interpretamos tudo como -03:00 para não depender
// do fuso do servidor (Vercel roda em UTC, o que gravava as horas 3h atrasadas).
const BRT_OFFSET = '-03:00';

/** true se a string já traz fuso explícito (Z ou ±HH:MM / ±HHMM) */
function hasExplicitOffset(s: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(s.trim());
}

function parseDate(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') {
    const s = val.trim();
    const ddmm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (ddmm) {
      const [, d, m, y, h = '0', min = '0', sec = '0'] = ddmm;
      const pad = (v: string) => v.padStart(2, '0');
      const iso = `${y}-${pad(m!)}-${pad(d!)}T${pad(h!)}:${pad(min!)}:${pad(sec!)}${BRT_OFFSET}`;
      const date = new Date(iso);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    // Datas ISO/naive sem fuso explícito também são horário local (BRT) nesta API.
    const normalized = hasExplicitOffset(s) ? s : `${s.replace(' ', 'T')}${BRT_OFFSET}`;
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof val === 'number') {
    // Excel serial date: dias desde 30/12/1899
    if (val > 10000) {
      const d = new Date((val - 25569) * 86400 * 1000);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/** Converte HH:MM:SS, HH:MM ou número (segundos/fracionado) para segundos */
function parseTimeToSec(val: unknown): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return Math.round(val);
  const s = String(val).trim();
  if (!s) return null;
  const parts = s.split(':').map((p) => parseInt(p, 10));
  if (parts.length >= 2) {
    const [h = 0, m = 0, sec = 0] = parts;
    return h * 3600 + m * 60 + sec;
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : Math.round(n);
}


/** Extrai array de registros do retorno da API (array direto ou objeto com data/records/results) */
export function extractRecords(data: unknown): Record<string, unknown>[] {
  const filterValid = (arr: unknown[]) =>
    arr.filter((i) => i && typeof i === 'object') as Record<string, unknown>[];

  if (Array.isArray(data)) return filterValid(data);
  if (!data || typeof data !== 'object') return [];

  const obj = data as Record<string, unknown>;
  const arrayKeys = [
    'data_report02', 'data_report03', 'data_report04', 'Data_report02', 'Data_report03', 'Data_report04',
    'data', 'records', 'results', 'rows', 'calls', 'events', 'list', 'List',
    'report_04', 'Report_04', 'data_report_04', 'Report_02', 'Report_03',
    'report_02', 'report_03', 'operator_actions', 'OperatorActions', 'operatorActions',
    'agent_actions', 'AgentActions', 'actions', 'scale_events', 'ScaleEvents',
    'lista', 'items', 'result', 'values', 'relatorio', 'metrics', 'callsList',
  ];
  for (const key of arrayKeys) {
    const val = obj[key];
    if (Array.isArray(val)) return filterValid(val);
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const inner = extractRecords(val);
      if (inner.length > 0) return inner;
    }
  }
  const values = Object.values(obj);
  const firstArr = values.find((v) => Array.isArray(v) && v.length > 0);
  if (firstArr) return filterValid(firstArr as unknown[]);
  return [];
}

/** Report 01 retorna métricas agregadas (não ligações individuais) */
export interface Report01Aggregates {
  totalCallProcessedURA: number;
  totalCallAttendedReceptive: number;
  totalCallAbandonedQueue: number;
  totalCallAbandonedURA: number;
  timeMediumDurationCall: number;
}

/** Extrai métricas do report_01 (totalCallProcessedURA, totalCallAttendedReceptive, etc.) */
export function parseReport01Aggregates(data: unknown): Report01Aggregates | null {
  if (!data || typeof data !== 'object') return null;
  let obj = data as Record<string, unknown>;
  if (Object.keys(obj).length === 1) {
    const firstVal = Object.values(obj)[0];
    if (firstVal && typeof firstVal === 'object') obj = firstVal as Record<string, unknown>;
  }
  if (Array.isArray(obj)) {
    const first = obj[0];
    if (first && typeof first === 'object') obj = first as Record<string, unknown>;
  }
  const getNum = (k: string) => {
    const v = obj[k];
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      // Tentar converter formato de tempo HH:MM:SS para segundos
      const timeMatch = v.match(/(\d+):(\d+):(\d+)/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10) || 0;
        const minutes = parseInt(timeMatch[2], 10) || 0;
        const seconds = parseInt(timeMatch[3], 10) || 0;
        return hours * 3600 + minutes * 60 + seconds;
      }
      // Tentar parsear como número
      return parseInt(v, 10) || 0;
    }
    return 0;
  };
  const received = getNum('totalCallProcessedURA') || getNum('TotalCallProcessedURA');
  const answered = getNum('totalCallAttendedReceptive') || getNum('TotalCallAttendedReceptive');
  const abandonedQ = getNum('totalCallAbandonedQueue') || getNum('TotalCallAbandonedQueue');
  const abandonedU = getNum('totalCallAbandonedURA') || getNum('TotalCallAbandonedURA');
  const tma = getNum('timeMediumDurationCall') || getNum('TimeMediumDurationCall');
  if (received === 0 && answered === 0 && abandonedQ === 0 && abandonedU === 0) return null;
  return {
    totalCallProcessedURA: received,
    totalCallAttendedReceptive: answered,
    totalCallAbandonedQueue: abandonedQ,
    totalCallAbandonedURA: abandonedU,
    timeMediumDurationCall: tma,
  };
}

export interface MetricRow {
  metric_name: string;
  value_numeric: number;
  value_text?: string;
  operator_id?: string;
  external_operator_id?: string;
  event_at?: string;
  call_id?: string;
  raw_payload?: Record<string, unknown>;
}

/** Converte resposta report_01 em lista de métricas (uma linha por métrica) */
export function report01ToMetricRows(data: unknown, context?: Partial<MetricRow>): MetricRow[] {
  if (!data || typeof data !== 'object') return [];
  let obj = data as Record<string, unknown>;
  if (Object.keys(obj).length === 1) {
    const firstVal = Object.values(obj)[0];
    if (firstVal && typeof firstVal === 'object') obj = firstVal as Record<string, unknown>;
  }
  if (Array.isArray(obj)) return [];

  const rows: MetricRow[] = [];
  const metricKeys = [
    'totalCallProcessedURA',
    'totalCallAttendedReceptive',
    'totalCallAbandonedQueue',
    'totalCallAbandonedURA',
    'timeMediumDurationCall',
  ];

  const base: Partial<MetricRow> = { ...context };

  for (const key of metricKeys) {
    const v = obj[key];
    let num = 0;
    let textVal: string | undefined = undefined;
    
    if (typeof v === 'number') {
      num = v;
    } else if (typeof v === 'string') {
      textVal = v;
      // Tentar converter formato de tempo HH:MM:SS para segundos
      const timeMatch = v.match(/(\d+):(\d+):(\d+)/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10) || 0;
        const minutes = parseInt(timeMatch[2], 10) || 0;
        const seconds = parseInt(timeMatch[3], 10) || 0;
        num = hours * 3600 + minutes * 60 + seconds;
      } else {
        num = parseInt(v, 10) || 0;
      }
    }
    
    rows.push({ ...base, metric_name: key, value_numeric: num, value_text: textVal });
  }

  for (const [k, v] of Object.entries(obj)) {
    if (metricKeys.some((m) => m.toLowerCase() === k.toLowerCase())) continue;
    
    if (typeof v === 'number' && !Number.isNaN(v)) {
      rows.push({ ...base, metric_name: k, value_numeric: v });
    } else if (typeof v === 'string') {
      // Tentar converter formato de tempo HH:MM:SS para segundos
      const timeMatch = v.match(/(\d+):(\d+):(\d+)/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10) || 0;
        const minutes = parseInt(timeMatch[2], 10) || 0;
        const seconds = parseInt(timeMatch[3], 10) || 0;
        const num = hours * 3600 + minutes * 60 + seconds;
        rows.push({ ...base, metric_name: k, value_numeric: num, value_text: v });
      } else {
        const n = parseInt(v, 10);
        if (!Number.isNaN(n)) {
          rows.push({ ...base, metric_name: k, value_numeric: n, value_text: v });
        }
      }
    }
  }

  return rows;
}

/** Converte resposta da API em MetricRows - suporta agregado ou array (por operador/chamada) */
export function parseApiResponseToMetrics(data: unknown): MetricRow[] {
  if (!data || typeof data !== 'object') return [];
  let obj = data as Record<string, unknown>;

  if (Array.isArray(obj)) {
    const all: MetricRow[] = [];
    for (const item of obj) {
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const ctx: Partial<MetricRow> = {
          external_operator_id: getStr(rec, 'Wy_branch_mask_agent', 'wy_branch_mask_agent') ?? undefined,
          call_id: getStr(rec, 'call_id', 'uniqueid', 'id') ?? undefined,
          event_at: parseDate(rec.start_time ?? rec.started_at ?? rec.date ?? rec.datetime) ?? undefined,
          raw_payload: rec,
        };
        all.push(...report01ToMetricRows(rec, ctx));
      }
    }
    return all;
  }

  if (Object.keys(obj).length === 1) {
    const firstVal = Object.values(obj)[0];
    if (Array.isArray(firstVal)) {
      return parseApiResponseToMetrics(firstVal);
    }
    if (firstVal && typeof firstVal === 'object') {
      obj = firstVal as Record<string, unknown>;
    }
  }

  return report01ToMetricRows(obj, { raw_payload: obj });
}

/** Mapeia registro da API para calls_raw (report_02/03 - estrutura conforme Excel 55Telecom) */
export function mapToCallRaw(row: Record<string, unknown>): {
  call_id: string;
  started_at: string;
  ended_at: string | null;
  queue_external_id: string | null;
  queue_name: string | null;
  external_operator_id: string | null;
  status: string;
  wait_time_sec: number | null;
  talk_time_sec: number | null;
  customer_number: string | null;
  chamada: string | null;
  operador: string | null;
  pais: number | null;
  ddd: string | null;
  numero: string | null;
  tempo_ura_sec: number | null;
  tempo_total_sec: number | null;
  desconexao: string | null;
  telefone_entrada: string | null;
  caminho_ura: string | null;
  cpf_cnpj: string | null;
  pedido: string | null;
  id_ligacao_origem: string | null;
  id_ticket: string | null;
  fluxo_filas: unknown;
  agentes_chamados: string | null;
  humor_cliente: string | null;
  qualidade_ligacao: string | null;
  qtd_transbordos: number | null;
  motivo_desconexao: string | null;
  wz_branch_number_id: string | null;
  wx_branch_number_agent: string | null;
  wy_branch_email_agent: string | null;
  wy_branch_mask_agent: string | null;
  branch_number: string | null;
  wx_queue_id: string | null;
  xa_call_overflow_time: string | null;
  data_atendimento: string | null;
  raw_payload: Record<string, unknown>;
} {
  const callId =
    getStr(row, 'call_id', 'uniqueid', 'id', 'callid', 'CallId', 'uuid', 'request_id', 'reqId', 'Id Ligação') ??
    (() => {
      const k = Object.keys(row).find((rk) => rk.includes('Id') && rk.includes('Lig') && !rk.includes('Origem'));
      return k ? String(row[k as keyof typeof row] ?? '').trim() || null : null;
    })();
  if (!callId) throw new Error('Registro sem call_id/uniqueid/Id Ligação');

  const dataStr = getStr(row, 'Data', 'date', 'Date', 'start_date', 'call_date');
  const horaStr = getStr(row, 'Hora', 'hora', 'Hora', 'time', 'start_time', 'wb_call_hour');
  const dataAtendStr = getStr(row, 'Data Atendimento', 'Data Do Atendimento', 'date_attended');
  const horaAtendStr = getStr(row, 'Hora Atendimento', 'hour_attended');

  const parseDt = (d: string | null, t: string | null) =>
    d && t ? parseDate(`${d} ${t}`) ?? parseDate(d) : d ? parseDate(d) : null;

  const started =
    parseDate(row.start_time ?? row.started_at ?? row.start ?? row.datetime) ??
    parseDt(dataStr, horaStr) ??
    new Date().toISOString();
  const ended =
    parseDate(row.end_time ?? row.ended_at ?? row.end ?? row.finish) ?? parseDt(dataAtendStr, horaAtendStr);

  // Vínculo ao cadastro: somente Wy_branch_mask_agent → operators.external_id (sem Branch_number / Wx_branch_number_agent).
  const externalOp = getStr(row, 'Wy_branch_mask_agent', 'wy_branch_mask_agent', 'branch');
  // API 55Telecom usa type_call (call_attended, NOANSWER, etc.) – priorizar
  const chamada = getStr(row, 'type_call', 'Chamada', 'chamada', 'call_type', 'type', 'CallType', 'call_status') ??
    (() => {
      const k = Object.keys(row).find((rk) => rk.toLowerCase().includes('chamada') || rk.toLowerCase().includes('type_call') || rk.toLowerCase() === 'calltype');
      return k ? String(row[k as keyof typeof row] ?? '').trim() || null : null;
    })();
  const desconexao = getStr(row, 'Desconexão', 'Desconexao', 'disconnection');
  const motivoDesconexao = getStr(row, 'Motivo De Desconexão', 'Motivo de Desconexão', 'motivo_desconexao');
  const statusRaw = getStr(row, 'status', 'disposition', 'Disposition', 'state', 'call_status') ?? chamada ?? desconexao ?? 'unknown';

  const waitSec =
    getNum(row, 'wait_time_sec', 'wait_time', 'hold_time', 'wait', 'HoldTime', 'queue_time') ??
    parseTimeToSec(row['call_time_waiting'] ?? row['Tempo De Espera'] ?? row['Tempo de Espera']);
  const talkSec =
    getNum(row, 'talk_time_sec', 'talk_time', 'duration', 'billsec', 'TalkTime', 'call_duration') ??
    parseTimeToSec(row['call_time_spoken'] ?? row['Tempo Falado'] ?? row['Tempo falado']);
  const tempoUraSec = parseTimeToSec(row['Tempo Na Ura'] ?? row['Tempo na URA']);
  const tempoTotalSec =
    getNum(row, 'duration_sec', 'total_duration') ??
    parseTimeToSec(row['call_time_total_duration'] ?? row['Tempo Total'] ?? row['Tempo total']);

  // Armazena valor bruto da API – tratamento/normalização pode ser feito depois (view, UI, etc.)
  const pais = getNum(row, 'País') ?? getNum(row, 'Pais') ?? getNum(row, 'country') ?? getNum(row, 'call_country');
  const ddd = getStr(row, 'DDD', 'ddd', 'area_code', 'area');
  const numero = getStr(row, 'Numero', 'Número', 'number', 'phone', 'caller_number', 'destination');
  const customerNumber =
    getStr(row, 'customer_number', 'caller_id', 'from', 'customer', 'CallerID', 'Telefone Entrada') ??
    (pais != null && (ddd || numero) ? [pais, ddd ?? '', numero ?? ''].filter(Boolean).join('') : null);

  const rawTelefoneEntrada = getStr(row, 'Telefone Entrada', 'telefone_entrada', 'call_number_input');
  const queueFromOriginPhone = queueByOriginPhone(rawTelefoneEntrada);
  const queueExternalId = getStr(row, 'queue_id', 'queue', 'QueueId', 'Wx_queue_id') ?? queueFromOriginPhone?.externalId ?? null;
  const queueName = getStr(row, 'queue_name', 'queueName', 'Queue', 'Fila') ?? queueFromOriginPhone?.name ?? null;

  const fluxoRaw = row['Fluxo De Filas'] ?? row['Fluxo de Filas'] ?? row.fluxo_filas;
  let fluxoFilas: unknown = null;
  if (fluxoRaw != null) {
    if (typeof fluxoRaw === 'object') fluxoFilas = fluxoRaw;
    else {
      const s = String(fluxoRaw).trim();
      if (s && s !== '[]') {
        try {
          fluxoFilas = JSON.parse(s);
        } catch {
          fluxoFilas = s;
        }
      }
    }
  }

  const wzId = row['Wz_branchNumber_id'];
  const xaOverflow = row['Xa_call_overflow_time'];

  return {
    call_id: callId,
    started_at: started,
    ended_at: ended,
    queue_external_id: queueExternalId ?? null,
    queue_name: queueName ?? null,
    external_operator_id: externalOp ?? null,
    status: statusRaw.toLowerCase().replace(/\s+/g, '_'),
    wait_time_sec: waitSec,
    talk_time_sec: talkSec,
    customer_number: customerNumber ?? null,
    chamada: chamada ?? null,
    operador: getStr(row, 'Operador', 'operador', 'agent_name', 'operator', 'operator_name', 'user_name', 'name', 'agent'),
    pais: pais ?? null,
    ddd: ddd ?? null,
    numero: numero ?? null,
    tempo_ura_sec: tempoUraSec,
    tempo_total_sec: tempoTotalSec,
    desconexao: desconexao ?? null,
    telefone_entrada: rawTelefoneEntrada,
    caminho_ura: getStr(row, 'Caminho U R A', 'Caminho URA', 'caminho_ura'),
    cpf_cnpj: getStr(row, 'Cpf/Cnpj', 'Cpf Cnpj', 'cpf_cnpj'),
    pedido: getStr(row, 'Pedido', 'pedido'),
    id_ligacao_origem: getStr(row, 'Id Ligação De Origem', 'Id Ligação de Origem', 'id_ligacao_origem'),
    id_ticket: getStr(row, 'I D Do Ticket', 'I D do Ticket', 'Id Ticket', 'id_ticket'),
    fluxo_filas: fluxoFilas,
    agentes_chamados: getStr(row, 'Agentes Chamados', 'agentes_chamados'),
    humor_cliente: getStr(row, 'Humor Do Cliente', 'Humor do Cliente', 'humor_cliente', 'Pergunta2 1 PERGUNTA ATENDENTE', 'Wh_humor_score') ??
      (getNum(row, 'Wh_humor_score') != null ? String(getNum(row, 'Wh_humor_score')) : null),
    qualidade_ligacao: getStr(row, 'Qualidade Da Ligação', 'Qualidade da Ligação', 'qualidade_ligacao', 'Pergunta2 2 PERGUNTA SOLUCAO', 'Wh_quality_score') ??
      (getNum(row, 'Wh_quality_score') != null ? String(getNum(row, 'Wh_quality_score')) : null),
    qtd_transbordos: getNum(row, 'Quantidade De Transbordos', 'Quantidade de Transbordos', 'qtd_transbordos') ?? null,
    motivo_desconexao: motivoDesconexao ?? null,
    wz_branch_number_id: wzId != null ? String(wzId) : null,
    wx_branch_number_agent: getStr(row, 'Wx_branch_number_agent'),
    wy_branch_email_agent: getStr(row, 'Wy_branch_email_agent'),
    wy_branch_mask_agent: getStr(row, 'Wy_branch_mask_agent'),
    branch_number: getStr(row, 'Branch_number', 'branch_number'),
    wx_queue_id: getStr(row, 'Wx_queue_id', 'wx_queue_id') ?? queueFromOriginPhone?.externalId ?? null,
    xa_call_overflow_time: xaOverflow != null ? String(xaOverflow) : null,
    data_atendimento: parseDt(dataAtendStr, horaAtendStr),
    raw_payload: { ...row },
  };
}

const parseDt = (d: unknown, t: unknown) => {
  const ds = d && typeof d === 'string' ? d.trim() : null;
  const ts = t && typeof t === 'string' ? t.trim() : null;
  return ds && ts ? parseDate(`${ds} ${ts}`) : ds ? parseDate(ds) : null;
};

/** Mapeia registro da API para operator_events (report_04 - Ações de Operador) */
export function mapToOperatorEvent(row: Record<string, unknown>): {
  event_id: string;
  external_operator_id: string | null;
  event_type: 'logon' | 'logoff' | 'pause' | 'unpause';
  pause_type: string | null;
  started_at: string;
  ended_at: string | null;
  raw_payload: Record<string, unknown>;
} {
  // Só máscara 55 → operators.external_id (igual report_02).
  const externalOp = getStr(row, 'Wy_branch_mask_agent', 'wy_branch_mask_agent');
  const typeRaw = (
    getStr(
      row,
      'event_type',
      'type',
      'Type',
      'action',
      'event',
      'eventType',
      'EventType',
      'tipo',
      'Atividade',
      'atividade',
      'activity',
      'Activity',
    ) ?? ''
  ).toLowerCase();
  // report_04 envia time em ISO; fallback para date+hour_start ou campos clássicos
  const startedAt =
    parseDate(row.time ?? row.Time) ??
    parseDt(row.date ?? row.Date, row.hour_start ?? row.hourStart) ??
    parseDate(row.start_time ?? row.started_at ?? row.start ?? row.date ?? row.Data ?? row.datetime) ??
    new Date().toISOString();
  const eventId = getStr(row, 'event_id', 'id', 'uniqueid', 'EventId', 'Id');
  const generatedId = eventId ?? `evt_${externalOp ?? 'x'}_${startedAt}_${typeRaw}`.replace(/\s/g, '_');
  let eventType: 'logon' | 'logoff' | 'pause' | 'unpause' = 'pause';
  if (['logon', 'login', 'log_in', 'entrada', 'in', 'online'].some((t) => typeRaw.includes(t))) eventType = 'logon';
  else if (['logoff', 'logout', 'log_out', 'saida', 'out'].some((t) => typeRaw.includes(t))) eventType = 'logoff';
  else if (['unpause', 'un_pause', 'retorno'].some((t) => typeRaw.includes(t))) eventType = 'unpause';
  else if (['pause', 'pausa', 'break'].some((t) => typeRaw.includes(t))) eventType = 'pause';

  const pauseTypeRaw = getStr(row, 'pause_type', 'pauseType', 'reason', 'tipo', 'motivo')?.toLowerCase() ?? '';
  let pauseType: string | null = null;
  if (eventType === 'pause' || eventType === 'unpause') {
    if (['almoço', 'lunch', 'almoco', 'lunch_break'].some((t) => pauseTypeRaw.includes(t))) pauseType = 'almoço';
    else if (['banheiro', 'bathroom', 'toilet', 'wc'].some((t) => pauseTypeRaw.includes(t))) pauseType = 'banheiro';
    else if (pauseTypeRaw) pauseType = 'outro';
  }

  // report_04 usa date_end + hour_end; fallback para end_time/ended_at
  const ended =
    parseDate(row.end_time ?? row.ended_at ?? row.end ?? row.End) ??
    parseDt(row.date_end ?? row.dateEnd, row.hour_end ?? row.hourEnd);

  return {
    event_id: generatedId,
    external_operator_id: externalOp ?? null,
    event_type: eventType,
    pause_type: pauseType,
    started_at: startedAt,
    ended_at: ended,
    raw_payload: { ...row },
  };
}

/** Mapeia registro report_04 para scale_events (espelho completo) */
export function mapToScaleEvent(row: Record<string, unknown>): {
  event_id: string;
  name: string | null;
  wz_branch_number_id: string | null;
  branch: string | null;
  number: string | null;
  user_email: string | null;
  queue_name: string | null;
  queue_id: string | null;
  event: string | null;
  time_at: string | null;
  date_str: string | null;
  hour_start: string | null;
  date_end: string | null;
  hour_end: string | null;
  duration: string | null;
  pause_reason: string | null;
  pause_id: string | null;
  dif_time: string | null;
  quantity: string | null;
  pause_type: string | null;
  work_journey: unknown;
  emails: unknown;
  work_journey_id: string | null;
  user_ip: string | null;
  raw_payload: Record<string, unknown>;
} {
  const eventId = getStr(row, 'event_id', 'Event_id', 'eventId', 'id', 'EventId', 'uniqueid');
  if (!eventId) throw new Error('Registro report_04 sem event_id');

  const timeVal = row.time ?? row.Time ?? row.datetime ?? row.date;
  const timeAt = parseDate(timeVal) ?? null;

  let workJourney: unknown = null;
  let emailsVal: unknown = null;
  const wj = row.work_journey ?? row.workJourney;
  const em = row.emails ?? row.Emails;
  if (Array.isArray(wj)) workJourney = wj;
  else if (typeof wj === 'string') {
    try {
      const parsed = JSON.parse(wj);
      workJourney = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      workJourney = wj ? [wj] : null;
    }
  }
  if (Array.isArray(em)) emailsVal = em;
  else if (typeof em === 'string') {
    try {
      emailsVal = JSON.parse(em);
    } catch {
      emailsVal = em ? [em] : null;
    }
  }

  return {
    event_id: eventId,
    name: getStr(row, 'name', 'Name', 'agent_name') ?? null,
    wz_branch_number_id: getStr(row, 'wz_branchNumber_id', 'wz_branch_number_id', 'branch_number_id') ?? null,
    // Espelho auditável: só máscara do agente (ramal físico/mesa não identifica pessoa).
    branch: getStr(row, 'Wy_branch_mask_agent', 'wy_branch_mask_agent', 'branch') ?? null,
    number: getStr(row, 'number', 'Number', 'num') ?? null,
    user_email: getStr(row, 'user_email', 'userEmail', 'email') ?? null,
    queue_name: getStr(row, 'queue_name', 'queueName') ?? null,
    queue_id: getStr(row, 'queue_id', 'queueId') ?? null,
    event: getStr(row, 'event', 'Event', 'event_type', 'type') ?? null,
    time_at: timeAt,
    date_str: getStr(row, 'date', 'Date', 'date_str') ?? null,
    hour_start: getStr(row, 'hour_start', 'hourStart') ?? null,
    date_end: getStr(row, 'date_end', 'dateEnd') ?? null,
    hour_end: getStr(row, 'hour_end', 'hourEnd') ?? null,
    duration: getStr(row, 'duration', 'Duration') ?? null,
    pause_reason: getStr(row, 'pause_reason', 'pauseReason') ?? null,
    pause_id: getStr(row, 'pause_id', 'pauseId') ?? null,
    dif_time: getStr(row, 'difTime', 'dif_time') ?? null,
    quantity: getStr(row, 'quantity', 'Quantity') ?? null,
    pause_type: getStr(row, 'pause_type', 'pauseType') ?? null,
    work_journey: workJourney,
    emails: emailsVal,
    work_journey_id: getStr(row, 'work_journey_id', 'workJourneyId') ?? null,
    user_ip: getStr(row, 'user_ip', 'userIp') ?? null,
    raw_payload: { ...row },
  };
}

const CAMEL_TO_SNAKE: Record<string, string> = {
  timeSlaAttendance: 'time_sla_attendance',
  timeMaxDurationCall: 'time_max_duration_call',
  timeMaxDurationCallActive: 'time_max_duration_call_active',
  timeMaxDurationCallBranch: 'time_max_duration_call_branch',
  timeMaxWaitingAttendance: 'time_max_waiting_attendance',
  timeMaxWaitingAttendanceActive: 'time_max_waiting_attendance_active',
  timeMaxWaitingAttendanceBranch: 'time_max_waiting_attendance_branch',
  timeMaxNavegationURA: 'time_max_navegation_ura',
  timeMinDurationCall: 'time_min_duration_call',
  timeMinDurationCallActive: 'time_min_duration_call_active',
  timeMinDurationCallBranch: 'time_min_duration_call_branch',
  totalData: 'total_data',
  totalCallProcessedURA: 'total_call_processed_ura',
  totalCallProcessedDialing: 'total_call_processed_dialing',
  processedDialingMap: 'processed_dialing_map',
  totalCallAttendedActive: 'total_call_attended_active',
  totalCallAttendedActiveMap: 'total_call_attended_active_map',
  totalCallAttendedBranch: 'total_call_attended_branch',
  totalCallsAttendedBranchMap: 'total_calls_attended_branch_map',
  totalAbandonedCallsBranch: 'total_abandoned_calls_branch',
  totalCallsAbandonedBranchMap: 'total_calls_abandoned_branch_map',
  totalDialingBranch: 'total_dialing_branch',
  totalTurnRefused: 'total_turn_refused',
  totalRefusedCalls: 'total_refused_calls',
  totalRefusedCallsMap: 'total_refused_calls_map',
  totalCallProcessedQueue: 'total_call_processed_queue',
  totalCallProcessedQueueMap: 'total_call_processed_queue_map',
  totalOverflowsMap: 'total_overflows_map',
  totalOverflows: 'total_overflows',
  queueOverflowsMap: 'queue_overflows_map',
  queueOverflows: 'queue_overflows',
  ivrOverflowsMap: 'ivr_overflows_map',
  ivrOverflows: 'ivr_overflows',
  sumTimeOverflows: 'sum_time_overflows',
  totalOverflowFromQueue: 'total_overflow_from_queue',
  totalCallAttendedReceptive: 'total_call_attended_receptive',
  totalCallAttendedReceptiveCallsID: 'total_call_attended_receptive_calls_id',
  totalCallback: 'total_callback',
  totalCallAbandonedQueue: 'total_call_abandoned_queue',
  totalCallAbandonedQueueCallsID: 'total_call_abandoned_queue_calls_id',
  totalCallAttended: 'total_call_attended',
  totalCallAbandonedURA: 'total_call_abandoned_ura',
  totalCallAbandonedURAMap: 'total_call_abandoned_ura_map',
  w_totalCallIVRDirectDialing: 'w_total_call_ivr_direct_dialing',
  w_totalCallIVRDirectDialingAt: 'w_total_call_ivr_direct_dialing_at',
  w_totalCallIVRDirectDialingNA: 'w_total_call_ivr_direct_dialing_na',
  totalCallIVRDirectDialingMap: 'total_call_ivr_direct_dialing_map',
  totalCallIVRDirectDialingAtMap: 'total_call_ivr_direct_dialing_at_map',
  timeSumMediumDurationActive: 'time_sum_medium_duration_active',
  timeSumMediumDurationBranch: 'time_sum_medium_duration_branch',
  timeSumMediumDurationReceptive: 'time_sum_medium_duration_receptive',
  sumTimeMediumWaintingReceptive: 'sum_time_medium_waiting_receptive',
  sumContTimeMediumWaintingReceptive: 'sum_cont_time_medium_waiting_receptive',
  timeMediumWaitingAttendance: 'time_medium_waiting_attendance',
  totalTimeMediumWaitingAttendance: 'total_time_medium_waiting_attendance',
  timeMediumWaitingAbandoned: 'time_medium_waiting_abandoned',
  totalTimeMediumWaitingAbandoned: 'total_time_medium_waiting_abandoned',
  totalAbandonedCallsActive: 'total_abandoned_calls_active',
  totalAbandonedCallsActiveMap: 'total_abandoned_calls_active_map',
  sumTimeMediumWaintingActive: 'sum_time_medium_waiting_active',
  sumContTimeMediumWaintingActive: 'sum_cont_time_medium_waiting_active',
  timeMediumWaitingAttendanceActive: 'time_medium_waiting_attendance_active',
  totalTimeMediumWaitingAttendanceActive: 'total_time_medium_waiting_attendance_active',
  timeMediumWaitingAbandonedActive: 'time_medium_waiting_abandoned_active',
  sumTimeMediumWaintingBranch: 'sum_time_medium_waiting_branch',
  sumContTimeMediumWaintingBranch: 'sum_cont_time_medium_waiting_branch',
  timeMediumWaitingAttendanceBranch: 'time_medium_waiting_attendance_branch',
  timeMediumWaitingAbandonedBranch: 'time_medium_waiting_abandoned_branch',
  monitoringMap: 'monitoring_map',
  monitoringInteractiveMap: 'monitoring_interactive_map',
  monitoringConferenceMap: 'monitoring_conference_map',
  monitoring: 'monitoring',
  monitoringInteractive: 'monitoring_interactive',
  monitoringConference: 'monitoring_conference',
  sla_attendance_calls: 'sla_attendance_calls',
  sla_abandoned: 'sla_abandoned',
  sla_abandonedMap: 'sla_abandoned_map',
  u_redirect: 'u_redirect',
  processedDialingRedirectAt: 'processed_dialing_redirect_at',
  redirect_tm: 'redirect_tm',
  redirect_tme: 'redirect_tme',
  redirect_tma: 'redirect_tma',
  totalCallsRedirect: 'total_calls_redirect',
  callsRedirectMap: 'calls_redirect_map',
  transferQueueMap: 'transfer_queue_map',
  transferUraMap: 'transfer_ura_map',
  transferActiveMap: 'transfer_active_map',
  transferBranchMap: 'transfer_branch_map',
  totalTransfer: 'total_transfer',
  u_queue_transfer: 'u_queue_transfer',
  u_ivr_transfer: 'u_ivr_transfer',
  totalBranchTransfer: 'total_branch_transfer',
  totalActiveTransfer: 'total_active_transfer',
  totalGroupedCalls: 'total_grouped_calls',
  totalGroupedCallsMap: 'total_grouped_calls_map',
  timeSumMediumNavegationURA: 'time_sum_medium_navegation_ura',
  totalTimeSumMediumNavegationURA: 'total_time_sum_medium_navegation_ura',
  reqId: 'req_id',
  uuid: 'uuid',
  sla_attendance: 'sla_attendance',
  sla_attendance_wa: 'sla_attendance_wa',
  percentageCallsAttendedActive: 'percentage_calls_attended_active',
  percentageCallsAbandonedActive: 'percentage_calls_abandoned_active',
  percentageCallsAttended: 'percentage_calls_attended',
  percentageCallsAbandoned: 'percentage_calls_abandoned',
  u_redirect_tm: 'u_redirect_tm',
  u_redirect_tme: 'u_redirect_tme',
  u_redirect_tma: 'u_redirect_tma',
  u_t_overflow_time: 'u_t_overflow_time',
  timeMediumDurationCallActive: 'time_medium_duration_call_active',
  timeMediumDurationCallBranch: 'time_medium_duration_call_branch',
  timeMediumDurationCall: 'time_medium_duration_call',
  totalTimeMediumWaitingReceptive: 'total_time_medium_waiting_receptive',
  totalTimeMediumWaitingActive: 'total_time_medium_waiting_active',
  totalTimeMediumWaitingBranch: 'total_time_medium_waiting_branch',
  timeMediumNavegationURA: 'time_medium_navegation_ura',
  requestId: 'request_id',
};

const REPORT01_NUMERIC_KEYS = new Set([
  'time_sla_attendance', 'total_data', 'total_call_processed_ura', 'total_call_processed_dialing',
  'total_call_attended_active', 'total_call_attended_branch', 'total_abandoned_calls_branch',
  'total_dialing_branch', 'total_turn_refused', 'total_refused_calls', 'total_call_processed_queue',
  'total_overflows', 'queue_overflows', 'ivr_overflows', 'sum_time_overflows', 'total_overflow_from_queue',
  'total_call_attended_receptive', 'total_callback', 'total_call_abandoned_queue', 'total_call_attended',
  'total_call_abandoned_ura', 'w_total_call_ivr_direct_dialing', 'w_total_call_ivr_direct_dialing_at',
  'w_total_call_ivr_direct_dialing_na', 'time_sum_medium_duration_active', 'time_sum_medium_duration_branch',
  'time_sum_medium_duration_receptive', 'sum_time_medium_waiting_receptive', 'sum_cont_time_medium_waiting_receptive',
  'total_time_medium_waiting_attendance', 'total_time_medium_waiting_abandoned', 'total_abandoned_calls_active',
  'sum_time_medium_waiting_active', 'sum_cont_time_medium_waiting_active', 'total_time_medium_waiting_attendance_active',
  'sum_time_medium_waiting_branch', 'sum_cont_time_medium_waiting_branch', 'monitoring', 'monitoring_interactive',
  'monitoring_conference', 'sla_attendance_calls', 'sla_abandoned', 'u_redirect', 'processed_dialing_redirect_at',
  'redirect_tm', 'redirect_tme', 'redirect_tma', 'total_calls_redirect', 'total_transfer', 'u_queue_transfer',
  'u_ivr_transfer', 'total_branch_transfer', 'total_active_transfer', 'total_grouped_calls',
  'time_sum_medium_navegation_ura', 'total_time_sum_medium_navegation_ura',
]);

const REPORT01_JSONB_KEYS = new Set([
  'processed_dialing_map', 'total_call_attended_active_map', 'total_calls_attended_branch_map',
  'total_calls_abandoned_branch_map', 'total_refused_calls_map', 'total_call_processed_queue_map',
  'total_overflows_map', 'queue_overflows_map', 'ivr_overflows_map', 'total_call_attended_receptive_calls_id',
  'total_call_abandoned_queue_calls_id', 'total_call_abandoned_ura_map', 'total_call_ivr_direct_dialing_map',
  'total_call_ivr_direct_dialing_at_map', 'total_abandoned_calls_active_map', 'sla_abandoned_map',
  'monitoring_map', 'monitoring_interactive_map', 'monitoring_conference_map', 'calls_redirect_map',
  'transfer_queue_map', 'transfer_ura_map', 'transfer_active_map', 'transfer_branch_map', 'total_grouped_calls_map',
]);

/** Mapeia resposta report_01 para report_01_raw (espelho completo) */
export function mapToReport01Raw(data: unknown, dateStr: string, queueExternalId: string): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  let obj = data as Record<string, unknown>;
  if (Object.keys(obj).length === 1) {
    const firstVal = Object.values(obj)[0];
    if (firstVal && typeof firstVal === 'object' && !Array.isArray(firstVal)) {
      obj = firstVal as Record<string, unknown>;
    }
  }

  const result: Record<string, unknown> = {
    date: dateStr,
    queue_external_id: queueExternalId,
    raw_payload: { ...obj },
  };

  for (const [camelKey, snakeKey] of Object.entries(CAMEL_TO_SNAKE)) {
    const val = obj[camelKey];
    if (val === undefined || val === null) continue;
    if (REPORT01_JSONB_KEYS.has(snakeKey)) {
      result[snakeKey] = val;
    } else if (REPORT01_NUMERIC_KEYS.has(snakeKey)) {
      const n = typeof val === 'number' ? val : typeof val === 'string' ? parseInt(String(val), 10) : null;
      if (n !== null && !Number.isNaN(n)) result[snakeKey] = n;
    } else if (typeof val !== 'object' || !Array.isArray(val)) {
      result[snakeKey] = typeof val === 'string' ? val : val != null ? String(val) : null;
    }
  }
  return result;
}
