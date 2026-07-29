/** Remove URLs de gravação e campos sensíveis antes de persistir rawPayload */

const STRIP_KEYS = new Set([
  'recording_download_url',
  'authorization',
  'Authorization',
]);

function stripRecordingUrls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripRecordingUrls(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(input)) {
    if (STRIP_KEYS.has(key)) continue;
    output[key] = stripRecordingUrls(child);
  }
  return output;
}

export function sanitizeTelephonyRawPayload(body: Record<string, unknown>): Record<string, unknown> {
  return stripRecordingUrls(body) as Record<string, unknown>;
}
