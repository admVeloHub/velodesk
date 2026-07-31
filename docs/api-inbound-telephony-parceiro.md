# API Inbound Telefonia IA — Guia para Parceira (Contact Tel)

<!-- VERSION: v1.0.1 | DATE: 2026-07-31 | AUTHOR: VeloHub Development Team -->

Documento para **homologação e uso** da API que recebe ligações da IA telefônica e consulta recados emergenciais.

- **Coleção MongoDB:** `b2c_chamados.telephony_calls`
- **Schema canônico:** `FONTE DA VERDADE/DESK_LISTA_SCHEMAS.rb` (bloco `telephony_calls`)
- **Backend:** `desk/backend` — rotas em `backend/src/routes/inbound.routes.ts`

---

## URL base (produção)

**Base URL:** `https://velodesk-278491073220.us-east1.run.app`

| Endpoint | URL completa |
|----------|--------------|
| Health | `https://velodesk-278491073220.us-east1.run.app/api/inbound/telephony/health` |
| Registrar ligação | `https://velodesk-278491073220.us-east1.run.app/api/inbound/telephony/calls` |
| Recados ativos | `https://velodesk-278491073220.us-east1.run.app/api/inbound/telephony/recados` |

Todas as rotas usam o prefixo `/api/inbound/telephony` sobre a base acima.

---

## Autenticação e segurança

Rotas **protegidas** (`POST /calls`, `GET /recados`) exigem o header:

```http
X-Inbound-Secret: ulzj7zwywpw3u3rmliwfesp7z6bor8zb
```

| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `Content-Type` | Sim (POST) | `application/json` |
| `X-Inbound-Secret` | Sim | Secret compartilhado (`INBOUND_TELEPHONY_WEBHOOK_SECRET` no servidor Velodesk) |

**Produção:** secret **obrigatório** — requisição sem header ou com valor incorreto retorna `401`.

### Respostas de autenticação

| HTTP | Corpo | Causa |
|------|-------|-------|
| `401` | `{ "message": "Secret inbound telefonia inválido" }` | Header ausente ou valor errado |
| `503` | `{ "message": "Inbound telefonia desabilitado" }` | `INBOUND_TELEPHONY_ENABLED=false` |
| `503` | `{ "message": "Inbound telefonia desabilitado — secret ausente" }` | Produção sem secret configurado |

---

## Endpoints

### 1. Health check (sem autenticação)

Valida conectividade e se a integração está ativa.

```http
GET https://velodesk-278491073220.us-east1.run.app/api/inbound/telephony/health
```

**Resposta `200`:**

```json
{
  "status": "ok",
  "enabled": true,
  "apiVersion": "1.0.0",
  "activeRecados": 2,
  "lastRecadoUpdate": "2026-07-29T18:41:56.527Z"
}
```

| Campo | Significado |
|-------|-------------|
| `enabled` | Integração telefonia ativa no servidor |
| `activeRecados` | Quantidade de recados emergenciais ativos |
| `lastRecadoUpdate` | Última atualização de recado ativo (ISO 8601) ou `null` |

---

### 2. Registrar ligação encerrada

Envia o payload completo da ligação ao fim do atendimento. O Velodesk **persiste** em `telephony_calls` e **não** cria ticket automaticamente na v1 (`ticketStatus: none`).

```http
POST https://velodesk-278491073220.us-east1.run.app/api/inbound/telephony/calls
Content-Type: application/json
X-Inbound-Secret: ulzj7zwywpw3u3rmliwfesp7z6bor8zb
```

#### Payload — chamada atendida (`completed`)

Formato Contact Tel (snake_case), alinhado ao PDF *"Obter detalhes de chamada"*.  
**Não enviar** URLs de gravação — o servidor remove `recording_download_url` antes de persistir.

