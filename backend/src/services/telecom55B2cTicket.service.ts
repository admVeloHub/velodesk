/**
 * telecom55B2cTicket.service v1.0.0 — abertura de ticket a partir do webhook "55" (call
 * center humano). Distinto do fluxo Contact Tel (telephonyTicketNotify.service.ts) — mesmo
 * espírito (compõe ticket + notifica CTA), payload e regras de negócio diferentes.
 */
import { Types } from 'mongoose';
import { User } from '../models/User';
import { ChamadoN1 } from '../models/ChamadoN1';
import { createChamadoFromBody } from './chamado.mapper';
import { findOrCreateClienteFromCpfLookup } from './cliente.service';
import { createWorkflowNotificacao } from './workflowNotificacao.service';
import { runInboundPostCreateHooks } from './agents/inboundAgentPipeline.service';
import type { Telecom55B2cEvent } from './telephony-inbound/adapters/telecom55B2c.adapter';

/** Sentinel de workflow para CTAs do webhook 55 B2C (sem workflow real, mesmo padrão do Contact Tel). */
const TELECOM55_B2C_NOTIF_WORKFLOW_ID = new Types.ObjectId('00000000000000000000aa02');

const KNOWN_DIDS = new Set(['551130037293', '08008000049', '08002371339']);
const CHAVES_PIX_DID = '08002371339';

const URA_TO_CATEGORIA: Record<string, string> = {
  'opcao - 1': 'Crédito',
  'opcao - 2': 'Conta e PIX',
  'opcao - 3': 'Seguros',
  'opcao - 4': 'Clube',
  'opcao - a': 'Calculadora',
};
const DEFAULT_CATEGORIA = 'Crédito';

/** motivo fica sempre em branco — o agente completa ao atender. */
const CATEGORIA_TO_PRODUTO: Record<string, string> = {
  'Crédito': 'Emprestimo Pessoal',
  'Conta e PIX': 'Conta Velotax',
  'Seguros': 'Seguros',
  'Calculadora': 'Calculadora',
  'Chaves PIX': 'Antecipação 2026',
  // 'Clube' fica sem produto — não existe no catálogo hoje.
};

export function shouldCreateTicketFromTelecom55B2cEvent(event: Telecom55B2cEvent): boolean {
  if (event.callType !== 'receptive') return false;
  if (event.callStatus !== 'new_call') return false;
  if (event.callTransferId) return false;
  if (!KNOWN_DIDS.has(event.callTerminal)) return false;
  if (event.callUrlAudio) return false;
  if (!event.callUra) return false;
  if (!event.branchEmail) return false;
  return true;
}

function normalizeUra(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveCategoriaFromUra(callTerminal: string, callUra: string): string {
  if (callTerminal === CHAVES_PIX_DID) return 'Chaves PIX';
  return URA_TO_CATEGORIA[normalizeUra(callUra)] || DEFAULT_CATEGORIA;
}

async function resolveAgentByBranchEmail(branchEmail: string): Promise<{ email: string; displayName: string } | null> {
  const user = await User.findOne({ email: branchEmail }).select('email name').lean();
  if (!user?.email) {
    console.info('[telecom55-b2c-ticket] atendente não resolvido no cadastro User', { branchEmail });
    return null;
  }
  return {
    email: String(user.email).trim().toLowerCase(),
    displayName: String(user.name || user.email).trim(),
  };
}

interface ResolvedCliente {
  clienteId: Types.ObjectId | null;
  clienteNome: string;
}

async function resolveClienteParaTicket(cpf: string): Promise<ResolvedCliente> {
  const { cliente } = await findOrCreateClienteFromCpfLookup(cpf, true);
  if (!cliente) return { clienteId: null, clienteNome: '' };
  const dados = cliente.clienteDados?.[0];
  return {
    clienteId: cliente._id as Types.ObjectId,
    clienteNome: String(dados?.clienteNome || '').trim(),
  };
}

export async function createTicketFromTelecom55B2cCall(
  event: Telecom55B2cEvent,
): Promise<{ ticketId: string; protocolo: string; notified: boolean } | null> {
  const agent = await resolveAgentByBranchEmail(event.branchEmail);
  if (!agent) return null;

  const categoria = resolveCategoriaFromUra(event.callTerminal, event.callUra);
  const produto = CATEGORIA_TO_PRODUTO[categoria] || '';
  const cliente = await resolveClienteParaTicket(event.callDocument);
  const cadastroNaoEncontrado = !cliente.clienteId;
  const title = `Velotax - Central de Atendimento (Tel ${event.callNumber})`;

  const partial = await createChamadoFromBody({
    title,
    chamadoTitulo: title,
    author: agent.displayName,
    source: 'telecom55-b2c-inbound',
    channel: 'telefone',
    internalText: `CPF digitado na URA: ${event.callDocument} · Telefone: ${event.callNumber}`,
    // clientCPF/clientName só passam quando há cadastro resolvido — senão o resolvedor de
    // cliente do createChamadoFromBody cria um cadastro local em branco por engano (ele
    // dispara upsert sempre que recebe clientCPF, mesmo sem nome/e-mail). Sem cadastro, o
    // vínculo é setado manualmente abaixo, sem tocar na coleção de clientes.
    ...(cliente.clienteId ? { clientCPF: event.callDocument, clientName: cliente.clienteNome, clienteId: cliente.clienteId.toString() } : {}),
    clientPhone: event.callNumber,
    lateralForm: {
      canal: 'Telefone',
      responsavel: agent.displayName,
      tipo: 'Solicitação',
      tipoChamado: 'Solicitação',
      // motivo explicitamente '' (não omitido) — sem isso tabulacaoFromBody usa o título do
      // ticket como fallback de motivo, e o pedido é motivo sempre em branco pro agente.
      motivo: '',
      ...(produto ? { produto } : {}),
    },
  }, 'novo');

  if (cadastroNaoEncontrado) {
    partial.cliente = [{ clienteCpf: event.callDocument, clienteId: null }];
  }

  const chamado = await ChamadoN1.create(partial);
  const ticketId = String(chamado._id);
  const protocolo = String(chamado.chamadoProtocolo || '');

  void runInboundPostCreateHooks(chamado, { source: 'telecom55-b2c-inbound' }).catch((err: Error) => {
    console.warn('[telecom55-b2c-ticket] runInboundPostCreateHooks fail-soft:', err.message);
  });

  let notified = false;
  try {
    await createWorkflowNotificacao({
      destinatarioEmail: agent.email,
      ticketId,
      chamadoProtocolo: protocolo,
      workflowId: TELECOM55_B2C_NOTIF_WORKFLOW_ID.toString(),
      workflowSlug: 'telecom55-b2c-inbound',
      step: 0,
      passoId: null,
      titulo: 'Nova ligação atribuída',
      mensagem: `${cliente.clienteNome || 'Cliente'} — ${protocolo || ticketId}. Abra o ticket para atender.`,
    });
    notified = true;
  } catch (err) {
    console.warn('[telecom55-b2c-ticket] falha ao criar CTA no sininho:', (err as Error).message);
  }

  return { ticketId, protocolo, notified };
}
