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
npm run dev
```

API: http://localhost:8001

### Frontend

Portas e proxy: `../FONTE DA VERDADE/.env-velodesk` (`VELODESK` / `VELODESK_BACKEND`).

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:8000  
Rota padrão: `/tickets?desk=v2`  
Login dev: `admin@velodesk.local` / `admin123`

## Repositório

https://github.com/admVeloHub/velodesk

## Deploy (Vercel)

- **Produção:** https://velodesk.vercel.app
- **Desk v2:** https://velodesk.vercel.app/tickets?desk=v2
- O `vercel.json` na raiz do repositório aponta o build para `frontend/`.
- Cada push na branch `main` dispara deploy se o projeto Vercel estiver conectado ao GitHub `admVeloHub/velodesk`.
- Deploy manual (pasta `frontend`): `npx vercel --prod --yes`
