/** resolveAtlasUri v1.0.0 — converte mongodb+srv usando DNS público (Windows SRV local) */
import { Resolver } from 'dns/promises';

const PUBLIC_DNS = ['8.8.8.8', '1.1.1.1'];
const SRV_TIMEOUT_MS = 12000;

export function maskMongoUri(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
}

function parseSrvUri(srvUri: string) {
  const match = srvUri.match(/^mongodb\+srv:\/\/([^/]+)@([^/?]+)(?:\?(.*))?$/);
  if (!match) throw new Error('MONGODB_URI mongodb+srv inválida');
  const [, credentials, hostname, query = ''] = match;
  return { credentials, hostname, params: new URLSearchParams(query) };
}

function mergeTxtParams(params: URLSearchParams, txtChunks: string[][]) {
  const txt = txtChunks.map((chunk) => chunk.join('')).join('');
  txt.split('&').forEach((pair) => {
    const [key, value] = pair.split('=');
    if (key && value && !params.has(key)) params.set(key, value);
  });
}

export async function resolveAtlasSrvUri(
  srvUri: string
): Promise<{ uri: string; method: 'direct' | 'srv-resolved' }> {
  if (!srvUri.startsWith('mongodb+srv://')) {
    return { uri: srvUri, method: 'direct' };
  }

  const { credentials, hostname, params } = parseSrvUri(srvUri);
  const resolver = new Resolver();
  resolver.setServers(PUBLIC_DNS);

  const withTimeout = <T>(promise: Promise<T>, label: string): Promise<T> =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timeout (${SRV_TIMEOUT_MS}ms)`)), SRV_TIMEOUT_MS)
      ),
    ]);

  const srvRecords = await withTimeout(
    resolver.resolveSrv(`_mongodb._tcp.${hostname}`),
    'SRV'
  );

  let txtRecords: string[][] = [];
  try {
    txtRecords = await withTimeout(resolver.resolveTxt(hostname), 'TXT');
  } catch {
    /* TXT opcional */
  }

  mergeTxtParams(params, txtRecords);
  if (!params.has('ssl')) params.set('ssl', 'true');

  const hosts = srvRecords.map((record) => `${record.name}:${record.port}`).join(',');
  const standardUri = `mongodb://${credentials}@${hosts}/?${params.toString()}`;

  console.log(`[env] Atlas SRV resolvido via DNS público → ${maskMongoUri(standardUri)}`);
  return { uri: standardUri, method: 'srv-resolved' };
}
