/**
 * openaiTicketSuggest.service v1.1.0 — delegação ao orquestrador de agentes
 * VERSION: v1.1.0 | DATE: 2026-07-13
 */
import OpenAI from 'openai';
import { env } from '../config/env';
import { getActiveTabulation, validateComboSoft, type TabulationActiveDto } from './tabulation.service';
import { getTicketSuggestPersona } from './ticketSuggestPersona';
import { runAgentPipeline } from './agents/agentOrchestrator.service';
import { getAgentsStatus, isAgentsConfigured } from './agents/openaiAgent.util';

const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_INTERNAL_NOTE_CHARS = 12_000;
const MAX_TITULO_CHARS = 500;
const REQUEST_TIMEOUT_MS = 120_000;

function createOpenAiClient() {
  return new OpenAI({
    apiKey: env.openaiApiKey,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 2,
    // node-fetch bundled pelo SDK falha com ERR_STREAM_PREMATURE_CLOSE no Windows
    fetch: globalThis.fetch,
  });
}

const VALID_TIPOS = new Set(['Reclamação', 'Solicitação', 'Dúvida', 'Informação']);

export type TicketAiContextSource = 'public' | 'internal';

export interface TicketAiMessageInput {
  role: 'cliente' | 'agente';
  text: string;
}

export interface TicketAiSuggestInput {
  ticketId?: string;
  protocolo?: string;
  titulo?: string;
  canal?: string;
  clientName?: string;
  nomeOperador?: string;
  contextSource: TicketAiContextSource;
  messages?: TicketAiMessageInput[];
  internalNote?: string;
  produtoHint?: string;
}

export interface TicketAiTabulationResult {
  tipo: string;
  produto: string;
  motivo: string;
  detalhe: string;
  incompleta?: boolean;
}

export interface TicketAiSuggestResult {
  success: boolean;
  respostaSugerida?: string;
  tabulacao?: TicketAiTabulationResult;
  tabulacaoDisplay?: string;
  model?: string;
  error?: string;
  auditScore?: number;
  auditAprovado?: boolean;
  auditDecisao?: string;
  confidence?: string;
  revisoesRealizadas?: number;
  auditComplete?: boolean;
}

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    respostaSugerida: { type: 'string' },
    tabulacao: {
      type: 'object',
      additionalProperties: false,
      properties: {
        tipo: { type: 'string' },
        produto: { type: 'string' },
        motivo: { type: 'string' },
        detalhe: { type: 'string' },
      },
      required: ['tipo', 'produto', 'motivo', 'detalhe'],
    },
  },
  required: ['respostaSugerida', 'tabulacao'],
} as const;

export function getOpenAiTicketSuggestStatus(): { configured: boolean; missing: string[] } {
  if (env.agentsEnabled) {
    const agents = getAgentsStatus();
    return { configured: agents.configured, missing: agents.missing };
  }
  const missing: string[] = [];
  if (!env.openaiApiKey?.trim()) missing.push('OPENAI_API_KEY');
  if (!env.openaiVectorStoreId?.trim()) missing.push('OPENAI_VECTOR_STORE_ID');
  return { configured: missing.length === 0, missing };
}

export function isOpenAiTicketSuggestConfigured(): boolean {
  if (env.agentsEnabled) return isAgentsConfigured();
  return getOpenAiTicketSuggestStatus().configured;
}

function trimStr(value: unknown, maxLen: number): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function normalizeMessages(raw: unknown): TicketAiMessageInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_MESSAGES)
    .map((m) => ({
      role: m?.role === 'agente' ? 'agente' as const : 'cliente' as const,
      text: trimStr(m?.text, MAX_MESSAGE_CHARS),
    }))
    .filter((m) => m.text.length > 0);
}

