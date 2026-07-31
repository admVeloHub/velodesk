/**
 * customerDataApi.service v1.0.0 — proxy Velotax Customer Data API (envelope v1)
 * VERSION: v1.0.0 | DATE: 2026-07-30
 */
import { env } from '../config/env';
import {
  CONSULTA_PRODUCT_SLUGS,
  getProductApiPath,
  listPendingExpandSlugs,
  shouldPrefetchProduct,
  type ConsultaProductSlug,
} from './consultaProductMap';
import type { ResolvedConsultaContext } from './consultaCpfResolver.service';

export interface CustomerDataLlmGuidance {
  outcome?: string;
  nextAction?: string;
  retryable?: boolean;
  speak?: string;
  instruction?: string;
  recommendedOperation?: string | null;
  retryAfterSeconds?: number | null;
}

export interface CustomerDataEnvelope<T = unknown> {
  schemaVersion: string;
  ok: boolean;
  status: string;
  data: T | null;
  error?: {
    code?: string;
    message?: string;
    field?: string | null;
  };
  context?: Record<string, unknown>;
  meta?: {
    requestId?: string;
    deduped?: boolean;
  };
  llmGuidance?: CustomerDataLlmGuidance;
}

export interface ConsultaSnapshotResult {
  status: string;
  ok: boolean;
  data: unknown;
  requestId: string;
}

export interface ConsultaProductEntry extends ConsultaSnapshotResult {
  loaded: boolean;
}

export interface Consulta360Response {
  cpfFormatted: string;
  protocolo: string;
  ticketProduct: string | null;
  ticketProductSlug: ConsultaProductSlug | null;
  overview: ConsultaSnapshotResult | null;
  products: Partial<Record<ConsultaProductSlug, ConsultaProductEntry>>;
  pendingExpand: ConsultaProductSlug[];
  errors: Array<{ slug?: ConsultaProductSlug; code: string; message: string; requestId?: string }>;
}

function maskCpfForLog(cpf: string): string {
  const digits = String(cpf || '').replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
}

export function isCustomerDataApiConfigured(): boolean {
  return Boolean(env.customerDataApiKey);
}

function buildRequestId(protocolo: string, suffix: string): string {
  const safeProto = String(protocolo || 'ticket').replace(/[^\w-]/g, '').slice(0, 24);
  return `req_desk_${safeProto}_${suffix}_${Date.now().toString(36)}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCustomerData<T>(
  path: string,
  cpf: string,
  requestId: string,
  attempt = 0,
): Promise<{ httpStatus: number; envelope: CustomerDataEnvelope<T> }> {
  const url = `${env.customerDataBaseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.customerDataTimeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.customerDataApiKey,
        'x-request-id': requestId,
      },
      body: JSON.stringify({
        cpf,
        cpfSource: 'trusted_context',
      }),
      signal: controller.signal,
    });

    const envelope = (await response.json()) as CustomerDataEnvelope<T>;
    const requestIdOut = envelope.meta?.requestId || requestId;

    console.log(
      `[customerDataApi] ${path} http=${response.status} status=${envelope.status} `
      + `cpf=${maskCpfForLog(cpf)} requestId=${requestIdOut}`,
    );

    if (response.status === 503 && attempt < 1) {
      const retryAfter = envelope.llmGuidance?.retryAfterSeconds ?? 2;
      await sleep(Math.max(0, retryAfter) * 1000);
      return fetchCustomerData(path, cpf, requestId, attempt + 1);
    }

    return { httpStatus: response.status, envelope };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('abort')) {
      throw new Error(`Consulta expirou após ${env.customerDataTimeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function checkHealthFetch(): Promise<{ status: string }> {
  const url = `${env.customerDataBaseUrl}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(env.customerDataTimeoutMs, 10000));

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return { status: 'Down' };
    }
    const body = (await response.json()) as { status?: string };
    return { status: body.status || 'Unknown' };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkCustomerDataHealth(): Promise<{
  configured: boolean;
  upstreamStatus: string;
  baseUrl: string;
}> {
  if (!isCustomerDataApiConfigured()) {
    return {
      configured: false,
      upstreamStatus: 'NotConfigured',
      baseUrl: env.customerDataBaseUrl,
    };
  }

  try {
    const health = await checkHealthFetch();
    return {
      configured: true,
      upstreamStatus: health.status,
      baseUrl: env.customerDataBaseUrl,
    };
  } catch {
    return {
      configured: true,
      upstreamStatus: 'Unreachable',
      baseUrl: env.customerDataBaseUrl,
    };
  }
}

