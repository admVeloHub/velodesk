import { env } from '../../../config/env';
import { getRealtimeSupabaseClient, type RealtimeSupabaseClient } from '../../../config/supabaseRealtime';

/** Retorna cliente Supabase WFM enquanto REALTIME_TELEPHONY_PROVIDER=supabase. */
export function getTelephonyRepository(): RealtimeSupabaseClient {
  if (env.realtimeTelephonyProvider !== 'supabase') {
    throw new Error(
      `Provider de telefonia "${env.realtimeTelephonyProvider}" ainda não implementado. Use supabase.`,
    );
  }
  return getRealtimeSupabaseClient();
}