```json
{
  "id": "2ced4103-faa2-44ec-8b8e-7a86bbd2d410",
  "canonical_url": "https://contact-tel.contactpro.com.br/calls?call=2ced4103-faa2-44ec-8b8e-7a86bbd2d410",
  "direction": "outbound",
  "origin": "public_api",
  "call_type": "ai_agent",
  "status": "completed",
  "to_number": "5511999990001",
  "from_number": "551133330001",
  "duration": 120,
  "ring_duration": 4,
  "is_converted": true,
  "is_optout": false,
  "is_mismatch": false,
  "initiated_at": "2026-04-23T14:10:00Z",
  "answered_at": "2026-04-23T14:10:05Z",
  "ended_at": "2026-04-23T14:12:11Z",
  "campaign_contact_display_name": "Mariana",
  "agent_id": "f08c1745-2f11-4fb4-aab1-d120fb7251ce",
  "agent_name": "Bia Comercial",
  "variables": {
    "nome": "Mariana",
    "cpf": "12345678901",
    "plano": "premium"
  },
  "data_collected": {
    "canal_preferido": {
      "value": "whatsapp",
      "rationale": "Cliente pediu continuidade pelo WhatsApp."
    }
  },
  "telephony_transfer_started_at": "2026-04-23T14:11:00Z",
  "telephony_transfer_wait_ms": 13000,
  "transfer_destination_type": "internal_extension",
  "transfer_destination_value": "4010",
  "transfer_target_user_name": "Mariana Operacoes",
  "transfer_target_user_extension": "4010",
  "interaction_answered_by_name": "Mariana Operacoes",
  "interaction_answered_at": "2026-04-23T14:11:18Z",
  "termination_origin": "system",
  "segments": [
    {
      "segment_type": "ai",
      "transcript": "Agente: Oi, Mariana. Cliente: Pode mandar no WhatsApp.",
      "conversation_summary": "Cliente aceitou continuidade por WhatsApp.",
      "transcript_full": [
        {
          "role": "agent",
          "message": "Oi, Mariana.",
          "original_message": "Oi, Mariana.",
          "time_in_call_secs": 1.2
        },
        {
          "role": "user",
          "message": "Pode mandar no WhatsApp.",
          "original_message": null,
          "time_in_call_secs": 4.8
        }
      ]
    }
  ]
}
```

#### Payload mínimo — sem atendimento (`no_answer`, `busy`, `failed`, …)

Chamadas sem conversa podem vir **sem** `segments` e **sem** transcrição:

```json
{
  "id": "test-contact-tel-no-answer-001",
  "direction": "outbound",
  "call_type": "ai_agent",
  "status": "no_answer",
  "to_number": "5511988887777",
  "from_number": "551133330001",
  "duration": 0,
  "ring_duration": 30,
  "is_converted": false,
  "initiated_at": "2026-07-29T10:00:00Z",
  "ended_at": "2026-07-29T10:00:30Z",
  "agent_name": "Leticia IA",
  "segments": []
}
```

#### Campos obrigatórios (validação)

| Campo | Regra |
|-------|-------|
| `id` | Obrigatório — identificador único da ligação na parceira |
| `status` **ou** timestamp | Ao menos um entre `initiated_at`, `answered_at`, `ended_at`, `created_at` |
| Conteúdo | Para status atendido: `transcript` ou `conversation_summary` (via `segments` ou raiz) |
| Status sem atendimento | `no_answer`, `busy`, `failed`, etc. — basta `id`, `status` e timestamps |

#### Respostas de sucesso

**`201 Created`** — primeira vez que o `id` é recebido:

```json
{
  "action": "created",
  "callId": "6789abcd0123456789012345",
  "externalCallId": "2ced4103-faa2-44ec-8b8e-7a86bbd2d410"
}
```

**`200 OK`** — retry com o mesmo `id` (idempotente):

```json
{
  "action": "duplicate",
  "callId": "6789abcd0123456789012345",
  "externalCallId": "2ced4103-faa2-44ec-8b8e-7a86bbd2d410"
}
```

#### Erros

| HTTP | Exemplo | Causa |
|------|---------|-------|
| `400` | `{ "message": "id é obrigatório" }` | Payload inválido |
| `400` | `{ "message": "Informe transcript ou conversation_summary para chamadas atendidas" }` | `completed` sem transcrição/resumo |
| `401` | Secret inválido | Ver autenticação |
| `500` | `{ "message": "Falha ao processar ligação inbound" }` | Erro interno |

#### Mapeamento payload → `telephony_calls`

| Payload (Contact Tel) | Campo MongoDB |
|----------------------|---------------|
| `id` | `externalCallId` |
| — | `provider` = `'contact-tel'` |
| `canonical_url` | `canonicalUrl` |
| `direction`, `origin`, `call_type`, `status` | `direction`, `origin`, `callType`, `status` |
| `to_number` / `from_number` (por direção) | `clientPhone` |
| `variables` / `data_collected` / `campaign_contact_display_name` | `clientName`, `clientCpf`, `variables`, `dataCollected` |
| `initiated_at`, `answered_at`, `ended_at` | `initiatedAt`, `answeredAt`, `endedAt` |
| `duration`, `ring_duration` | `durationSeconds`, `ringDuration` |
| `is_converted`, `is_optout`, `is_mismatch` | `isConverted`, `isOptout`, `isMismatch` |
| `agent_id`, `agent_name` | `agentId`, `agentName` |
| `segments[].transcript` | `transcript` |
| `segments[].conversation_summary` | `summary` |
| `segments[].transcript_full` | `transcriptFull[]` |
| Campos `transfer_*`, `interaction_*` | `transfer` |
| Payload completo sanitizado | `rawPayload` |

---

### 3. Consultar recados emergenciais

