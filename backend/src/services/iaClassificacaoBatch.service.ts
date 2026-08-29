/**
 * iaClassificacaoBatch — classificação em lote reutilizada por tickets e ligações Letícia IA.
 */
import { env } from '../config/env';
import type { ICasoGraveIA, SentimentoClasseIA } from '../models/ChamadoIaAnalise';
import type { ITicketIaSettings } from '../models/TicketIaSettings';
import {
  createOpenAiClient,
  extractOutputText,
  mapOpenAiErrorMessage,
  parseAiJson,
} from './agents/openaiAgent.util';
import { logAiUsage } from './aiUsage.service';
import type { TicketIaSourceQuality } from './ticketIaAdapter.service';
import {
  canonicalizeTicketIaReason,
  resolveTicketIaAlias,
  TicketIaExamplePrompt,
} from './ticketIaSettings.service';

const LOTE_SIZE = 40;
const SENTIMENTOS_VALIDOS: SentimentoClasseIA[] = ['positivo', 'neutro', 'irritado', 'confuso', 'critico'];

export interface IaClassificacaoCandidato {
  itemId: string;
  protocolo: string;
  canal: string;
  abertoEm: string;
  qualidadeFonte: TicketIaSourceQuality;
  textoCliente: string;
  textoHash: string;
}

interface ClassificacaoItem {
  chamadoId: string;
  motivo: string;
  motivoNovo: boolean;
  sentimentoClasse: string;
  casoGrave: { tipo: string; trecho: string } | null;
}

export interface IaClassificacaoResultado {
  itemId: string;
  motivo: string;
  motivoNovo: boolean;
  sentimentoClasse: SentimentoClasseIA | string;
  casoGrave: ICasoGraveIA | null;
  textoHash: string;
  qualidadeFonte: TicketIaSourceQuality;
  canal: string;
  modelo: string;
}

const CLASSIFICACAO_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    classificacoes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          chamadoId: { type: 'string' },
          motivo: { type: 'string' },
          motivoNovo: { type: 'boolean' },
          sentimentoClasse: { type: 'string', enum: SENTIMENTOS_VALIDOS },
          casoGrave: {
            type: ['object', 'null'],
            properties: {
              tipo: { type: 'string' },
              trecho: { type: 'string' },
            },
            required: ['tipo', 'trecho'],
            additionalProperties: false,
          },
        },
        required: ['chamadoId', 'motivo', 'motivoNovo', 'sentimentoClasse', 'casoGrave'],
      },
    },
  },
  required: ['classificacoes'],
} as const;

function buildSystemPrompt(
  settings: ITicketIaSettings,
  examples: TicketIaExamplePrompt[],
  recentNewReasons: string[],
): string {
  const blocks = ['Você é um analista sênior de atendimento de uma fintech de crédito.'];
  if (settings.contextoEmpresa) blocks.push(`Contexto da empresa:\n${settings.contextoEmpresa}`);
  if (settings.instrucoesOutros) {
    blocks.push(`Regras de desambiguação antes de usar "Outros":\n${settings.instrucoesOutros}`);
  }
  if (settings.taxonomiaMotivos.length) {
    blocks.push(
      `Taxonomia oficial. Prefira SEMPRE um destes rótulos e copie o texto exatamente:\n${
        settings.taxonomiaMotivos.map((item) => `- ${item}`).join('\n')
      }`,
    );
  }
  if (settings.motivoAliases.length) {
    blocks.push(
      `Sinônimos já confirmados. Quando identificar o rótulo à esquerda, use o da direita:\n${
        settings.motivoAliases.map((alias) => `- "${alias.de}" → "${alias.para}"`).join('\n')
      }`,
    );
  }
  if (examples.length) {
    blocks.push(
      `Exemplos reais corrigidos por gestores (aprenda o contexto, não copie dados pessoais):\n${
        examples.map((example) =>
          `- Título: ${example.titulo || '(sem título)'} | Trecho: ${example.trecho} | Motivo confirmado: ${example.motivo}`
        ).join('\n')
      }`,
    );
  }
  if (recentNewReasons.length) {
    blocks.push(
      `Motivos novos usados nos últimos 30 dias. Reutilize o mesmo texto quando o assunto for equivalente:\n${
        recentNewReasons.map((item) => `- ${item}`).join('\n')
      }`,
    );
  }
  blocks.push(`Tarefa: leia o TÍTULO e o RELATO DO CLIENTE (ou resumo da ligação Letícia IA) de cada item. Não use tabulação manual como resposta. Quando a fonte estiver marcada como "resumo_atendente" ou resumo de ligação, trate como síntese do atendimento — não como citação literal.

Responda SOMENTE com JSON válido, com uma "classificacoes" (array), um item por entrada:
{ "chamadoId": "<id>", "motivo": "<rótulo curto>", "motivoNovo": true|false, "sentimentoClasse": "positivo|neutro|irritado|confuso|critico", "casoGrave": { "tipo": "Bacen|Procon|Reclame Aqui|Ação judicial|Órgão regulador|Outro", "trecho": "<trecho real>" } | null }

Regras:
- Use motivoNovo=false quando o motivo pertence à taxonomia ou à lista de motivos recentes.
- Só crie motivo novo quando nenhum rótulo conhecido servir e existir um padrão específico.
- "Outros" é apenas para conteúdo realmente ambíguo.
- casoGrave exige menção real e explícita; resumos sintéticos sem citação literal não devem produzir trecho entre aspas.
- Devolva exatamente um item por entrada recebida. Não invente dados. Escreva em português do Brasil.`);
  return blocks.join('\n\n');
}