export function validateTicketAiInput(body: unknown):
  | { ok: true; data: TicketAiSuggestInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Corpo da requisição inválido' };
  }

  const b = body as Record<string, unknown>;
  const contextSource = b.contextSource === 'internal' ? 'internal' : b.contextSource === 'public' ? 'public' : null;
  if (!contextSource) {
    return { ok: false, error: 'contextSource é obrigatório (public ou internal)' };
  }

  const messages = normalizeMessages(b.messages);
  const internalNote = trimStr(b.internalNote, MAX_INTERNAL_NOTE_CHARS);

  if (contextSource === 'public') {
    const hasClientMsg = messages.some((m) => m.role === 'cliente');
    if (!hasClientMsg) {
      return { ok: false, error: 'Informe ao menos uma mensagem do cliente para contextSource public' };
    }
  }

  if (contextSource === 'internal' && !internalNote) {
    return { ok: false, error: 'internalNote é obrigatório para contextSource internal' };
  }

  return {
    ok: true,
    data: {
      ticketId: trimStr(b.ticketId, 64) || undefined,
      protocolo: trimStr(b.protocolo, 64) || undefined,
      titulo: trimStr(b.titulo, MAX_TITULO_CHARS) || undefined,
      canal: trimStr(b.canal, 64) || undefined,
      clientName: trimStr(b.clientName, 200) || undefined,
      nomeOperador: trimStr(b.nomeOperador, 120) || undefined,
      contextSource,
      messages: contextSource === 'public' ? messages : undefined,
      internalNote: contextSource === 'internal' ? internalNote : undefined,
      produtoHint: trimStr(b.produtoHint, 200) || undefined,
    },
  };
}

function buildTabulationCatalog(config: TabulationActiveDto): string {
  const lines: string[] = [];
  for (const p of config.produtos.filter((item) => item.ativo)) {
    const motivoLines: string[] = [];
    for (const m of (p.motivos || []).filter((item) => item.ativo !== false)) {
      const detalhes = (m.detalhes || [])
        .filter((d) => d.ativo !== false)
        .map((d) => d.detalhe);
      motivoLines.push(`    - motivo: "${m.motivo}"${detalhes.length ? ` → detalhes: [${detalhes.map((d) => `"${d}"`).join(', ')}]` : ''}`);
    }
    lines.push(`  - produto: "${p.produto}"\n${motivoLines.join('\n') || '    (sem motivos)'}`);
  }
  return lines.join('\n');
}

function formatMessagesBlock(messages: TicketAiMessageInput[]): string {
  return messages
    .map((m, i) => `${i + 1}. [${m.role === 'cliente' ? 'Cliente' : 'Agente'}]: ${m.text}`)
    .join('\n');
}

function resolveClientFirstName(fullName: string): string {
  const name = trimStr(fullName, 200);
  if (!name) return '';
  return name.split(/\s+/)[0] || name;
}

