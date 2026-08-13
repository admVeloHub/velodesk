# API Inbound Tickets — Agente IA Telefônico

<!-- VERSION: v1.0.0 | DATE: 2026-08-13 | AUTHOR: VeloHub Development Team -->

Documento para **homologação e uso** da API de **abertura de tickets** no Velodesk após atendimento do **Agente IA Telefônico** (Contact Tel / LetícIA).

- **Coleção MongoDB:** `b2c_chamados.chamados_n1`
- **Backend:** `desk/backend` — rota em `backend/src/routes/inbound.routes.ts`
- **Canal aplicado automaticamente pelo servidor:** **`Agente IA`**

> **Importante:** este endpoint **cria** o chamado no Desk. Não confundir com `POST /api/inbound/telephony/calls`, que **registra a ligação** em `telephony_calls` para o módulo Atendimento IA Telefônico. Os dois fluxos são complementares: ligação → `telephony/calls`; abertura de ticket para o agente humano → este endpoint.

---

## URL base (produção)

**Base URL:** `https://velodesk-278491073220.us-east1.run.app`

| Endpoint | URL completa |
|----------|--------------|
| Health | `https://velodesk-278491073220.us-east1.run.app/api/inbound/tickets/health` |
| Criar ticket | `https://velodesk-278491073220.us-east1.run.app/api/inbound/tickets` |

---

## Autenticação e segurança

A rota `POST /api/inbound/tickets` exige **somente** os headers abaixo:

```http
Content-Type: application/json
X-Inbound-Agente-Ia-Secret: <chave_35_caracteres>
```

| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `Content-Type` | Sim | `application/json` |
| `X-Inbound-Agente-Ia-Secret` | Sim | Chave exclusiva do Agente IA (`INBOUND_TICKET_AGENTE_IA_SECRET` no servidor Velodesk) |

### Formato da chave

- Exatamente **35 caracteres**
- Apenas letras minúsculas (`a-z`) e números (`0-9`)
- Exemplo de formato: `m3n8q1w6e9r2t5y0u4i7o1p6a3s8d2f5g0h4j7k9l2`

A chave real será entregue **separadamente** pela equipe VeloHub — não commitar em repositórios.

### Respostas de autenticação

| HTTP | Corpo | Causa |
|------|-------|-------|
| `401` | `{ "message": "Header de autenticação inbound ticket ausente" }` | Header `X-Inbound-Agente-Ia-Secret` ausente |
| `401` | `{ "message": "Chave inbound ticket inválida — use 35 caracteres [a-z0-9]" }` | Formato da chave incorreto |
| `401` | `{ "message": "Chave inbound ticket incorreta" }` | Valor da chave errado |
| `503` | `{ "message": "Inbound tickets desabilitado" }` | `INBOUND_TICKETS_ENABLED=false` |
| `503` | `{ "message": "Inbound tickets desabilitado — secret ausente (agente-ia)" }` | Produção sem secret configurado |

---

## Health check (sem autenticação)

```http
GET https://velodesk-278491073220.us-east1.run.app/api/inbound/tickets/health
```

**Resposta `200`:**

```json
{
  "status": "ok",
  "enabled": true,
  "apiVersion": "1.0.0",
  "origins": ["app", "telefone", "agente-ia"],
  "secretFormat": "[a-z0-9]{35}"
}
```

---

## POST — Criar ticket (Agente IA)

```http
POST https://velodesk-278491073220.us-east1.run.app/api/inbound/tickets
Content-Type: application/json
X-Inbound-Agente-Ia-Secret: <chave_35_caracteres>
```

### Payload

**Obrigatórios:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `externalId` | string | ID único da ligação/atendimento (recomendado: `id` da call Contact Tel) |
| `title` ou `chamadoTitulo` | string | Título do chamado |
| `text` ou `description` | string | Resumo ou transcrição da ligação |
| `clientName` | string | Nome do cliente |

**Identificação do cliente (ao menos um):**

| Campo | Tipo |
|-------|------|
| `clientCPF` | string |
| `clientPhone` | string |
| `clientEmail` | string |

