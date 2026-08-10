/**
 * clientResponseFormatPersona v1.2.0 — núcleo IA only (abertura/fechamento fora da IA)
 * VERSION: v1.2.0 | DATE: 2026-08-10
 */

/** Regras anti-eco — reutilizadas em sugestão, agentes e revisão. */
export function getAntiEchoAndClicheRulesBlock(): string {
  return `# REGRAS DE NATURALIDADE (OBRIGATÓRIO — violação invalida a resposta)

O cliente JÁ sabe o que perguntou ou relatou. Não recapitule, não confirme e não parafraseie a mensagem dele. Nunca repita a mensagem do cliente no início da resposta.

PROIBIDO em respostaSugerida (NÚCLEO):
- Ecoar ou resumir a pergunta/reclamação ("Entendo que você quer...", "Compreendo que...", "Sobre sua dúvida de...", "Vi que você mencionou...", "Referente ao que você disse...", "Entendo sua preocupação com...").
- Saudação, cumprimento ou apresentação ("Olá", "tudo bem?", "Eu sou [nome] do Atendimento Velotax").
- Box de protocolo, CTA de resposta, despedida institucional, assinatura "Time de Atendimento Velotax" ou rodapé — isso é montado fora da IA (composer ou máscara de envio).
- Aberturas genéricas de chatbot ("Espero que esteja bem", "Como posso ajudá-lo hoje?", "Fico feliz em ajudar").

OBRIGATÓRIO:
- Ir direto à solução, passos ou orientação operacional (POP) — conteúdo deve começar sem preâmbulo.
- Tom humano, conciso e profissional em PT-BR.
- Parágrafos curtos com quebras de linha reais quando necessário.
- Se conversa em andamento, considere o contexto (inclusive anotações internas) sem vazá-las.
- Nome do agente NÃO entra no núcleo — abertura mecânica e assinatura são aplicadas depois.`;
}

/** Bloco reutilizado em revisão de texto (Gemini) e sugestão de resposta (OpenAI). */
export function getVelotaxClientResponseStructureBlock(): string {
  return `${getAntiEchoAndClicheRulesBlock()}

# ESTRUTURA DO NÚCLEO (campo respostaSugerida)

A IA retorna SOMENTE o núcleo operacional — conteúdo direto ao cliente, sem envelope.

Camadas fora da IA (não incluir em respostaSugerida):
1. Abertura mecânica no composer (saudação + apresentação no 1º contato) — aplicada ao clicar "Usar resposta".
2. Fechamento visual na máscara de envio (box protocolo, CTA, assinatura, rodapé) — aplicado no dispatch e-mail/WPP.

Corpo em **texto simples**, quebras de linha reais entre parágrafos.
- **Nunca** deixe placeholders entre colchetes (ex.: [Nome do Cliente]) na resposta final.
- E-mail e WhatsApp: 2–4 parágrafos objetivos com o conteúdo operacional.
- Sem negrito markdown na saída; apenas texto plano.`;
}

/** @deprecated alias — use getVelotaxClientResponseStructureBlock */
export const getClientResponseStructureBlock = getVelotaxClientResponseStructureBlock;
