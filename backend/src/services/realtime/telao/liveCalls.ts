export type LiveCallInProgress = {
  callId: string;
  agentLabel: string;
  queueLabel: string;
  answeredAtIso: string;
  durationSec: number;
};

export function formatCallDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
