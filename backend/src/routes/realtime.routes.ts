/** realtime.routes v1.0.0 — dashboard operacional Realtime (Gestão) */
import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';
import { isRealtimeSupabaseConfigured } from '../config/supabaseRealtime';
import { getBrasiliaDateString } from '../services/realtime/dates/brasilDay';
import { runChamadoIaAnaliseNow } from '../jobs/chamadoIaAnalise.job';
import { loadRealtimeDashboard } from '../services/realtime/loadRealtimeDashboard.service';
import { getTelephonyRepository } from '../services/realtime/repository/getTelephonyRepository';
import { getLiveCallsInProgress } from '../services/realtime/telao/metrics';
import { runSync55Telecom, runSync55TelecomEventsOnly } from '../services/realtime/telecom55/sync-runner';

const router = Router();

function requireSupervisorInProduction(req: Request, res: Response, next: NextFunction) {
  const role = String(req.user?.role ?? '').trim().toLowerCase();
  if (role !== 'supervisor' && env.nodeEnv === 'production') {
    return res.status(403).json({ message: 'Acesso restrito a supervisores' });
  }
  next();
}

function requireRealtimeEnabled(_req: Request, res: Response, next: NextFunction) {
  if (!env.realtimeEnabled) {
    return res.status(503).json({ message: 'Módulo Realtime desabilitado' });
  }
  next();
}

router.use(authMiddleware, requireSupervisorInProduction, requireRealtimeEnabled);

router.get('/health', (_req, res: Response) => {
  res.json({
    status: 'ok',
    enabled: env.realtimeEnabled,
    telephonyProvider: env.realtimeTelephonyProvider,
    supabaseConfigured: isRealtimeSupabaseConfigured(),
    telecom55ApiConfigured: Boolean(env.telecom55ApiKey),
  });
});

router.get('/dashboard', async (_req, res: Response) => {
  try {
    const data = await loadRealtimeDashboard();
    return res.json(data);
  } catch (err) {
    console.error('[realtime] GET /dashboard falhou:', err);
    return res.status(500).json({ message: 'Erro ao carregar dashboard Realtime' });
  }
});

router.post('/ia/refresh', async (_req, res: Response) => {
  try {
    const result = await runChamadoIaAnaliseNow();
    if (result.skipped) {
      return res.json({
        ok: !result.error,
        skipped: true,
        reason: result.error ?? 'Ciclo de análise IA já em execução — aguarde terminar.',
      });
    }
    return res.json({ ...result, ok: result.success });
  } catch (err) {
    console.error('[realtime] POST /ia/refresh falhou:', err);
    return res.status(500).json({ message: 'Erro ao atualizar análise IA' });
  }
});

router.get('/live-calls', async (_req, res: Response) => {
  if (!isRealtimeSupabaseConfigured()) {
    return res.status(503).json({ message: 'Supabase Realtime não configurado' });
  }
  try {
    const todayStr = getBrasiliaDateString();
    const supabase = getTelephonyRepository();
    const liveCalls = await getLiveCallsInProgress(supabase, todayStr);
    return res.json({ todayStr, liveCalls });
  } catch (err) {
    console.error('[realtime] GET /live-calls falhou:', err);
    return res.status(500).json({ message: 'Erro ao carregar chamadas ao vivo' });
  }
});

const SYNC_CALLS_TYPE = 'telecom55_calls_realtime';
const SYNC_CALLS_LOCK_SECONDS = 600;
const SYNC_EVENTS_TYPE = 'telecom55_events_realtime';
const SYNC_EVENTS_LOCK_SECONDS = 55;
const SYNC_EVENTS_WINDOW_MINUTES = 3;

function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

async function hasRecentSync(syncType: string, lockSeconds: number): Promise<{ skipped: boolean; recentSync?: unknown }> {
  const supabase = getTelephonyRepository();
  const lockSince = new Date(Date.now() - lockSeconds * 1000).toISOString();
  const { data: recentSync, error } = await supabase
    .from('sync_logs')
    .select('id, status, started_at, finished_at, metadata')
    .eq('sync_type', syncType)
    .gte('started_at', lockSince)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (recentSync) {
    return { skipped: true, recentSync };
  }
  return { skipped: false };
}

router.post('/sync/calls', async (_req, res: Response) => {
  if (!isRealtimeSupabaseConfigured()) {
    return res.status(503).json({ message: 'Supabase Realtime não configurado' });
  }
  if (!env.telecom55ApiKey) {
    return res.status(503).json({ message: 'TELECOM55_API_KEY não configurada' });
  }

  try {
    const lock = await hasRecentSync(SYNC_CALLS_TYPE, SYNC_CALLS_LOCK_SECONDS);
    if (lock.skipped) {
      return res.json({
        ok: true,
        skipped: true,
        reason: 'Sincronização de chamadas 55 já executada recentemente.',
        recentSync: lock.recentSync,
      });
    }

    const hojeStr = getBrasiliaDateString();
    const result = await runSync55Telecom(hojeStr, hojeStr, {
      syncType: SYNC_CALLS_TYPE,
      skipRevalidate: true,
    });

    return res.status(result.success ? 200 : 500).json({
      ok: result.success,
      skipped: false,
      date: hojeStr,
      result,
    });
  } catch (err) {
    console.error('[realtime] POST /sync/calls falhou:', err);
    return res.status(500).json({ message: (err as Error).message });
  }
});

router.post('/sync/events', async (_req, res: Response) => {
  if (!isRealtimeSupabaseConfigured()) {
    return res.status(503).json({ message: 'Supabase Realtime não configurado' });
  }
  if (!env.telecom55ApiKey) {
    return res.status(503).json({ message: 'TELECOM55_API_KEY não configurada' });
  }

  try {
    const lock = await hasRecentSync(SYNC_EVENTS_TYPE, SYNC_EVENTS_LOCK_SECONDS);
    if (lock.skipped) {
      return res.json({
        ok: true,
        skipped: true,
        reason: 'Sincronização de eventos 55 já executada recentemente.',
        recentSync: lock.recentSync,
      });
    }

    const dateStart = minutesAgoIso(SYNC_EVENTS_WINDOW_MINUTES);
    const dateEnd = new Date(Date.now() + 15 * 1000).toISOString();
    const result = await runSync55TelecomEventsOnly(dateStart, dateEnd, {
      syncType: SYNC_EVENTS_TYPE,
      skipRevalidate: true,
      exactDateTime: true,
    });

    return res.status(result.success ? 200 : 500).json({
      ok: result.success,
      skipped: false,
      dateStart,
      dateEnd,
      windowMinutes: SYNC_EVENTS_WINDOW_MINUTES,
      result,
    });
  } catch (err) {
    console.error('[realtime] POST /sync/events falhou:', err);
    return res.status(500).json({ message: (err as Error).message });
  }
});

export default router;