function buildUserBlock(params: TicketAiSuggestInput, tabulationCatalog: string): string {
  const clientFullName = trimStr(params.clientName, 200);
  const clientFirstName = resolveClientFirstName(clientFullName);
  const parts: string[] = [
    '## Dados do atendimento',
    '',
    `- **Protocolo:** ${params.protocolo || 'não informado'}`,
    `- **Canal:** ${params.canal || 'não informado'}`,
    `- **Cliente:** ${clientFullName || 'não informado'}`,
    `- **Nome do agente:** ${params.nomeOperador || 'não informado'}`,
    `- **Título:** ${params.titulo || 'não informado'}`,
    `- **Fonte de contexto:** ${params.contextSource === 'internal' ? 'anotação interna (telefone)' : 'mensagens públicas'}`,
  ];

  if (clientFirstName) {
    parts.push(
      '',
      '## Nome do cliente (usar na saudação — OBRIGATÓRIO)',
      '',
      `- **Nome completo:** ${clientFullName}`,
      `- **Primeiro nome do cliente:** ${clientFirstName}`,
      `- **Primeira linha de respostaSugerida:** Olá, ${clientFirstName}`,
    );
  }

  if (params.produtoHint) {
    parts.push(`- **Produto já identificado pelo agente (priorizar POP):** ${params.produtoHint}`);
  }

  parts.push('', '## Lista fechada de tabulação (usar SOMENTE estes valores)', '', tabulationCatalog);
  parts.push('', '## Tipos permitidos', '', 'Reclamação, Solicitação, Dúvida, Informação');

  if (params.contextSource === 'public' && params.messages?.length) {
    parts.push('', '## Mensagens públicas do atendimento', '', formatMessagesBlock(params.messages));
    const firstClient = params.messages.find((m) => m.role === 'cliente');
    if (firstClient) {
      parts.push('', '## Descrição principal do chamado (1ª mensagem do cliente)', '', firstClient.text);
    }
  }

  if (params.contextSource === 'internal' && params.internalNote) {
    parts.push(
      '',
      '## Registro interno do agente (NÃO repetir literalmente na resposta ao cliente)',
      '',
      params.internalNote,
    );
  }

  parts.push(
    '',
    '## Tarefa',
    '',
    'Consulte os POPs na base de conhecimento. Retorne JSON com respostaSugerida (texto ao cliente no formato padrão: saudação, identificação do agente, desenvolvimento e despedida com assinatura Velotax) e tabulacao (tipo, produto, motivo, detalhe) usando apenas valores da lista fechada.',
  );

  return parts.join('\n');
}

function buildTabulationDisplay(tab: TicketAiTabulationResult): string {
  const parts = [tab.tipo, tab.produto, tab.motivo, tab.detalhe].filter(Boolean);
  return parts.length ? parts.join(' → ') : 'Tabulação incompleta';
}

function validateTabulationResult(
  raw: { tipo?: string; produto?: string; motivo?: string; detalhe?: string },
  config: TabulationActiveDto,
): TicketAiTabulationResult {
  let tipo = trimStr(raw.tipo, 64);
  let produto = trimStr(raw.produto, 200);
  let motivo = trimStr(raw.motivo, 200);
  let detalhe = trimStr(raw.detalhe, 200);

  if (tipo && !VALID_TIPOS.has(tipo)) tipo = 'Solicitação';
  if (!tipo) tipo = 'Solicitação';

  if (produto && config.produtos.length > 0 && !validateComboSoft(config, produto, '', '')) {
    produto = '';
    motivo = '';
    detalhe = '';
  }

  if (produto && motivo && !validateComboSoft(config, produto, motivo, '')) {
    motivo = '';
    detalhe = '';
  }

  if (produto && motivo && detalhe && !validateComboSoft(config, produto, motivo, detalhe)) {
    detalhe = '';
  }

  const incompleta = !produto || !motivo;

  return { tipo, produto, motivo, detalhe, incompleta };
}

function mapOpenAiErrorMessage(err: unknown): string {
  const message = (err as Error)?.message || String(err);
  if (/401|invalid_api_key|Incorrect API key/i.test(message)) {
    return 'Chave OpenAI inválida. Verifique OPENAI_API_KEY.';
  }
  if (/429|rate limit|quota/i.test(message)) {
    return 'Limite de uso da API OpenAI atingido. Tente novamente em alguns minutos.';
  }
  if (/402|billing|insufficient/i.test(message)) {
    return 'Conta OpenAI sem crédito ou cobrança pendente.';
  }
  if (/404|not found|vector_store/i.test(message)) {
    return `Vector store ou modelo indisponível. Verifique OPENAI_VECTOR_STORE_ID e OPENAI_MODEL.`;
  }
  if (/timeout|ETIMEDOUT|abort|Premature close|ERR_STREAM_PREMATURE_CLOSE/i.test(message)) {
    return 'Tempo esgotado ou conexão interrompida ao consultar a IA. Tente novamente.';
  }
  return message || 'Não foi possível gerar sugestão';
}

