/**
 * Cliente API 55Telecom - Reports
 * Documentação: https://reportapi02.55pbx.com:50500/api/pbx/reports/metrics/
 *
 * Filtros na URL: date_start/date_end/queue/number/agent/report/quiz_id/timezone
 */

const BASE_PATH = '/api/pbx/reports/metrics';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function saoPauloDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

/** Formato de data com GMT offset exigido pela API (ex: Tue Feb 10 2026 00:00:00 GMT-0300) */
export function formatDateForApi(date: Date, endOfDay = false, exactTime = false): string {
  if (exactTime) {
    const parts = saoPauloDateParts(date);
    return `${parts.weekday} ${parts.month} ${Number(parts.day)} ${parts.year} ${parts.hour}:${parts.minute}:${parts.second} GMT-0300`;
  }

  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const wd = WEEKDAYS[new Date(year, month, day).getDay()];
  const mon = MONTHS[month];
  const time = endOfDay ? '23:59:59' : '00:00:00';
  return `${wd} ${mon} ${day} ${year} ${time} GMT-0300`;
}

export interface Telecom55ReportParams {
  dateStart: Date;
  dateEnd: Date;
  queue: string; // queue_id ou "all_queues"
  number: string; // DDI+DDD+Number ou "all_numbers"
  agent: string; // agent_id ou "all_agent"
  report: 'report_01' | 'report_02' | 'report_03' | 'report_04';
  quizId?: string; // "undefined" se não usar
  timezone?: number; // -12 a 12, padrão -3 (Brasil)
  exactDateTime?: boolean; // usa HH:mm:ss real em vez de dia inteiro
}

export function buildReportUrl(params: Telecom55ReportParams): string {
  const {
    dateStart,
    dateEnd,
    queue,
    number,
    agent,
    report,
    quizId = 'undefined',
    timezone = -3,
    exactDateTime = false,
  } = params;

  const dateStartStr = encodeURIComponent(formatDateForApi(dateStart, false, exactDateTime));
  const dateEndStr = encodeURIComponent(formatDateForApi(dateEnd, true, exactDateTime));

  return `${BASE_PATH}/${dateStartStr}/${dateEndStr}/${queue}/${number}/${agent}/${report}/${quizId}/${timezone}`;
}

export async function fetchReport<T = unknown>(
  params: Telecom55ReportParams
): Promise<T> {
  const baseUrl = process.env.TELECOM55_API_URL?.replace(/\/$/, '') || 'https://reportapi02.55pbx.com:50500';
  const apiKey = process.env.TELECOM55_API_KEY;

  if (!apiKey) {
    const envHint = process.env.NODE_ENV === 'production'
      ? 'Configure TELECOM55_API_KEY nas Environment Variables da Vercel'
      : 'Defina TELECOM55_API_KEY em .env.local';
    throw new Error(`TELECOM55_API_KEY não configurada. ${envHint}`);
  }

  const path = buildReportUrl(params);
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      key: apiKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`55Telecom API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data as T;
}
