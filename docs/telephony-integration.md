# Integração Atendimento IA Telefônico — Contact Tel

A Contact Tel (fornecedora da Letícia) **envia** o payload completo ao fim de cada ligação via webhook e **consulta** recados emergenciais antes de cada atendimento. O Velodesk **não** chama o GET `https://api.contact-tel.contactpro.com.br/public/v1/calls/{id}/` — esse endpoint serve apenas como referência do formato dos dados.

## Autenticação

Todas as rotas inbound exigem o header:

```
X-Inbound-Secret: <INBOUND_TELEPHONY_WEBHOOK_SECRET>
```

Em desenvolvimento, se o secret não estiver configurado, as rotas passam sem autenticação. Em produção, o secret é obrigatório.

## Endpoints inbound (Contact Tel → Velodesk)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/inbound/telephony/health` | Health check |
| POST | `/api/inbound/telephony/calls` | Recebe ligação encerrada |
| GET | `/api/inbound/telephony/recados` | Lista recados emergenciais ativos |

## POST /api/inbound/telephony/calls

A Contact Tel deve enviar o objeto completo da chamada (mesmo formato do PDF "Obter detalhes de chamada"), **sem** incluir gravação. O Velodesk remove automaticamente qualquer `recording_download_url` antes de persistir.

Exemplo resumido:

```json
{
  "id": "2ced4103-faa2-44ec-8b8e-7a86bbd2d410",
  "direction": "outbound",
  "call_type": "ai_agent",
  "status": "completed",
  "to_number": "5511999990001",
  "from_number": "551133330001",
  "duration": 120,
  "initiated_at": "2026-04-23T14:10:00Z",
  "answered_at": "2026-04-23T14:10:05Z",
  "ended_at": "2026-04-23T14:12:11Z",
  "agent_name": "Bia Comercial",
  "variables": { "nome": "Mariana", "cpf": "12345678901" },
  "data_collected": {
    "canal_preferido": { "value": "whatsapp" }
  },
  "segments": [
    {
      "segment_type": "ai",
      "transcript": "Agente: Oi, Mariana. Cliente: Pode mandar no WhatsApp.",
      "conversation_summary": "Cliente aceitou continuidade por WhatsApp.",
      "transcript_full": [
        { "role": "agent", "message": "Oi, Mariana.", "time_in_call_secs": 1.2 },
        { "role": "user", "message": "Pode mandar no WhatsApp.", "time_in_call_secs": 4.8 }
      ]
    }
  ]
}
```

Chamadas sem atendimento (`no_answer`, `busy`, `failed`, etc.) podem vir **sem** transcrição — basta enviar `id`, `status` e timestamps.

Respostas:

- `201` — `{ "action": "created", "callId": "...", "externalCallId": "..." }`
- `200` — `{ "action": "duplicate", ... }` (retry com mesmo `id`)

## Dados persistidos no Velodesk

| Grupo | Campos |
|-------|--------|
| Identificação | `externalCallId` (= `id`), `provider`, `canonicalUrl` |
| Classificação | `direction`, `origin`, `callType`, `status` |
| Cliente | telefone (por direção), nome/CPF de `variables`/`data_collected`, `clienteId` opcional |
| Tempo | `initiatedAt`, `answeredAt`, `endedAt`, `durationSeconds`, `ringDuration` |
| Resultado | `isConverted`, `isOptout`, `isMismatch`, `terminationOrigin` |
| Contexto | `agentName`, `campaignName`, `variables`, `dataCollected` |
| Conversa | `transcript`, `summary`, `transcriptFull` |
| Transferência | destino, atendente, ramal, espera |
| Auditoria | `rawPayload` sanitizado (sem URLs de gravação) |

**Não persistimos:** áudio, `recording_download_url`, Bearer token da Contact Tel.

## GET /api/inbound/telephony/recados

Resposta:

```json
{
  "updatedAt": "2026-07-29T15:00:00.000Z",
  "items": [
    {
      "id": "...",
      "titulo": "Envio de PIX com intermitência",
      "mensagem": "Informe ao cliente que estamos com instabilidade no PIX.",
      "prioridade": "alta"
    }
  ]
}
```

## API interna (JWT)

Gestores e agentes autenticados acessam via `/api/telephony/*`:

- `GET /api/telephony/calls` — lista paginada (filtros: período, telefone, CPF, status, direção, agente)
- `GET /api/telephony/calls/:id` — detalhe
- `GET /api/telephony/calls/stats` — KPIs (total, hoje, com CPF, convertidas)
- `GET/POST/PATCH/DELETE /api/telephony/recados` — CRUD de recados (escrita: supervisor)
- `GET /api/telephony/integration-info` — URLs e exemplo de payload Contact Tel

## Frontend

Página: `/atendimento-ia-telefonico`

Configuração: **Configurações → API Externa**

## Variáveis de ambiente

```
INBOUND_TELEPHONY_ENABLED=true
INBOUND_TELEPHONY_WEBHOOK_SECRET=seu-secret-aqui
TELEPHONY_AUTO_CREATE_TICKET=false
```

## Teste local

```powershell
cd velodesk/backend
npm run test:telephony-inbound
```

O script valida:
- chamada `completed` com transcrição e transferência;
- chamada `no_answer` sem transcrição;
- idempotência por `id`;
- remoção de `recording_download_url`;
- consulta de recados ativos.

## Homologação com Postman

1. `GET http://localhost:8001/api/inbound/telephony/health`
2. `POST http://localhost:8001/api/inbound/telephony/calls` com body do exemplo acima
3. Header `X-Inbound-Secret` (se configurado no `.env`)
4. Conferir em `http://localhost:8000/atendimento-ia-telefonico`