function snapshotFromEnvelope(envelope: CustomerDataEnvelope): ConsultaSnapshotResult {
  return {
    status: envelope.status,
    ok: envelope.ok,
    data: envelope.data,
    requestId: envelope.meta?.requestId || '',
  };
}

export async function fetchOverview(
  cpf: string,
  protocolo: string,
): Promise<ConsultaSnapshotResult> {
  const requestId = buildRequestId(protocolo, 'overview');
  const { httpStatus, envelope } = await fetchCustomerData<Record<string, unknown>>(
    '/v1/customer/overview',
    cpf,
    requestId,
  );

  if (httpStatus === 401) {
    throw new Error('Integração de consulta indisponível (autenticação). Contate o suporte.');
  }

  return snapshotFromEnvelope(envelope);
}

export async function fetchProductSnapshot(
  slug: ConsultaProductSlug,
  cpf: string,
  protocolo: string,
): Promise<ConsultaSnapshotResult> {
  const requestId = buildRequestId(protocolo, slug.replace(/-/g, '_'));
  const path = getProductApiPath(slug);
  const { httpStatus, envelope } = await fetchCustomerData<Record<string, unknown>>(
    path,
    cpf,
    requestId,
  );

  if (httpStatus === 401) {
    throw new Error('Integração de consulta indisponível (autenticação). Contate o suporte.');
  }

  return snapshotFromEnvelope(envelope);
}

export async function fetchConsulta360(ctx: ResolvedConsultaContext): Promise<Consulta360Response> {
  const products: Partial<Record<ConsultaProductSlug, ConsultaProductEntry>> = {};
  const errors: Consulta360Response['errors'] = [];
  const prefetched = new Set<ConsultaProductSlug>();

  let overview: ConsultaSnapshotResult | null = null;

  try {
    overview = await fetchOverview(ctx.cpf, ctx.protocolo);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push({ code: 'overview_failed', message });
    return {
      cpfFormatted: ctx.cpfFormatted,
      protocolo: ctx.protocolo,
      ticketProduct: ctx.ticketProductLabel || null,
      ticketProductSlug: ctx.ticketProductSlug,
      overview: null,
      products,
      pendingExpand: [...CONSULTA_PRODUCT_SLUGS],
      errors,
    };
  }

  const overviewProducts = (overview.data as { products?: Record<string, boolean> } | null)?.products;

  const slugsToPrefetch = CONSULTA_PRODUCT_SLUGS.filter((slug) =>
    shouldPrefetchProduct(slug, overviewProducts, ctx.ticketProductSlug),
  );

  await Promise.all(
    slugsToPrefetch.map(async (slug) => {
      try {
        const snapshot = await fetchProductSnapshot(slug, ctx.cpf, ctx.protocolo);
        products[slug] = { ...snapshot, loaded: true };
        prefetched.add(slug);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({
          slug,
          code: 'product_failed',
          message,
          requestId: products[slug]?.requestId,
        });
      }
    }),
  );

  return {
    cpfFormatted: ctx.cpfFormatted,
    protocolo: ctx.protocolo,
    ticketProduct: ctx.ticketProductLabel || null,
    ticketProductSlug: ctx.ticketProductSlug,
    overview,
    products,
    pendingExpand: listPendingExpandSlugs(prefetched),
    errors,
  };
}
