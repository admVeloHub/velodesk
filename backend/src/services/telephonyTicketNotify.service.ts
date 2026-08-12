/**
 * telephonyTicketNotify.service v1.0.0 — ticket Desk + CTA no sininho para agente da ligação
 * VERSION: v1.0.0 | DATE: 2026-08-12
 */
import { Types } from 'mongoose';
import { User } from '../models/User';
import { ChamadoN1 } from '../models/ChamadoN1';
import { createChamadoFromBody } from './chamado.mapper';
import { createWorkflowNotificacao } from './workflowNotificacao.service';
import type { TelephonyCallInput } from './telephony-inbound/types';
import type { ITelephonyCall } from '../models/TelephonyCall';

/** Sentinel de workflow para CTAs de telefonia (sem workflow real). */
export const TELEPHONY_NOTIF_WORKFLOW_ID = new Types.ObjectId('00000000000000000000aa01');

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

async function resolveAgentEmail(agentId?: string, agentName?: string): Promise<{
  email: string;
  displayName: string;
} | null> {
  const id = String(agentId ?? '').trim();
  const name = String(agentName ?? '').trim();
  if (!id && !name) return null;

  const or: Record<string, unknown>[] = [];
  if (id.includes('@')) or.push({ email: id.toLowerCase() });
  if (name) {
    or.push({ name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
  }
  if (id && !id.includes('@')) {
    or.push({ email: new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
  }

  const user = await User.findOne({ $or: or }).select('email name').lean();
  if (!user?.email) {
    console.info('[telephony-ticket] agente não resolvido no cadastro User', { agentId, agentName });
    return null;
  }
  return {
    email: String(user.email).trim().toLowerCase(),
    displayName: String(user.name || name || user.email).trim(),
  };
}

export async function createTicketAndNotifyFromTelephonyCall(
  call: ITelephonyCall,
  input: TelephonyCallInput,
): Promise<{ ticketId: string; protocolo: string; notified: boolean } | null> {
  const agent = await resolveAgentEmail(input.agentId, input.agentName);
  if (!agent) return null;

  const clientName = String(input.clientName || '').trim() || 'Cliente telefonia';
  const summary = String(input.summary || input.transcript || '').trim()
    || `Ligação recebida (${input.status || 'telefonia'}).`;
  const title = `Ligação telefônica — ${clientName}`;

  const partial = await createChamadoFromBody({
    title,
    chamadoTitulo: title,
    text: summary,
    clientName,
    clientCPF: input.clientCpf || undefined,
    clientPhone: input.clientPhone || undefined,
    author: agent.displayName,
    source: 'telephony-inbound',
    channel: 'telefone',
    lateralForm: {
      canal: 'Telefone',
      responsavel: agent.displayName,
      tipo: 'Solicitação',
      tipoChamado: 'Solicitação',
    },
  }, 'novo');

  const chamado = await ChamadoN1.create(partial);
  const ticketId = String(chamado._id);
  const protocolo = String(chamado.chamadoProtocolo || '');

  call.chamadoId = chamado._id as Types.ObjectId;
  call.ticketStatus = 'created';
  await call.save();

  let notified = false;
  try {
    await createWorkflowNotificacao({
      destinatarioEmail: agent.email,
      ticketId,
      chamadoProtocolo: protocolo,
      workflowId: TELEPHONY_NOTIF_WORKFLOW_ID.toString(),
      workflowSlug: 'telephony-inbound',
      step: 0,
      passoId: null,
      titulo: 'Nova ligação atribuída',
      mensagem: `${clientName} — ${protocolo || ticketId}. Abra o ticket para atender.`,
    });
    notified = true;
  } catch (err) {
    console.warn('[telephony-ticket] falha ao criar CTA no sininho:', (err as Error).message);
  }

  return { ticketId, protocolo, notified };
}

export function telephonyHasAssignedAgent(input: TelephonyCallInput): boolean {
  return Boolean(normalize(input.agentId) || normalize(input.agentName));
}
