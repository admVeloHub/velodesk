# Velodesk v2.1.0

Portal de helpdesk VeloHub — frontend Cockpit integrado ao backend Express/MongoDB.

Referência legado API/TS: `frontend-legacy/`  
Referência UX externa: `../Velodesk-cockpit/`

## Estrutura

```
frontend/           React 18 + Vite + Cockpit (ativo)
frontend-legacy/    React 19 + MUI 9 + TypeScript (referência API)
backend/            Express + MongoDB + WhatsApp module
docs/               Contratos API e mapeamentos
```

## Desenvolvimento

### Backend

Credenciais de dev local: `../FONTE DA VERDADE/.env-velodesk` (carregadas via bootstrap — não usar `.env` no diretório do projeto).

```bash
cd backend
npm install
npm start
```

API: http://localhost:8001

### Frontend

Portas e proxy: `FONTE DA VERDADE/.env-velodesk` (`VELODESK=8000`, `VELODESK_BACKEND=8001`).

```bash
# na raiz do repositório (padrão ecossistema VeloHub)
npm install --prefix frontend
npm start          # libera porta 8000 automaticamente (prestart)

# ou dentro de frontend/
cd frontend
npm install
npm start
```

`npm start` encerra instâncias **node** anteriores na porta 8000 antes de subir o Vite (padrão VeloHub). Para parar tudo: `npm run stop` na raiz ou `.\stop-dev.ps1`.

App: http://localhost:8000  
Rota padrão: `/tickets?desk=v2`  
Autenticação: sessão VeloHub (loading gate em `/login`); dev localhost usa bypass automático.

## Docker (local e GCP)

Stack containerizada com portas **8000** (web) e **8001** (API) no host — compatível com Cloud Run (containers na 8080).

```bash
# na raiz
cp .env.docker.example .env.docker   # opcional — ajuste MONGODB_URI / JWT_SECRET
npm run docker:build
npm run docker:up
```

- **Web:** http://localhost:8000/tickets?desk=v2  
- **API health:** http://localhost:8001/health  
- **Mongo local:** porta 27017 (volume `velodesk_mongo_data`)

Scripts npm na raiz: `docker:build`, `docker:up`, `docker:up:detached`, `docker:down`, `docker:logs`.

### GCP Cloud Run

1. Build/push via Cloud Build (`cloudbuild.yaml`):
   ```bash
   gcloud builds submit --config cloudbuild.yaml \
     --substitutions=_REGION=southamerica-east1,_REPOSITORY=velodesk
   ```
2. Deploy **velodesk-api** (imagem `velodesk-api`) com `MONGODB_URI`, `JWT_SECRET`, `ENABLE_WHATSAPP=false`.
3. Deploy **velodesk-web** (imagem `velodesk-web`) com `BACKEND_URL=https://<url-do-servico-api>`.

WhatsApp fica desabilitado no container por padrão (`ENABLE_WHATSAPP=false`).

## Repositório

https://github.com/admVeloHub/velodesk

## Deploy (Vercel)

- **Produção:** https://velodesk.vercel.app
- **Desk v2:** https://velodesk.vercel.app/tickets?desk=v2
- O `vercel.json` na raiz do repositório aponta o build para `frontend/`.
- Cada push na branch `main` dispara deploy se o projeto Vercel estiver conectado ao GitHub `admVeloHub/velodesk`.
- Deploy manual (pasta `frontend`): `npx vercel --prod --yes`

## Inbound e-mail (webhook)

Entrada de tickets por e-mail via provedor (Mailgun, SendGrid ou adapter `generic`).

### Variáveis (`backend/.env`)

```env
INBOUND_EMAIL_ENABLED=true
INBOUND_EMAIL_PROVIDER=generic
INBOUND_EMAIL_WEBHOOK_SECRET=seu-segredo
INBOUND_EMAIL_ALLOWED_RECIPIENTS=chamados@seudominio.com.br
```

### Endpoints

| Método | Rota | Auth |
|--------|------|------|
| GET | `/api/inbound/email/health` | nenhuma |
| POST | `/api/inbound/email` | assinatura Mailgun ou header `X-Inbound-Secret` |

### DNS (produção)

1. Subdomínio inbound (ex.: `chamados.seudominio.com.br`)
2. Registro **MX** apontando para o provedor
3. Route/action do provedor → `POST https://<url-cloud-run>/api/inbound/email`
4. SPF/DKIM para envio futuro (Fase 1b)

Plano completo: [docs/PLANO-ENTRADA-TICKETS.md](docs/PLANO-ENTRADA-TICKETS.md)

### Teste local (adapter generic)

```bash
curl -X POST http://localhost:8001/api/inbound/email \
  -H "Content-Type: application/json" \
  -H "X-Inbound-Secret: seu-segredo" \
  -d "{\"messageId\":\"test-001\",\"from\":\"cliente@example.com\",\"to\":[\"chamados@example.com\"],\"subject\":\"Dúvida sobre pedido\",\"textBody\":\"Preciso de ajuda com meu pedido.\"}"
```
