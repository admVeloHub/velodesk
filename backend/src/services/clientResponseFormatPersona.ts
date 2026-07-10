/**
 * clientResponseFormatPersona v1.0.1 — saudação com nome do cliente explícito
 * VERSION: v1.0.1 | DATE: 2026-07-10
 */

/** Bloco reutilizado em revisão de texto (Gemini) e sugestão de resposta (OpenAI). */
export function getVelotaxClientResponseStructureBlock(): string {
  return `# ESTRUTURA DA RESPOSTA AO CLIENTE

Corpo em **texto simples**, quebras de linha reais entre parágrafos.

- Substitua [Nome do Operador] pelo **Nome do agente** informado na solicitação.
- **OBRIGATÓRIO:** use o **Primeiro nome do cliente** (seção "Nome do cliente") na saudação. Exemplo: se o primeiro nome for "Maria", a primeira linha deve ser "Olá, Maria" (ou "Olá, Maria,") — nunca "Olá, tudo bem?" quando o nome estiver disponível.
- Se não houver nome do cliente na solicitação, use "Olá, tudo bem?" ou "Prezado(a) cliente,".
- **Nunca** deixe placeholders entre colchetes (ex.: [Nome do Cliente]) na resposta final.

Ordem obrigatória:

Olá, {primeiro nome do cliente quando informado}

Eu sou [Nome do Operador] do Atendimento Velotax.

(Parágrafo(s) de desenvolvimento — com base no contexto e nos POPs; sem inventar prazos, valores ou procedimentos.)

Atenciosamente,

[Nome do Operador]

Velotax

Sem negrito markdown na saída; apenas texto plano.`;
}
