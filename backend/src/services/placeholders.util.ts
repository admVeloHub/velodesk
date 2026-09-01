/**
 * placeholders.util v1.0.0 — catálogo único de placeholders para e-mails de saída e
 * prompts de workflow (nome do cliente, nome do agente, número/produto do ticket, datas)
 */
import type { IChamadoN1 } from '../models/ChamadoN1';
import { resolveClientGreetingName } from './clientMessageEnvelope.service';
import { findClienteByEmail, getPrimaryDados, loadDadosForRef } from './cliente.service';

export type PlaceholderKey =
  | 'nomeCliente'
  | 'nomeAgente'
  | 'numeroTicket'
  | 'produtoTicket'
  | 'dataAbertura'
  | 'dataAtual';

export interface PlaceholderCatalogItem {
  key: PlaceholderKey;
  /** Token canônico inserido pelo seletor de placeholders na UI. */
  token: string;
  /** Rótulo exibido no seletor. */
  label: string;
  /** Token canônico + sinônimos legados já usados em conteúdo salvo. */
  aliases: RegExp[];
}

export const PLACEHOLDER_CATALOG: PlaceholderCatalogItem[] = [
  {
    key: 'nomeCliente',
    token: '{nomeCliente}',
    label: 'Nome do cliente',
    aliases: [/\{client_name\}/gi, /\{nome_cliente\}/gi, /\{nomeCliente\}/gi, /\{cliente\}/gi, /\{nome\}/gi],
  },
  {
    key: 'nomeAgente',
    token: '{nomeAgente}',
    label: 'Nome do agente responsável',
    aliases: [/\{nomeAgente\}/gi, /\{nome_agente\}/gi, /\{agente\}/gi],
  },
  {
    key: 'numeroTicket',
    token: '{numeroTicket}',
    label: 'Número do ticket',
    aliases: [/\{numeroTicket\}/gi, /\{numero_ticket\}/gi, /\{protocolo\}/gi],
  },
  {
    key: 'produtoTicket',
    token: '{produtoTicket}',
    label: 'Produto do ticket',
    aliases: [/\{produtoTicket\}/gi, /\{produto_ticket\}/gi, /\{produto\}/gi],
  },
  {
    key: 'dataAbertura',
    token: '{dataAbertura}',
    label: 'Data de abertura do ticket',
    aliases: [/\{dataAbertura\}/gi, /\{data_abertura\}/gi],
  },
  {
    key: 'dataAtual',
    token: '{dataAtual}',
    label: 'Data atual',
    aliases: [/\{dataAtual\}/gi, /\{data_atual\}/gi],
  },
];

export type TicketPlaceholderValues = Record<PlaceholderKey, string>;

function formatBrDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(parsed);
}

function firstRegistroEmailInboundSender(chamado: IChamadoN1): string {
  const first = chamado.registro?.[0];
  const meta = (first?.metadados && typeof first.metadados === 'object' ? first.metadados : {}) as Record<string, unknown>;
  if (String(meta.source ?? '').trim().toLowerCase() !== 'email-inbound') return '';
  const from = String(meta.emailFrom ?? '').trim().toLowerCase();
  return from.includes('@') ? from : '';
}

/**
 * Nome real do cliente — única fonte aceitável é o cadastro, nunca o assunto do e-mail ou a
 * tabulação (que já causou casos como "primeira palavra do assunto virou nome do cliente" e
 * o assunto-fallback "Atendimento por e-mail" virando nome "Atendimento"). Ordem:
 * 1. Cadastro já associado ao ticket (via CPF ou qualquer outro meio) — única referência aceitável
 *    quando presente.
 * 2. Ticket aberto por e-mail sem cadastro associado — busca o cadastro pelo e-mail do remetente
 *    da primeira mensagem.
 * 3. Nada encontrado — string vazia (o chamador usa "Cliente" literal, sem tentar mais nada).
 */
export async function resolveChamadoClientName(chamado: IChamadoN1): Promise<string> {
  const ref = chamado.cliente?.[0];
  if (ref) {
    // Cadastro já associado ao ticket — única referência aceitável enquanto existir vínculo,
    // mesmo que o cadastro em si esteja sem nome preenchido (não cai pro lookup por e-mail).
    const dados = await loadDadosForRef(ref);
    return String(dados?.clienteNome || '').trim();
  }

  const senderEmail = firstRegistroEmailInboundSender(chamado);
  if (!senderEmail) return '';

  const cliente = await findClienteByEmail(senderEmail);
  const dados = getPrimaryDados(cliente);
  return String(dados?.clienteNome || '').trim();
}

export async function buildTicketPlaceholderValues(
  chamado: IChamadoN1,
  opts: { clientName?: string } = {},
): Promise<TicketPlaceholderValues> {
  const tab = Array.isArray(chamado.tabulacao) ? chamado.tabulacao[chamado.tabulacao.length - 1] : null;
  const clientName = opts.clientName ?? await resolveChamadoClientName(chamado);
  return {
    nomeCliente: clientName ? resolveClientGreetingName(clientName, 'Cliente') : 'Cliente',
    nomeAgente: String(tab?.responsavel || '').trim() || 'Atendimento Velotax',
    numeroTicket: String(chamado.chamadoProtocolo || '').trim(),
    produtoTicket: String(tab?.produto || '').trim(),
    dataAbertura: formatBrDate(chamado.createdAt),
    dataAtual: formatBrDate(new Date()),
  };
}

/** Troca os placeholders do catálogo (token canônico + aliases legados) pelos dados reais do ticket. */
export async function applyTicketPlaceholders(
  text: string,
  chamado: IChamadoN1,
  opts: { clientName?: string } = {},
): Promise<string> {
  const raw = String(text ?? '');
  if (!raw) return '';
  const values = await buildTicketPlaceholderValues(chamado, opts);
  return PLACEHOLDER_CATALOG.reduce(
    (acc, item) => item.aliases.reduce((inner, re) => inner.replace(re, values[item.key]), acc),
    raw,
  );
}