function buildUserPrompt(candidatos: IaClassificacaoCandidato[]): string {
  const payload = candidatos.map((c) => ({
    chamadoId: c.itemId,
    protocolo: c.protocolo,
    canal: c.canal,
    abertoEm: c.abertoEm,
    qualidadeFonte: c.qualidadeFonte,
    texto: c.textoCliente,
  }));
  return `Total de itens a classificar nesta chamada: ${candidatos.length}.

Itens (JSON):
${JSON.stringify(payload, null, 2)}

Responda apenas com o objeto JSON no formato pedido, com um item por entrada.`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function executarClassificacaoIaLote(
  candidatos: IaClassificacaoCandidato[],
  settings: ITicketIaSettings,
  examples: TicketIaExamplePrompt[],
  recentNewReasons: string[],
  feature: 'chamado_ia_analise' | 'telephony_ia_analise' = 'chamado_ia_analise',
): Promise<IaClassificacaoResultado[]> {
  if (candidatos.length === 0) return [];
  const openai = createOpenAiClient();
  const resultados: IaClassificacaoResultado[] = [];

  for (const lote of chunk(candidatos, LOTE_SIZE)) {
    try {
      const response = await openai.responses.create({
        model: env.chamadoIaAnaliseModel,
        input: [
          { role: 'system', content: buildSystemPrompt(settings, examples, recentNewReasons) },
          { role: 'user', content: buildUserPrompt(lote) },
        ],
        reasoning: { effort: 'low' },
        text: {
          format: {
            type: 'json_schema',
            name: 'classificacao_ia',
            schema: CLASSIFICACAO_JSON_SCHEMA,
            strict: true,
          },
        },
      });

      if (response.usage) {
        void logAiUsage({
          provider: 'openai',
          model: response.model || env.chamadoIaAnaliseModel,
          feature,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cachedInputTokens: response.usage.input_tokens_details?.cached_tokens,
          reasoningTokens: response.usage.output_tokens_details?.reasoning_tokens,
        });
      }

      const raw = extractOutputText(response);
      const parsed = parseAiJson<{ classificacoes?: ClassificacaoItem[] }>(raw);
      const classificacoes = parsed?.classificacoes ?? [];
      const porId = new Map(lote.map((c) => [c.itemId, c]));

      for (const item of classificacoes) {
        const candidato = porId.get(String(item.chamadoId));
        if (!candidato) continue;
        const sentimentoClasse = SENTIMENTOS_VALIDOS.includes(item.sentimentoClasse as SentimentoClasseIA)
          ? item.sentimentoClasse
          : 'neutro';
        const casoGrave: ICasoGraveIA | null =
          item.casoGrave && String(item.casoGrave.tipo ?? '').trim()
            ? { tipo: String(item.casoGrave.tipo).trim(), trecho: String(item.casoGrave.trecho ?? '').trim() }
            : null;
        const motivoBruto = String(item.motivo ?? '').trim() || 'Outros';
        const motivoAliasado = resolveTicketIaAlias(motivoBruto, settings.motivoAliases) ?? motivoBruto;
        const motivo = canonicalizeTicketIaReason(motivoAliasado, settings.taxonomiaMotivos);
        const conhecido = settings.taxonomiaMotivos.includes(motivo);
        resultados.push({
          itemId: candidato.itemId,
          motivo,
          motivoNovo: Boolean(item.motivoNovo) && !conhecido,
          sentimentoClasse,
          casoGrave,
          textoHash: candidato.textoHash,
          qualidadeFonte: candidato.qualidadeFonte,
          canal: candidato.canal,
          modelo: response.model || env.chamadoIaAnaliseModel,
        });
      }
    } catch (err) {
      console.warn(`[${feature}] lote falhou:`, mapOpenAiErrorMessage(err));
    }
  }

  return resultados;
}
