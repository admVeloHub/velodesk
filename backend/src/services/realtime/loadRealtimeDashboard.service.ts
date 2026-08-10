/**
 * loadRealtimeDashboard — orquestra telefonia (Supabase WFM) + tickets/IA (Mongo Velodesk).
 */
import { isMongoConnected } from '../../config/database';
import { isRealtimeSupabaseConfigured } from '../../config/supabaseRealtime';
import { getBrasiliaDateString } from './dates/brasilDay';
import { getIaResumoDia, type AnaliseIaResumoDia } from './iaResumo.service';
import { getTicketMetricsForDay } from './ticketMetrics.service';
import { getTelephonyRepository } from './repository/getTelephonyRepository';
import {
  getAdherenceMetrics,
  getLiveCallsInProgress,
  getTelephonyMetrics,
  type AdherenceMetrics,
  type LiveCallInProgress,
  type TelephonyMetrics,
  type TicketMetrics,
} from './telao/metrics';
import { getWebhookHealthSummary, type WebhookHealthSummary } from './telao/webhookHealth';

export type RealtimeDashboardData = {
  todayStr: string;
  dateLabel: string;
  telephony: TelephonyMetrics | null;
  telephonyUnavailable: boolean;
  tickets: TicketMetrics | null;
  ticketsUnavailable: boolean;
  adherence: AdherenceMetrics | null;
  adherenceUnavailable: boolean;
  liveCalls: LiveCallInProgress[];
  analiseIa: AnaliseIaResumoDia;
  webhookHealth: WebhookHealthSummary | null;
  webhookHealthUnavailable: boolean;
};

const EMPTY_IA: AnaliseIaResumoDia = {
  ticketsDoDia: 0,
  candidatosComTexto: 0,
  baseClassificada: 0,
  motivos: [],
  motivosTickets: [],
  motivosLeticia: [],
  motivosGeral: [],
  telefoneHumanoComNota: 0,
  telefoneHumanoTotal: 0,
  ligacoesLeticiaDoDia: 0,
  ligacoesLeticiaClassificadas: 0,
  ultimaAtualizacaoIa: null,
};

export async function loadRealtimeDashboard(): Promise<RealtimeDashboardData> {
  const todayStr = getBrasiliaDateString();
  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${todayStr}T12:00:00-03:00`));

  const supabaseReady = isRealtimeSupabaseConfigured();
  const mongoReady = isMongoConnected();

  const supabase = supabaseReady ? getTelephonyRepository() : null;

  const telephonyPromise = supabase
    ? getTelephonyMetrics(supabase, todayStr)
    : Promise.resolve(null);

  const adherencePromise = supabase
    ? getAdherenceMetrics(supabase, todayStr)
    : Promise.resolve(null);

  const liveCallsPromise = supabase
    ? getLiveCallsInProgress(supabase, todayStr)
    : Promise.resolve([] as LiveCallInProgress[]);

  const webhookHealthPromise = supabase
    ? getWebhookHealthSummary(supabase, todayStr)
    : Promise.resolve(null);

  const ticketsPromise = mongoReady ? getTicketMetricsForDay(todayStr) : Promise.resolve(null);

  const analiseIaPromise = mongoReady
    ? getIaResumoDia(todayStr).catch((err) => {
        console.error('[loadRealtimeDashboard] Falha ao carregar resumo IA:', err);
        return EMPTY_IA;
      })
    : Promise.resolve(EMPTY_IA);

  const [telephony, tickets, adherence, liveCalls, analiseIa, webhookHealth] = await Promise.all([
    telephonyPromise,
    ticketsPromise,
    adherencePromise,
    liveCallsPromise,
    analiseIaPromise,
    webhookHealthPromise,
  ]);

  return {
    todayStr,
    dateLabel,
    telephony,
    telephonyUnavailable: !supabaseReady,
    tickets,
    ticketsUnavailable: !mongoReady,
    adherence,
    adherenceUnavailable: !supabaseReady,
    liveCalls,
    analiseIa,
    webhookHealth,
    webhookHealthUnavailable: !supabaseReady,
  };
}
