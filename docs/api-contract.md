# Contrato API Velodesk v1.1.0

Mapeamento provisório: protótipo vanilla (`../dev - desk/`) → API REST → MongoDB.

> Schemas finais dependem do arquivo oficial de coleções VeloHub. Campos abaixo são provisórios.

## Endpoints Fase 1

| Método | Rota | Coleção / origem |
|--------|------|------------------|
| POST | `/api/login` | users |
| GET | `/api/health` | — |
| GET | `/api/dashboard` | agregação tickets |
| GET | `/api/stats` | alias dashboard |
| GET | `/api/boxes` | boxes (Kanban) |
| GET/POST/PUT/DELETE | `/api/tickets` | tickets (`chamados_n1`) |
| GET | `/api/tickets/by-protocol/:protocolo` | tickets |
| POST | `/api/tickets/:id/messages` | tickets.messages |
| GET | `/api/forms` | forms |
| GET | `/api/users` | users |
| POST | `/api/uploads/signed-url` | uploads GCS |
| GET/POST | `/api/whatsapp/*` | módulo WhatsApp |

## localStorage → MongoDB

### kanbanColumns → boxes + tickets

```json
{
  "id": "string",
  "name": "string",
  "order": "number",
  "tickets": ["ObjectId ref ticket"]
}
```

### Ticket (protótipo)

| Campo protótipo | Campo API | Tipo |
|-----------------|-----------|------|
| id | _id | ObjectId |
| title | title | string |
| description | description | string |
| status | status | string |
| priority | priority | string |
| channel | channel | string |
| source | source | string |
| messages | messages | array |
| internalNotes | internalNotes | array |
| formData | formData | object |
| lateralForm | lateralForm | object |
| clientName | clientName | string |
| clientCPF | clientCPF | string |
| responsibleAgent | responsibleAgent | string |
| createdAt | createdAt | date |
| updatedAt | updatedAt | date |

### lateralForm (ticket-lateral-form.js)

`cpf`, `canal`, `classificacaoTipo`, `produto`, `motivo`, `detalhe`, `responsavel`, `atribuido` → subdocumento `lateralForm`.

### velodeskClientDB → clients

Chave CPF → documento com `produtos`, `termometro`, `atendimentos`.

### forms → forms

Builder de campos: `fields[]` com tipos text, select, tree, checkbox.

### Perfis V3 (UI only)

`velodeskProfile`: agent | supervisor | monitor | training | management — não persiste no ticket; controla nav/RBAC futuro.

## Seeds

Apenas `NODE_ENV=development`. Produção sem dados hardcoded.