Antes de cada ligação, a parceira consulta recados ativos cadastrados no Velodesk (ex.: instabilidade PIX).

```http
GET https://velodesk-278491073220.us-east1.run.app/api/inbound/telephony/recados
X-Inbound-Secret: ulzj7zwywpw3u3rmliwfesp7z6bor8zb
```

**Resposta `200` — com recados:**

```json
{
  "updatedAt": "2026-07-29T18:41:56.527Z",
  "items": [
    {
      "id": "6789abcd0123456789012345",
      "titulo": "Envio de PIX com intermitência",
      "mensagem": "Informe ao cliente que estamos com instabilidade no PIX.",
      "prioridade": "alta"
    }
  ]
}
```

**Resposta `200` — sem recados ativos:**

```json
{
  "updatedAt": "2026-07-31T20:00:00.000Z",
  "items": []
}
```

| Campo | Significado |
|-------|-------------|
| `updatedAt` | Timestamp ISO da última atualização entre os recados retornados |
| `items[].prioridade` | `alta` \| `media` \| `baixa` — ordenação: alta primeiro |

Recados são cadastrados por supervisores no Desk em [Atendimento IA Telefônico](https://velodesk-278491073220.us-east1.run.app/atendimento-ia-telefonico) ou **Configurações → API Externa**.

---

## Instruções de homologação

### Pré-requisitos no servidor Velodesk

```env
INBOUND_TELEPHONY_ENABLED=true
INBOUND_TELEPHONY_WEBHOOK_SECRET=ulzj7zwywpw3u3rmliwfesp7z6bor8zb
```

### Passo 1 — Health

```powershell
curl.exe -s https://velodesk-278491073220.us-east1.run.app/api/inbound/telephony/health
```

Esperado: `"status":"ok"` e `"enabled":true`.

### Passo 2 — POST ligação (completed)

Salve o JSON de exemplo em `payload-completed.json` e execute:

```powershell
curl.exe -s -X POST https://velodesk-278491073220.us-east1.run.app/api/inbound/telephony/calls `
  -H "Content-Type: application/json" `
  -H "X-Inbound-Secret: ulzj7zwywpw3u3rmliwfesp7z6bor8zb" `
  --data-binary "@payload-completed.json"
```

Esperado: HTTP `201` com `"action":"created"`.

### Passo 3 — Idempotência

Repita o mesmo POST. Esperado: HTTP `200` com `"action":"duplicate"`.

### Passo 4 — POST ligação (no_answer)

Use um arquivo JSON (recomendado) ou `--data-binary` com payload mínimo. Esperado: HTTP `201`.

### Passo 5 — GET recados

```powershell
curl.exe -s https://velodesk-278491073220.us-east1.run.app/api/inbound/telephony/recados `
  -H "X-Inbound-Secret: ulzj7zwywpw3u3rmliwfesp7z6bor8zb"
```

Esperado: HTTP `200` com array `items` (pode estar vazio).

### Passo 6 — Conferência no Desk

Abrir [https://velodesk-278491073220.us-east1.run.app/atendimento-ia-telefonico](https://velodesk-278491073220.us-east1.run.app/atendimento-ia-telefonico) e verificar se a ligação aparece na listagem.

### Passo 7 — Teste automatizado (somente equipe VeloHub, ambiente interno)

```powershell
cd desk/backend
npm run test:telephony-inbound
```

Valida: completed + no_answer + idempotência + strip de gravação + recados.

---

## Checklist de validação

- [ ] `GET /health` retorna `status: ok` e `enabled: true`
- [ ] `POST /calls` com secret correto retorna `201 created`
- [ ] Retry com mesmo `id` retorna `200 duplicate`
- [ ] `POST /calls` sem secret em produção retorna `401`
- [ ] `POST /calls` com secret errado retorna `401`
- [ ] Chamada `no_answer` sem transcrição é aceita
- [ ] `GET /recados` retorna `200` com `items` (vazio ou preenchido)
- [ ] Ligação visível em [Atendimento IA Telefônico](https://velodesk-278491073220.us-east1.run.app/atendimento-ia-telefonico)
- [ ] `recording_download_url` não aparece no payload persistido

---

## O que **não** enviar

- URLs de gravação (`recording_download_url`) — serão descartadas
- Bearer token da Contact Tel
- Arquivos de áudio

---

## Referências internas VeloHub

| Recurso | Caminho |
|---------|---------|
| Rotas inbound | `backend/src/routes/inbound.routes.ts` |
| Processamento | `backend/src/services/telephony-inbound/telephonyInbound.service.ts` |
| Adapter Contact Tel | `backend/src/services/telephony-inbound/adapters/contact-tel.adapter.ts` |
| Visão geral integração | `docs/telephony-integration.md` |
| Config UI (URLs) | Desk → Configurações → API Externa |
