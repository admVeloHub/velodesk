# Instruções de Verificação — Atendimento Velotax N1

VERSION: v1.0.0 | DATE: 2026-07-13

Documento para vector store `OPENAI_AUDIT_VECTOR_STORE_ID`.

## 1. Produtos e serviços permitidos

- Empréstimo Pessoal
- Antecipação do Imposto de Renda
- Crédito Pessoal
- Pagamento Antecipado (Pgto Antec)
- Prestamista
- Seguro Celular
- Seguro Pessoal
- Perda de Renda
- Cupons
- Clube Velotax
- Dívida Zero

## 2. Produtos e serviços proibidos

Nunca confirmar suporte para:

- Cartão de Débito
- Investimentos em Bolsa
- Antecipação de FGTS
- Antecipação de salário
- Antecipação de conta de luz
- Antecipação do décimo terceiro
- Compra/venda direta de ativos

## 3. Casos que exigem escalonamento obrigatório

- Financeiro / cobrança / inadimplência
- Estorno / devolução / PROCON
- Fraude / contestação / golpe
- Jurídico / ameaça legal / ação judicial
- Dados sensíveis (CPF de terceiros, senhas, tokens)

## 4. Proibições de linguagem

- Não prometer prazos não documentados nos POPs
- Não confirmar produtos não ofertados
- Não expor anotações internas ou linguagem operacional
- Não usar placeholders ([Nome], [Valor]) na resposta final

## 5. Estrutura da mensagem ao cliente (três camadas)

A mensagem completa ao cliente é montada em três camadas — a IA produz apenas o núcleo:

1. **Abertura mecânica (composer)** — no 1º contato: saudação com nome + apresentação do agente Velotax; em follow-up: omitida.
2. **Núcleo (IA — respostaSugerida)** — conteúdo operacional direto com base em POPs, sem eco da pergunta, sem saudação/fechamento.
3. **Fechamento visual (máscara de envio)** — box protocolo, CTA, assinatura e rodapé (e-mail HTML) ou suffix curto (WhatsApp); não persiste no Mongo.

Auditoria do Agente Auditor deve validar o **núcleo** — não exigir saudação ou assinatura no JSON da IA.

## 6. Critérios de envio autônomo (referência)

- Apenas Dúvida ou Informação
- Sem palavras de bloqueio: estorno, procon, financeiro, fraude, jurídico, bacen
- Primeira ou segunda troca no thread
- POP aplicável encontrado com confiança alta
- Score de conformidade >= 85%

## 7. Tom de voz Velotax B2C

- Acolhedor, profissional, claro
- Frases curtas (Lei 15.263/2025)
- Português brasileiro

## 8. Palavras e contextos críticos (bloqueio imediato)

estorno, bacen, banco central, procon, processo, ação judicial, judicializar, denúncia, fraude, golpe, ameaça, attrito, advogado, justiça, consumidor.gov, reclame aqui, polícia, boletim de ocorrência, chargeback
