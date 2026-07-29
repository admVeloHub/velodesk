# Referência do prompt de classificação

Documentação extraída de `src/app/api/octadesk/analise-ia/route.ts` — use como base no CRM novo.

---

## System prompt (blocos, nesta ordem)

1. **Papel:** analista sênior de atendimento (fintech de crédito)
2. **Contexto da empresa** (`contextoEmpresa`)
3. **Instruções Outros** (`instrucoesOutros`) — desambiguação antes de cair em "Outros"
4. **Taxonomia conhecida** — lista de rótulos exatos
5. **Aliases** — `de → para` (sinônimos confirmados)
6. **Exemplos de contexto** — casos reais confirmados (few-shot), agrupados por motivo
7. **Motivos novos recentes** — rótulos criados nos últimos 30 dias (evita fragmentação)
8. **Tarefa + schema JSON** (ver abaixo)

---

## Formato de saída esperado (JSON)

```json
{
  "classificacoes": [
    {
      "ticket": 100123456,
      "motivo": "Reclamações sobre encerramento conta Celcoin",
      "motivoNovo": false,
      "sentimentoClasse": "irritado",
      "casoGrave": null
    }
  ]
}
```

`casoGrave` quando aplicável:

```json
{
  "tipo": "Procon",
  "trecho": "vou reclamar no Procon"
}
```

Tipos de caso grave: Bacen, Procon, Reclame Aqui, Ação judicial, Órgão regulador, Outro.

Sentimentos: `positivo`, `neutro`, `irritado`, `confuso`, `critico`.

---

## Regras principais (resumo)

- Classificar pelo **título + descrição do cliente**, não pela tabulação do CRM
- Preferir rótulo **exato** da taxonomia (copiar, não reescrever)
- `motivoNovo=true` só quando não encaixa em nenhum rótulo conhecido e há padrão identificável
- "Outros" só para casos realmente ambíguos
- Responder em português do Brasil

---

## User prompt (por lote)

JSON com array de tickets:

```json
[
  {
    "numero": 100123456,
    "canal": "App",
    "aberto_em": "2026-07-15T10:00:00Z",
    "titulo": "Não consigo ver saldo",
    "descricao_cliente": "..."
  }
]
```

Limites usados no WFM: título até 300 chars, descrição até 1200 chars (após `stripHtml`).

---

## Pós-processamento (após resposta da IA)

1. `resolverAlias(motivoBruto, aliases)` — troca exata de rótulo
2. `canonicalizarMotivo(motivo, taxonomia)` — Levenshtein para unificar variações triviais
3. Gravar cache com `texto_hash`, `contexto_versao`, `origem='auto'`
4. Correção manual → `origem='manual'` (sticky) + `salvarExemploContexto`

---

## Modelo e API

- Modelo padrão: `gpt-5-mini` (OpenAI Responses API)
- Lote: ~40 tickets por chamada (`CLASSIFICACAO_LOTE_SIZE`)
- Teto por requisição HTTP: `maxTickets` (padrão 200) — só tickets **sem cache válido**
- `reasoning.effort`: conforme `src/lib/openai/responses.ts`

---

## Invalidação de cache

Cache válido quando:

- `needs_reanalysis = false`
- `origem = 'manual'` → sempre válido (até gestor pedir reanálise)
- OU `texto_hash` igual ao hash atual do título+descrição
- Linhas antigas sem hash: fallback por `contexto_versao` + `ticket_last_date_update`
