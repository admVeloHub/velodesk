# API Inbound Tickets — App Integrado

<!-- VERSION: v1.0.0 | DATE: 2026-08-13 | AUTHOR: VeloHub Development Team -->

Documento para **homologação e uso** da API de **abertura de tickets** no Velodesk a partir do **App integrado**.

- **Coleção MongoDB:** `b2c_chamados.chamados_n1`
- **Backend:** `desk/backend` — rota em `backend/src/routes/inbound.routes.ts`
- **Canal aplicado automaticamente pelo servidor:** **`App`**

> **Importante:** este endpoint **cria** o chamado no Desk. Não confundir com `POST /api/inbound/app-notify`, que apenas complementa um chamado **já inserido** no Mongo (protocolo, atribuição e hooks).

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
X-Inbound-App-Secret: <chave_35_caracteres>
```

| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `Content-Type` | Sim | `application/json` |
| `X-Inbound-App-Secret` | Sim | Chave exclusiva do App (`INBOUND_TICKET_APP_SECRET` no servidor Velodesk) |

### Formato da chave

- Exatamente **35 caracteres**
- Apenas letras minúsculas (`a-z`) e números (`0-9`)
- Exemplo de formato: `k7m2p9x4n1q8w3e6r0t5y2u8i4o7a1b9c3d6f0g2h5`

A chave real será entregue **separadamente** pela equipe VeloHub — não commitar em repositórios.

### Respostas de autenticação

| HTTP | Corpo | Causa |
|------|-------|-------|
| `401` | `{ "message": "Header de autenticação inbound ticket ausente" }` | Header `X-Inbound-App-Secret` ausente |
| `401` | `{ "message": "Chave inbound ticket inválida — use 35 caracteres [a-z0-9]" }` | Formato da chave incorreto |
| `401` | `{ "message": "Chave inbound ticket incorreta" }` | Valor da chave errado |
| `503` | `{ "message": "Inbound tickets desabilitado" }` | `INBOUND_TICKETS_ENABLED=false` |
| `503` | `{ "message": "Inbound tickets desabilitado — secret ausente (app)" }` | Produção sem secret configurado |

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

## POST — Criar ticket (App)

```http
POST https://velodesk-278491073220.us-east1.run.app/api/inbound/tickets
Content-Type: application/json
X-Inbound-App-Secret: <chave_35_caracteres>
```

### Payload

**Obrigatórios:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `externalId` | string | ID único do chamado no App (idempotência em retry) |
| `title` ou `chamadoTitulo` | string | Título do chamado |
| `text` ou `description` | string | Descrição / relato do cliente |
| `clientName` | string | Nome do cliente |

**Identificação do cliente (ao menos um):**

| Campo | Tipo |
|-------|------|
| `clientCPF` | string |
| `clientPhone` | string |
| `clientEmail` | string |

**Opcionais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `attachments` | string[] | URLs de anexos já hospedados |
| `priority` | string | `baixa`, `media` ou `alta` |
| `produto`, `motivo`, `detalhe` | string | Tabulação |
| `tipoChamado` / `classificacaoTipo` | string | Default: `Solicitação` |
| `metadata` | object | Dados extras (ex.: `appSessionId`, tela de origem) |

**Não enviar:**

- `canal` — ignorado; o servidor grava **`App`** automaticamente

### Exemplo

```json
{
  "externalId": "app-ticket-20260813-001",
  "title": "Não consigo ver saldo",
  "text": "Cliente relata erro ao abrir extrato no app.",
  "clientName": "Mariana Silva",
  "clientCPF": "12345678901",
  "metadata": {
    "appSessionId": "sess-abc-123",
    "telaOrigem": "extrato"
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
  "canal": "App"
}
```

**`200` — retry com mesmo `externalId` (idempotente):**

```json
{
  "action": "duplicate",
  "ticketId": "674a1b2c3d4e5f6789012345",
  "chamadoProtocolo": "VD-20260813-0042",
  "canal": "App"
}
```

**`400` — payload inválido:**

```json
{
  "message": "externalId é obrigatório"
}
```

---

## Exemplo curl

```powershell
curl.exe -s -X POST "https://velodesk-278491073220.us-east1.run.app/api/inbound/tickets" `
  -H "Content-Type: application/json" `
  -H "X-Inbound-App-Secret: <chave_35_caracteres>" `
  -d "{\"externalId\":\"app-ticket-20260813-001\",\"title\":\"Não consigo ver saldo\",\"text\":\"Cliente relata erro ao abrir extrato.\",\"clientName\":\"Mariana Silva\",\"clientCPF\":\"12345678901\"}"
```

---

## Checklist de homologação (App)

- [ ] `GET /api/inbound/tickets/health` retorna `enabled: true`
- [ ] `POST /api/inbound/tickets` com `X-Inbound-App-Secret` correto retorna `201 created`
- [ ] Retry com mesmo `externalId` retorna `200 duplicate` (sem ticket duplicado)
- [ ] Requisição sem header retorna `401`
- [ ] Chave com formato errado retorna `401`
- [ ] Ticket aparece no Desk com canal **App**
- [ ] Protocolo `VD-YYYYMMDD-####` retornado na resposta

---

## Referências internas VeloHub

| Recurso | Caminho |
|---------|---------|
| Rotas inbound | `backend/src/routes/inbound.routes.ts` |
| Serviço | `backend/src/services/inbound-ticket/inboundTicket.service.ts` |
| Auth App | `backend/src/middleware/inboundTicketAuth.ts` |
| Notify legado (não substitui este endpoint) | `backend/src/services/app-inbound.service.ts` |
