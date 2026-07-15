/**
 * agentTabulation.util v1.1.0 — tabulação sugerida pelo Agente de Auditoria
 * VERSION: v1.1.0 | DATE: 2026-07-15
 */
import { getActiveTabulation, validateComboSoft, type TabulationActiveDto } from '../tabulation.service';
import type { TicketAiMessageInput, TicketAiTabulationResult, AuditoriaInput } from './agentTypes';
import { resolveClientFirstName, trimStr } from './openaiAgent.util';

const VALID_TIPOS = new Set(['Reclamação', 'Solicitação', 'Dúvida', 'Informação']);
const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 8_000;

export function normalizeMessages(raw: unknown): TicketAiMessageInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_MESSAGES)
    .map((m) => ({
      role: m?.role === 'agente' ? 'agente' as const : 'cliente' as const,
      text: trimStr(m?.text, MAX_MESSAGE_CHARS),
    }))
    .filter((m) => m.text.length > 0);
}

export async function loadTabulationConfig(): Promise<TabulationActiveDto> {
  try {
    return await getActiveTabulation();
  } catch (tabErr) {
    console.warn('[agents] tabulação Mongo indisponível:', (tabErr as Error)?.message);
    return { produtos: [], opcoes: { tipoChamado: [], canalContato: [] } };
  }
}

