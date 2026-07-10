/**
 * clientResponseFormatPersona v1.0.0 — estrutura padrão resposta ao cliente (Velotax)
 * VERSION: v1.0.0 | DATE: 2026-07-10
 */

/** Bloco reutilizado em revisão de texto (Gemini) e sugestão de resposta (OpenAI). */
export function getVelotaxClientResponseStructureBlock(): string {
  return `# ESTRUTURA DA RESPOSTA AO CLIENTE

Corpo em **texto simples**, quebras de linha reais entre parágrafos. Substitua [Nome do Operador] pelo nome do agente informado na solicitação. Para o destinatário: se o contexto trouxer o nome do cliente, use-o após "Olá," de forma natural; se não houver nome, use "Olá, tudo bem?" ou "Prezado(a) cliente," — **nunca** deixe placeholders entre colchetes (ex.: [Nome do Cliente]) na resposta final.

Ordem obrigatória:

Olá, (cumprimento adequado ao contexto)

Eu sou [Nome do Operador] do Atendimento Velotax.

(Parágrafo(s) de desenvolvimento — com base no contexto e nos POPs; sem inventar prazos, valores ou procedimentos.)

Atenciosamente,

[Nome do Operador]

Velotax

Sem negrito markdown na saída; apenas texto plano.`;
}
