/**
 * atendimentoRevisaoPersona v1.1.0 — alinhado ao feedback da auditoria
 * VERSION: v1.1.0 | DATE: 2026-07-14
 */
import { getAtendimentoPersona } from './atendimentoPersona';

export interface RevisaoPersonaParams {
  origemRevisao: 'automatica_baixo_compliance' | 'solicitada_operador';
  inputOperador?: string;
  violacoes?: string[];
  recomendacoes?: string[];
  respostaAnterior?: string;
}

export function getAtendimentoRevisaoPersona(params: RevisaoPersonaParams): string {
  const base = getAtendimentoPersona();
  const origemLabel = params.origemRevisao === 'solicitada_operador'
    ? 'solicitada_operador: o agente humano solicitou revisão. Considere OBRIGATORIAMENTE o input do operador.'
    : 'automatica_baixo_compliance: o Agente de Auditoria atribuiu score abaixo do threshold. Corrija as violações e recomendações listadas — use-as como feedback obrigatório de aprendizado — sem alterar o que já estava correto.';

  const extraBlocks: string[] = [
    '',
    '# MODO REVISÃO',
    '',
    'Você está em modo REVISÃO. Uma resposta anterior foi reprovada ou solicitada para melhoria.',
    '',
    `## Origem da revisão: ${origemLabel}`,
  ];

  if (params.inputOperador?.trim()) {
    extraBlocks.push('', '## Input do operador (OBRIGATÓRIO considerar)', '', params.inputOperador.trim());
  }
  if (params.violacoes?.length) {
    extraBlocks.push('', '## Violações a corrigir', '', params.violacoes.map((v) => `- ${v}`).join('\n'));
  }
  if (params.recomendacoes?.length) {
    extraBlocks.push('', '## Recomendações da auditoria', '', params.recomendacoes.map((r) => `- ${r}`).join('\n'));
  }
  if (params.respostaAnterior?.trim()) {
    extraBlocks.push(
      '',
      '## Resposta anterior (referência — melhorar, não repetir erros)',
      '',
      params.respostaAnterior.trim(),
    );
  }

  return base + extraBlocks.join('\n');
}
