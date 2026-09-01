/**
 * placeholders.util v1.0.0 — catálogo único de placeholders para e-mails de saída e
 * prompts de workflow (nome do cliente, nome do agente, número/produto do ticket, datas)
 */
import type { IChamadoN1 } from '../models/ChamadoN1';
import { resolveClientGreetingName } from './clientMessageEnvelope.service';

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

/** Nome de exibição do cliente a partir do chamado (cadastro > título > motivo da tabulação). */
export function resolveChamadoClientName(chamado: IChamadoN1): string {
  const tab = Array.isArray(chamado.tabulacao) ? chamado.tabulacao[chamado.tabulacao.length - 1] : null;
  const fromCliente = (chamado.cliente?.[0] as { clienteNome?: string } | undefined)?.clienteNome;
  return String(fromCliente || chamado.chamadoTitulo || tab?.motivo || '').trim();
}

export function buildTicketPlaceholderValues(
  chamado: IChamadoN1,
  opts: { clientName?: string } = {},
): TicketPlaceholderValues {
  const tab = Array.isArray(chamado.tabulacao) ? chamado.tabulacao[chamado.tabulacao.length - 1] : null;
  const clientName = opts.clientName ?? resolveChamadoClientName(chamado);
  return {
    nomeCliente: resolveClientGreetingName(clientName, 'cliente'),
    nomeAgente: String(tab?.responsavel || '').trim() || 'Atendimento Velotax',
    numeroTicket: String(chamado.chamadoProtocolo || '').trim(),
    produtoTicket: String(tab?.produto || '').trim(),
    dataAbertura: formatBrDate(chamado.createdAt),
    dataAtual: formatBrDate(new Date()),
  };
}

/** Troca os placeholders do catálogo (token canônico + aliases legados) pelos dados reais do ticket. */
export function applyTicketPlaceholders(
  text: string,
  chamado: IChamadoN1,
  opts: { clientName?: string } = {},
): string {
  const raw = String(text ?? '');
  if (!raw) return '';
  const values = buildTicketPlaceholderValues(chamado, opts);
  return PLACEHOLDER_CATALOG.reduce(
    (acc, item) => item.aliases.reduce((inner, re) => inner.replace(re, values[item.key]), acc),
    raw,
  );
}
