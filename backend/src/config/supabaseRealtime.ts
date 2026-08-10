/**
 * supabaseRealtime v1.0.0 — cliente Supabase WFM para telefonia 55PBX (lazy init)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let clientInstance: SupabaseClient | null = null;

export function isRealtimeSupabaseConfigured(): boolean {
  return Boolean(env.realtimeSupabaseUrl && env.realtimeSupabaseServiceRoleKey);
}

/** Cliente service-role do projeto WFM — só para módulo Realtime / 55PBX. */
export function getRealtimeSupabaseClient(): SupabaseClient {
  if (!isRealtimeSupabaseConfigured()) {
    throw new Error(
      'Realtime Supabase não configurado. Defina REALTIME_SUPABASE_URL e REALTIME_SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  if (!clientInstance) {
    clientInstance = createClient(
      env.realtimeSupabaseUrl,
      env.realtimeSupabaseServiceRoleKey,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
  }
  return clientInstance;
}

export type RealtimeSupabaseClient = SupabaseClient;