**Opcionais recomendados para telefonia IA:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `responsavel` | string | Agente humano que assumirá o ticket |
| `clientPhone` | string | Telefone E.164 ou BR (ex.: `5511999990001`) |
| `clientCPF` | string | CPF coletado na ligação (`variables.cpf`) |
| `metadata.telephonyCallId` | string | `_id` do documento em `telephony_calls` no Desk (se já registrado via `telephony/calls`) |
| `metadata` | object | Outros dados da ligação (campanha, intenção, etc.) |

**Opcionais gerais:**

| Campo | Tipo |
|-------|------|
| `attachments` | string[] |
| `priority` | `baixa`, `media`, `alta` |
| `produto`, `motivo`, `detalhe` | string |

**Não enviar:**

- `canal` — ignorado; o servidor grava **`Agente IA`** automaticamente

### Exemplo

```json
{
  "externalId": "2ced4103-faa2-44ec-8b8e-7a86bbd2d410",
  "title": "Ligação IA — Mariana Silva",
  "text": "Cliente pediu continuidade por WhatsApp. Resumo: aceitou receber link no WhatsApp.",
  "clientName": "Mariana Silva",
  "clientPhone": "5511999990001",
  "clientCPF": "12345678901",
  "responsavel": "Mariana Operacoes",
  "metadata": {
    "telephonyCallId": "674a1b2c3d4e5f6789012345",
    "agentName": "Bia Comercial",
    "callStatus": "completed"
  }
}
```

### Respostas

**`201` — ticket criado:**

```json
{
  "action": "created",
  "ticketId": "674a1b2c3d4e5f6789012345",
  "chamadoProtocolo": "VD-20260813-0042",
  "canal": "Agente IA"
}
```

**`200` — retry com mesmo `externalId`:**

```json
{
  "action": "duplicate",
  "ticketId": "674a1b2c3d4e5f6789012345",
  "chamadoProtocolo": "VD-20260813-0042",
  "canal": "Agente IA"
}
```

---

## Fluxo recomendado com telephony/calls

```mermaid
sequenceDiagram
  participant CT as Contact_Tel
  participant Calls as POST_telephony_calls
  participant Tickets as POST_inbound_tickets
  participant Desk as chamados_n1

  CT->>Calls: Payload completo da ligação
  Calls-->>CT: callId
  CT->>Tickets: externalId=id_da_ligação + resumo
  Tickets->>Desk: Ticket canal Agente IA
  Tickets-->>CT: chamadoProtocolo
```

1. Enviar ligação para `POST /api/inbound/telephony/calls` (registro + módulo IA Telefônico)
2. Quando houver necessidade de ticket no Desk, chamar este endpoint com `externalId` = `id` da ligação
3. Opcional: incluir `metadata.telephonyCallId` com o `callId` retornado pelo passo 1

---

## Exemplo curl

```powershell
curl.exe -s -X POST "https://velodesk-278491073220.us-east1.run.app/api/inbound/tickets" `
  -H "Content-Type: application/json" `
  -H "X-Inbound-Agente-Ia-Secret: <chave_35_caracteres>" `
  -d "{\"externalId\":\"2ced4103-faa2-44ec-8b8e-7a86bbd2d410\",\"title\":\"Ligação IA — Mariana Silva\",\"text\":\"Cliente pediu continuidade por WhatsApp.\",\"clientName\":\"Mariana Silva\",\"clientPhone\":\"5511999990001\",\"clientCPF\":\"12345678901\",\"responsavel\":\"Mariana Operacoes\"}"
```

---

## Checklist de homologação (Agente IA)

- [ ] `GET /api/inbound/tickets/health` retorna `enabled: true`
- [ ] `POST /api/inbound/tickets` com `X-Inbound-Agente-Ia-Secret` correto retorna `201 created`
- [ ] Retry com mesmo `externalId` retorna `200 duplicate`
- [ ] Requisição sem header retorna `401`
- [ ] Ticket no Desk com canal **Agente IA**
- [ ] Protocolo retornado na resposta
- [ ] (Opcional) Ligação ainda visível em Atendimento IA Telefônico via `telephony/calls`

---

## Referências internas VeloHub

| Recurso | Caminho |
|---------|---------|
| Rotas inbound | `backend/src/routes/inbound.routes.ts` |
| Serviço tickets | `backend/src/services/inbound-ticket/inboundTicket.service.ts` |
| Auth Agente IA | `backend/src/middleware/inboundTicketAuth.ts` |
| Registro de ligação (fluxo separado) | `docs/api-inbound-telephony-parceiro.md` |