export function buildTabulationCatalog(config: TabulationActiveDto): string {
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

export function formatMessagesBlock(messages: TicketAiMessageInput[]): string {
  return messages
    .map((m, i) => `${i + 1}. [${m.role === 'cliente' ? 'Cliente' : 'Agente'}]: ${m.text}`)
    .join('\n');
}

export function buildAtendimentoUserBlock(
  params: {
    protocolo?: string;
    canal?: string;
    titulo?: string;
    clientName?: string;
    nomeOperador?: string;
    contextSource: 'public' | 'internal';
    messages?: TicketAiMessageInput[];
    internalNote?: string;
    produtoHint?: string;
    feedbackExamples?: string;
  },
  tabulationCatalog: string,
): string {
  const clientFullName = trimStr(params.clientName, 200);
  const clientFirstName = resolveClientFirstName(clientFullName);
  const parts: string[] = [
    '## Chamado',
    `Protocolo: ${params.protocolo || 'não informado'}`,
    `Canal: ${params.canal || 'não informado'}`,
    `Título: ${params.titulo || 'não informado'}`,
    `Contexto: ${params.contextSource}`,
    '',
    '## Partes',
    `Primeiro nome do cliente: ${clientFirstName || 'não informado'}`,
    `Nome do agente: ${params.nomeOperador || 'Atendimento Velotax'}`,
  ];

  if (clientFirstName) {
    parts.push(`Primeira linha obrigatória: Olá, ${clientFirstName}`);
  }

  if (params.produtoHint) {
    parts.push('', `## Dica de produto: ${params.produtoHint}`);
  }

  parts.push('', '## Catálogo de tabulação (lista fechada)', '', tabulationCatalog);
  parts.push('', '## Tipos permitidos', '', 'Reclamação, Solicitação, Dúvida, Informação');

  if (params.contextSource === 'public' && params.messages?.length) {
    parts.push('', '## Histórico', '', formatMessagesBlock(params.messages));
  }

  if (params.contextSource === 'internal' && params.internalNote) {
    parts.push('', '## Registro interno (NÃO repetir literalmente)', '', params.internalNote);
  }

  if (params.feedbackExamples?.trim()) {
    parts.push('', '## Exemplos de correções anteriores (aprendizado)', '', params.feedbackExamples.trim());
  }

  parts.push('', '## Tarefa', '', 'Retorne JSON com respostaSugerida, tabulacao, confidence e fontesConsultadas.');
  return parts.join('\n');
}

export function buildAuditoriaUserBlock(
  params: AuditoriaInput,
  tabulationCatalog: string,
): string {
  const parts: string[] = [
    `## Modo\n${params.modo}`,
    '',
    '## Chamado',
    `Protocolo: ${params.protocolo || 'não informado'}`,
    `Canal: ${params.canal || 'não informado'}`,
    `Status: ${params.status || 'não informado'}`,
  ];

  if (params.contextSource === 'public' && params.messages?.length) {
    parts.push('', '## Contexto original do cliente', '', formatMessagesBlock(params.messages));
  }
  if (params.contextSource === 'internal' && params.internalNote) {
    parts.push('', '## Contexto original (anotação interna)', '', params.internalNote);
  }
  if (params.ultimaMensagemCliente) {
    parts.push('', '## Última mensagem do cliente', '', params.ultimaMensagemCliente);
  }

  parts.push(
    '',
    '## Resposta proposta pelo Agente de Atendimento',
    params.respostaSugerida,
    '',
    '## Tabulação proposta pelo Agente de Atendimento',
    `tipo: ${params.tabulacao.tipo} | produto: ${params.tabulacao.produto} | motivo: ${params.tabulacao.motivo} | detalhe: ${params.tabulacao.detalhe}`,
    '',
    `## Confiança do Atendimento: ${params.confidence || 'não informada'}`,
  );

  if (params.mensagemOperador) {
    parts.push('', '## Resposta enviada pelo operador humano', '', params.mensagemOperador);
  }

  if (params.palavrasCriticasPrecheck?.length) {
    parts.push(
      '',
      '## Palavras críticas detectadas pelo sistema (pré-verificação)',
      params.palavrasCriticasPrecheck.join(', '),
    );
  }

  parts.push(
    '',
    '## Catálogo de tabulação (lista fechada)',
    '',
    tabulationCatalog,
    '',
    '## Tipos permitidos',
    '',
    'Reclamação, Solicitação, Dúvida, Informação',
    '',
    '## Tarefa',
    '',
    'Audite a resposta e sugira a tabulação correta em tabulacaoSugerida (tipo, produto, motivo, detalhe) com base no contexto, na resposta e no catálogo. Confirme ou corrija a tabulação do Agente de Atendimento.',
  );

  return parts.join('\n');
}

export function validateTabulationResult(
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

  return { tipo, produto, motivo, detalhe, incompleta: !produto || !motivo };
}

export function buildTabulationDisplay(tab: TicketAiTabulationResult): string {
  const parts = [tab.tipo, tab.produto, tab.motivo, tab.detalhe].filter(Boolean);
  return parts.length ? parts.join(' → ') : 'Tabulação incompleta';
}

export const ATENDIMENTO_JSON_SCHEMA = {
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
    confidence: { type: 'string', enum: ['alta', 'media', 'baixa'] },
    fontesConsultadas: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['respostaSugerida', 'tabulacao', 'confidence', 'fontesConsultadas'],
} as const;

export const AUDITORIA_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    aprovado: { type: 'boolean' },
    score: { type: 'number' },
    modo: { type: 'string' },
    decisao: { type: 'string' },
    nivelCriticidade: { type: 'string' },
    impactoGravidade: { type: 'string' },
    categoriaAtendimento: { type: 'string' },
    palavrasCriticasDetectadas: { type: 'array', items: { type: 'string' } },
    requerRevisaoAgente1: { type: 'boolean' },
    notificarAgente3: { type: 'boolean' },
    violacoes: { type: 'array', items: { type: 'string' } },
    recomendacoes: { type: 'array', items: { type: 'string' } },
    criteriosAvaliados: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          criterio: { type: 'string' },
          conforme: { type: 'boolean' },
          observacao: { type: 'string' },
        },
        required: ['criterio', 'conforme', 'observacao'],
      },
    },
    tabulacaoSugerida: {
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
  required: [
    'aprovado', 'score', 'modo', 'decisao', 'nivelCriticidade', 'impactoGravidade',
    'categoriaAtendimento', 'palavrasCriticasDetectadas', 'requerRevisaoAgente1',
    'notificarAgente3', 'violacoes', 'recomendacoes', 'criteriosAvaliados', 'tabulacaoSugerida',
  ],
} as const;