function extractOutputText(response: OpenAI.Responses.Response): string {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }
  for (const item of response.output || []) {
    if (item.type === 'message' && 'content' in item) {
      for (const part of item.content || []) {
        if (part.type === 'output_text' && part.text?.trim()) {
          return part.text.trim();
        }
      }
    }
  }
  return '';
}

function parseAiJson(raw: string): { respostaSugerida?: string; tabulacao?: { tipo?: string; produto?: string; motivo?: string; detalhe?: string } } | null {
  try {
    return JSON.parse(raw) as { respostaSugerida?: string; tabulacao?: { tipo?: string; produto?: string; motivo?: string; detalhe?: string } };
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function generateTicketAiSuggest(
  params: TicketAiSuggestInput,
  userId?: string,
): Promise<TicketAiSuggestResult> {
  if (!isOpenAiTicketSuggestConfigured()) {
    return { success: false, error: 'Serviço OpenAI não configurado' };
  }

  if (env.agentsEnabled) {
    console.log('[ticket-ai-suggest] delegando ao orquestrador (desk) para', userId || 'anonimo');
    const pipeline = await runAgentPipeline({ ...params, pipelineModo: 'desk' });
    if (!pipeline.success) {
      return { success: false, error: pipeline.error || 'Falha no pipeline de agentes' };
    }
    if (typeof pipeline.auditScore !== 'number' || !pipeline.auditComplete) {
      return { success: false, error: 'Auditoria não concluída — sugestão bloqueada' };
    }
    return {
      success: true,
      respostaSugerida: pipeline.respostaSugerida,
      tabulacao: pipeline.tabulacao,
      tabulacaoDisplay: pipeline.tabulacaoDisplay,
      model: pipeline.model,
      auditScore: pipeline.auditScore,
      auditAprovado: pipeline.auditAprovado,
      auditDecisao: pipeline.auditDecisao,
      auditComplete: true,
      confidence: pipeline.confidence,
      revisoesRealizadas: pipeline.revisoesRealizadas,
    };
  }

  try {
    let config: TabulationActiveDto;
    try {
      config = await getActiveTabulation();
    } catch (tabErr) {
      console.warn('[ticket-ai-suggest] tabulação Mongo indisponível — continuando só com POPs:', (tabErr as Error)?.message);
      config = { produtos: [], opcoes: { tipoChamado: [], canalContato: [] } };
    }
    const tabulationCatalog = buildTabulationCatalog(config);
    const systemPrompt = getTicketSuggestPersona();
    const userBlock = buildUserBlock(params, tabulationCatalog);

    const openai = createOpenAiClient();

    console.log('[ticket-ai-suggest] processando para', userId || 'anonimo', params.contextSource);

    const response = await openai.responses.create({
      model: env.openaiModel,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userBlock },
      ],
      tools: [
        {
          type: 'file_search',
          vector_store_ids: [env.openaiVectorStoreId],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'ticket_ai_suggest',
          schema: JSON_SCHEMA,
          strict: true,
        },
      },
    });

    const rawText = extractOutputText(response);
    const parsed = parseAiJson(rawText);

    if (!parsed?.respostaSugerida?.trim()) {
      return { success: false, error: 'Resposta da IA inválida ou vazia' };
    }

    const tabulacao = validateTabulationResult(parsed.tabulacao || {}, config);

    return {
      success: true,
      respostaSugerida: parsed.respostaSugerida.trim(),
      tabulacao,
      tabulacaoDisplay: buildTabulationDisplay(tabulacao),
      model: response.model || env.openaiModel,
    };
  } catch (err) {
    console.error('[ticket-ai-suggest]', err);
    return { success: false, error: mapOpenAiErrorMessage(err) };
  }
}

export function statusForOpenAiError(error?: string): number {
  if (!error) return 500;
  if (/não configurado|OPENAI_API_KEY|OPENAI_VECTOR_STORE/i.test(error)) return 503;
  if (/crédito|cobrança|billing|429|Limite de uso|indisponível|Vector store/i.test(error)) return 502;
  return 500;
}
