# Agentes Paralelos — VeloDesk

VERSION: v1.0.0 | DATE: 2026-07-13

## Visão geral

Programa de três agentes IA no backend do Desk:

| Agente | Competência |
|--------|-------------|
| **Atendimento** | Compõe resposta + tabulação (vector stores pública + POPs) |
| **Auditoria** | Valida conformidade, decide revisão/envio/human handoff |
| **Gestão de Chamados** | SLA, filas, picos inbound, handoff crítico, alertas |

## Ativação

```env
AGENTS_ENABLED=true
AGENTS_AUTONOMY_ENABLED=false   # Fase 1: só sugestão + auditoria no Desk
OPENAI_POP_VECTOR_STORE_ID=vs_...
OPENAI_PUBLIC_VECTOR_STORE_ID=vs_...
OPENAI_AUDIT_VECTOR_STORE_ID=vs_...   # upload docs/vector-stores/INSTRUCOES-VERIFICACAO.md
```

## Thresholds

| Modo | Threshold | Ação se abaixo |
|------|-----------|----------------|
| Envio automático (inbound) | 85% | Revisão Agente 1 (máx. 2x) |
| Sugestão Desk | 70% | Revisão automática Agente 1 |

Palavras críticas bloqueiam envio autônomo e acionam Agente 3 (handoff).

## Endpoints (`/api/agents/*`)

- `GET /status` — configuração
- `POST /pipeline` — pipeline completo
- `POST /revisar-sugestao` — revisão com input do operador
- `POST /auditoria` — auditoria compliance (supervisor)
- `GET/POST/PUT/DELETE /autonomy-rules` — regras de autonomia
- `GET /feedback` — histórico de aprendizado
- `GET /gestao/alerts` — alertas operacionais
- `POST /gestao/handoff` — handoff crítico manual
- `POST /gestao/run` — ciclo manual do job

## Retrocompatibilidade

`POST /api/ticket-ai/suggest` delega ao orquestrador quando `AGENTS_ENABLED=true`.
Resposta estendida inclui `auditScore`, `auditAprovado`, `confidence`.

## Coleções Mongo (b2c_chamados)

- `agent_feedback` — aprendizado
- `agent_autonomy_rules` — regras de envio autônomo
- `agent_gestao_alerts` — alertas do Agente 3

## Vector store de auditoria

Criar store na OpenAI e fazer upload de `docs/vector-stores/INSTRUCOES-VERIFICACAO.md`.
Definir `OPENAI_AUDIT_VECTOR_STORE_ID` no ambiente.
