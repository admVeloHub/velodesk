/** telephony.service v1.1.0 — listagem interna de ligações e KPIs */
import mongoose from 'mongoose';
import { env } from '../config/env';
import { TelephonyCall, ITelephonyCall } from '../models/TelephonyCall';
import { loadDadosForRef } from './cliente.service';
import { resolvePeriodRange } from './gestaoInsights.service';

export interface TelephonyCallsQuery {
  period?: string;
  from?: string;
  to?: string;
  phone?: string;
  cpf?: string;
  q?: string;
  status?: string;
  direction?: string;
  agent?: string;
  converted?: string;
  page?: number;
  limit?: number;
}

function normalizeCpf(value?: string): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 11);
}

function normalizePhone(value?: string): string {
  return String(value ?? '').replace(/\D/g, '');
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function buildDateFilter(query: TelephonyCallsQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  const range = resolvePeriodRange({
    period: query.period,
    from: query.from,
    to: query.to,
  });
  filter.endedAt = { $gte: range.start, $lte: range.end };
  const phone = normalizePhone(query.phone);
  if (phone) filter.clientPhone = { $regex: phone };
  const cpf = normalizeCpf(query.cpf);
  if (cpf) filter.clientCpf = cpf;
  const status = String(query.status ?? '').trim();
  if (status) filter.status = status;
  const direction = String(query.direction ?? '').trim();
  if (direction) filter.direction = direction;
  const agent = String(query.agent ?? '').trim();
  if (agent) filter.agentName = { $regex: agent, $options: 'i' };
  if (query.converted === 'true') filter.isConverted = true;
  if (query.converted === 'false') filter.isConverted = false;
  const q = String(query.q ?? '').trim();
  if (q) {
    filter.$or = [
      { summary: { $regex: q, $options: 'i' } },
      { transcript: { $regex: q, $options: 'i' } },
      { clientName: { $regex: q, $options: 'i' } },
      { agentName: { $regex: q, $options: 'i' } },
    ];
  }
  return filter;
}

function formatTransfer(doc: ITelephonyCall) {
  if (!doc.transfer) return null;
  return {
    destinationType: doc.transfer.destinationType ?? null,
    destinationValue: doc.transfer.destinationValue ?? null,
    targetUserName: doc.transfer.targetUserName ?? null,
    targetUserExtension: doc.transfer.targetUserExtension ?? null,
    waitMs: doc.transfer.waitMs ?? null,
    answeredByName: doc.transfer.answeredByName ?? null,
    answeredAt: doc.transfer.answeredAt?.toISOString() ?? null,
  };
}

function callListItem(doc: ITelephonyCall) {
  return {
    id: String(doc._id),
    externalCallId: doc.externalCallId,
    provider: doc.provider,
    direction: doc.direction ?? null,
    callType: doc.callType ?? null,
    status: doc.status ?? null,
    agentName: doc.agentName ?? null,
    isConverted: doc.isConverted ?? null,
    startedAt: doc.startedAt?.toISOString() ?? null,
    endedAt: doc.endedAt?.toISOString() ?? null,
    durationSeconds: doc.durationSeconds ?? null,
    clientPhone: doc.clientPhone,
    clientCpf: doc.clientCpf,
    clientName: doc.clientName,
    summary: doc.summary,
    sentiment: doc.sentiment ?? null,
    ticketStatus: doc.ticketStatus,
    hasCliente: Boolean(doc.clienteId),
    hasTransfer: Boolean(doc.transfer?.destinationType || doc.transfer?.answeredByName),
  };
}

export async function listTelephonyCalls(query: TelephonyCallsQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 25));
  const filter = buildDateFilter(query);
  const [rows, total] = await Promise.all([
    TelephonyCall.find(filter).sort({ endedAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    TelephonyCall.countDocuments(filter),
  ]);
  return {
    items: rows.map((row) => callListItem(row as unknown as ITelephonyCall)),
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getTelephonyCallDetail(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const doc = await TelephonyCall.findById(id).lean();
  if (!doc) return null;
  let cliente = null;
  if (doc.clienteId) {
    cliente = await loadDadosForRef({ clienteId: doc.clienteId, clienteCpf: doc.clientCpf });
  }
  const typed = doc as unknown as ITelephonyCall;
  return {
    ...callListItem(typed),
    canonicalUrl: typed.canonicalUrl ?? null,
    origin: typed.origin ?? null,
    initiatedAt: typed.initiatedAt?.toISOString() ?? null,
    answeredAt: typed.answeredAt?.toISOString() ?? null,
    ringDuration: typed.ringDuration ?? null,
    isOptout: typed.isOptout ?? null,
    isMismatch: typed.isMismatch ?? null,
    terminationOrigin: typed.terminationOrigin ?? null,
    agentId: typed.agentId ?? null,
    campaignId: typed.campaignId ?? null,
    campaignName: typed.campaignName ?? null,
    variables: typed.variables ?? {},
    dataCollected: typed.dataCollected ?? {},
    transcript: typed.transcript,
    transcriptFull: typed.transcriptFull ?? [],
    transfer: formatTransfer(typed),
    outcome: typed.outcome ?? null,
    intent: typed.intent ?? null,
    rawPayload: typed.rawPayload ?? {},
    chamadoId: typed.chamadoId ? String(typed.chamadoId) : null,
    cliente: cliente ? {
      nome: cliente.clienteNome,
      cpf: cliente.clienteCpf,
      emails: cliente.clienteEmail?.lista ?? [],
      telefones: cliente.clienteTelefone?.lista ?? [],
    } : null,
  };
}

export async function getTelephonyCallsStats(query: TelephonyCallsQuery = {}) {
  const filter = buildDateFilter(query);
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const [total, withCpf, today, converted] = await Promise.all([
    TelephonyCall.countDocuments(filter),
    TelephonyCall.countDocuments({ ...filter, clientCpf: { $ne: '' } }),
    TelephonyCall.countDocuments({
      ...filter,
      endedAt: { $gte: todayStart, $lte: todayEnd },
    }),
    TelephonyCall.countDocuments({ ...filter, isConverted: true }),
  ]);
  return { total, withCpf, today, converted };
}

export function getTelephonyIntegrationInfo(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    enabled: env.inboundTelephonyEnabled,
    provider: 'contact-tel',
    inboundCallsUrl: `${base}/api/inbound/telephony/calls`,
    inboundRecadosUrl: `${base}/api/inbound/telephony/recados`,
    inboundHealthUrl: `${base}/api/inbound/telephony/health`,
    authHeader: 'X-Inbound-Secret',
    autoCreateTicket: env.telephonyAutoCreateTicket,
    note: 'O Velodesk recebe o payload completo via POST. Não consulta GET /public/v1/calls/{id}/ da Contact Tel.',
  };
}
