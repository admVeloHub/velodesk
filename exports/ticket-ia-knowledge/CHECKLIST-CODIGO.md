# Checklist de código — o que copiar do WFM

Copie estes arquivos para o projeto do **novo CRM** e renomeie o namespace de `octadesk` para algo genérico (ex.: `ticketIa`).

## Libs genéricas (copiar quase intactas)

| Arquivo WFM | Responsabilidade |
|-------------|------------------|
| `src/lib/octadesk/analiseIaSettings.ts` | Taxonomia, aliases, contexto, versão |
| `src/lib/octadesk/analiseIaExemplos.ts` | Exemplos few-shot no prompt |
| `src/lib/octadesk/textoTicket.ts` | `stripHtml`, `truncate` |
| `src/lib/octadesk/textoHash.ts` | Hash do texto para invalidar cache |
| `src/lib/octadesk/analiseIaTypes.ts` | Tipos TypeScript da resposta |
| `src/lib/openai/responses.ts` | Cliente OpenAI Responses API |

## Lógica de classificação (extrair/adaptar)

| Arquivo WFM | O que extrair |
|-------------|---------------|
| `src/app/api/octadesk/analise-ia/route.ts` | `buildClassificacaoSystemPrompt`, `buildClassificacaoUserPrompt`, `canonicalizarMotivo`, fluxo cache + lotes |
| `src/app/api/octadesk/analise-ia/corrigir-motivo/route.ts` | Correção manual + `salvarExemploContexto` |
| `src/app/api/octadesk/ia-contexto/route.ts` | GET/POST das configs (admin) |
| `src/app/api/octadesk/ia-contexto/exemplos/route.ts` | Listar exemplos |
| `src/app/api/octadesk/ia-contexto/exemplos/[id]/route.ts` | Remover exemplo |

## UI de referência (opcional)

| Arquivo WFM | Uso |
|-------------|-----|
| `src/app/(dashboard)/octadesk/IaContextoEditor.tsx` | Editar contexto, taxonomia, aliases, exemplos |
| `src/app/(dashboard)/octadesk/AnaliseIACards.tsx` | Cards de análise + correção de motivo |

## NÃO copiar (específico Octadesk)

- `src/lib/octadesk/client.ts`, `sync-runner.ts`, `legacy-client.ts`
- `src/lib/octadesk/canalFiltro.ts`, `analiseIaElegibilidade.ts` (recrie regras de canal do CRM novo)
- `src/lib/octadesk/ticketsAbertosLive.ts`, KPIs, volumetria
- Scripts `backfill-analise-ia-octadesk.js`, `reanalisar-julho-pos-fix-aliases.js`

## Migrations de referência (WFM)

| Migration | Conteúdo |
|-----------|----------|
| `117_octadesk_ia_context_settings.sql` | Chaves iniciais em `system_settings` |
| `118_octadesk_ticket_ia_analise_cache.sql` | Cache por ticket |
| `119_octadesk_ia_texto_hash.sql` | Coluna `texto_hash` |
| `123_octadesk_ia_exemplo_motivo.sql` | Tabela de exemplos few-shot |

Versão genérica consolidada: `sql/schema-referencia.sql` neste pacote.

## Estrutura sugerida no projeto destino

```
src/lib/ticket-ia/
  settings.ts
  exemplos.ts
  textoTicket.ts
  textoHash.ts
  types.ts
  prompt.ts          ← buildClassificacaoSystemPrompt
  classify.ts        ← orquestração
src/lib/crm/         ← SEU CRM
  adapter.ts         ← map crmTicket → TicketParaClassificar
src/app/api/tickets/analise-ia/
  route.ts
  corrigir-motivo/route.ts
```

## Renomear chaves de configuração

| WFM | Sugestão genérica |
|-----|-------------------|
| `octadesk_ia_contexto_empresa` | `ticket_ia_contexto_empresa` |
| `octadesk_ia_instrucoes_outros` | `ticket_ia_instrucoes_outros` |
| `octadesk_ia_taxonomia_motivos` | `ticket_ia_taxonomia_motivos` |
| `octadesk_ia_motivo_aliases` | `ticket_ia_motivo_aliases` |
| `octadesk_ia_contexto_versao` | `ticket_ia_contexto_versao` |
| `octadesk_ia_max_tickets` | `ticket_ia_max_tickets` |

## Seed a partir deste pacote

Use `knowledge.json` na inicialização do banco ou num script `seed-ticket-ia.js` no projeto destino.
