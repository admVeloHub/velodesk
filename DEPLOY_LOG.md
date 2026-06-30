# DEPLOY LOG — Velodesk React

<!-- VERSION: v1.10.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team -->

---

## Deploys e pushes realizados

### GitHub Push — Login limpo: remove recados e erro Mongo na tela

- **Data/Hora**: 2026-06-30
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.10.0
  - DeskLoginPage v1.1.0, desk-login.css v1.0.1
- **Arquivos modificados / incluídos**:
  - `frontend/src/features/auth/DeskLoginPage.jsx` — só marca Velodesk + botão Google; sem textos de fase de testes/VeloHub; 503 Mongo não exibe alerta na UI
  - `frontend/src/features/auth/desk-login.css` — estilos dos blocos removidos
- **Descrição**: Tela de login enxuta; erros técnicos de banco ficam só no backend/logs.
- **Status**: Concluído

### GitHub Push — Retry MongoDB + diagnóstico health + helmet Google OAuth

- **Data/Hora**: 2026-06-30
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.9.0
  - index.ts v1.3.0, start-velodesk.sh v1.0.1
- **Arquivos modificados / incluídos**:
  - `backend/src/index.ts` — retry Mongo a cada 30s em produção; `/health` expõe `mongoUriConfigured`; helmet `same-origin-allow-popups` (Google OAuth)
  - `docker/start-velodesk.sh` — log de aviso se `MONGODB_URI` / `GOOGLE_CLIENT_ID` ausentes no Cloud Run
- **Descrição**: Melhorias operacionais; login Google 503 exige `MONGODB_URI` configurada no serviço Cloud Run `velodesk` + Atlas Network Access.
- **Status**: Concluído

### GitHub Push — Container Cloud Run combinado (web + API)

- **Data/Hora**: 2026-06-30
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.8.0
  - Dockerfile (raiz) v2.0.0, start-velodesk.sh v1.0.0
  - runtimeEnv v1.0.0, googleAuthConfig v1.2.0, velohubApiConfig v1.2.0
- **Arquivos modificados / incluídos**:
  - `Dockerfile` — build web (Vite) + API (Node) no mesmo container; nginx :8080 + API :8081
  - `docker/start-velodesk.sh`, `docker/nginx-cloudrun.conf.template`
  - `frontend/` — `env-config.js` runtime (Cloud Run env); configs leem `window.__VELODESK_ENV__`
  - `README.md` — produção GCP Cloud Run (não Vercel)
- **Descrição**: Serviço `velodesk` passa a servir o Desk (SPA) na URL pública; `/api` proxied para Node interno. Corrige 404/Cannot GET `/` ao abrir a URL do Cloud Run.
- **Status**: Concluído

### GitHub Push — Startup Cloud Run: escuta PORT antes do MongoDB

- **Data/Hora**: 2026-06-30
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.7.0
  - index.ts v1.2.0, env.ts v1.9.0, database.ts v1.6.1
- **Arquivos modificados / incluídos**:
  - `backend/src/index.ts` — `app.listen` em `0.0.0.0:PORT` antes de conectar Atlas; produção não encerra se Mongo falhar (modo degradado)
  - `backend/src/config/env.ts` — produção tolera `MONGODB_URI` ausente no boot (log + degradado)
  - `backend/src/config/database.ts` — guard contra URI vazia
  - `README.md` — variáveis obrigatórias no serviço Cloud Run `velodesk`
- **Descrição**: Corrige deploy Cloud Run (`container failed to start and listen on PORT=8080`). O backend só abria a porta após MongoDB; falha de conexão ou env ausente matava o container antes do health check.
- **Status**: Concluído

### GitHub Push — Dockerfile na raiz para trigger Cloud Build GCP

- **Data/Hora**: 2026-06-30
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.6.0
  - Dockerfile (raiz) v1.0.1
  - cloudbuild.yaml v1.1.0
- **Arquivos modificados / incluídos**:
  - `Dockerfile` — build da API (`velodesk-api`) a partir da raiz do monorepo (contexto `backend/`)
  - `cloudbuild.yaml` — comentários sobre trigger GitHub vs build web+api
  - `README.md` — documentação do trigger na raiz
- **Descrição**: Corrige falha do Cloud Build (`lstat /workspace/Dockerfile: no such file or directory`). O trigger GCP esperava Dockerfile na raiz; o repositório só tinha `backend/Dockerfile` e `frontend/Dockerfile`.
- **Status**: Concluído

### GitHub Push — Login Google SSO, allowlist de acesso e logout

- **Data/Hora**: 2026-06-30
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.5.0
  - AuthContext v1.5.0, DeskLoginPage v1.0.1, auth.routes v1.1.0
  - loadFonteVelodeskEnv backend v2.1.0, vite.config v1.3.0
  - Sidebar v1.10.0, ProfileContext v1.3.0
- **Arquivos modificados / incluídos**:
  - `frontend/` — login Google (fase testes); allowlist agente/supervisor; perfil travado; logout na sidebar; hero com prefixo do e-mail; remoção do bypass admin local; injeção `VITE_GOOGLE_CLIENT_ID` via vite.config
  - `backend/` — `POST /api/auth/google`; validação token Google; allowlist server-side; loader env lê `FONTE DA VERDADE/.env-velodesk` + `backend/.env`
- **Descrição**: Controle de acessos por e-mail @velotax.com.br na fase de testes, mantendo gate VeloHub preparado para fase posterior. Backend e frontend alinhados ao `.env-velodesk` para `GOOGLE_CLIENT_ID`.
- **Status**: Concluído

### GitHub Push — VeloNews VeloHub na sidebar, proxy CORS e ajustes Desk v2

- **Data/Hora**: 2026-06-30
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.4.0
  - VeloNewsProvider v1.0.1, veloNewsApi v1.0.1, velohubApiConfig v1.1.0
  - Sidebar v1.9.1, vite.config v1.2.0
  - tickets.routes v1.3.3, chamado.mapper v1.2.3, tabulation.service v1.2.2
- **Arquivos modificados / incluídos**:
  - `frontend/` — sininho VeloNews no rodapé da sidebar; feed real via API VeloHub (`veloNewsApi`, `VeloNewsProvider`, modais/popover/histórico); proxy Vite `/velohub-api` (CORS dev :8000); remoção de noticiário demo do Painel 360; CSS `velonews.css`; fix `contains` na sidebar
  - `backend/` — PUT ticket respeita status explícito (“Enviar como”); tabulação e mapper sem registro duplicado de status
  - `frontend/.env.example` — documentação `VITE_VELOHUB_API_URL`
- **Descrição**: Push integrando VeloNews do VeloHub (Cloud Run) no Desk, acessível em qualquer aba pela sidebar, com proxy local para evitar bloqueio CORS. Remove origem demo local. Corrige envio de status de ticket e componentes de tabulação/config.
- **Status**: Concluído

### GitHub Push — Desk v2: inbound e-mail, Docker/GCP, tabulação e auth VeloHub

- **Data/Hora**: 2026-06-29
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - root package.json v2.2.1
  - frontend package.json v2.1.1
  - backend package.json (inbound + tabulação)
  - docker-compose.yml v1.0.0
  - cloudbuild.yaml v1.0.0
  - DEPLOY_LOG v1.3.0
  - README (Docker/GCP/inbound)
- **Arquivos modificados / incluídos**:
  - `backend/` — inbound e-mail (webhook Mailgun/generic), modelo Cliente, tabulação de produtos, resolução MongoDB Atlas, middleware supervisor/inboundAuth, scripts de migração/purge demo
  - `frontend/` — auth via sessão VeloHub (loading gate), tabulação na config, spell-check no compose, cadastro de cliente, integração velohubApi, remoção LoginPage/seedDemo
  - `docker-compose.yml`, `cloudbuild.yaml`, Dockerfiles e `.dockerignore` (web + api)
  - `docs/PLANO-ENTRADA-TICKETS.md`
  - `package.json`, `run-dev.ps1`, `stop-dev.ps1`, `scripts/free-port.cjs`
  - `README.md`, `DEPLOY_LOG.md`
- **Descrição**: Push consolidando Desk v2 com entrada de tickets por e-mail, stack containerizada (local/GCP Cloud Run), tabulação configurável, cadastro de clientes unificado e gate de acesso VeloHub. Monorepo orquestrado na raiz; demo seed removido do frontend.
- **Status**: Em andamento

### GitHub Push — Frontend Cockpit v2 + legado preservado

- **Data/Hora**: 2026-06-18
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - frontend package.json v2.1.0
  - App.js v2.1.0
  - DeskV2Root v2.2.0
  - CreateTicketWorkspace v2.2.0
  - client.js v1.0.0
  - ticketAdapter v1.0.0
  - ticketsCache v1.0.0
  - kanbanStorage v1.1.0
  - AuthContext v1.0.0
  - ChatView v2.1.0
  - DashboardView v2.1.0
  - TicketLateralForm v2.1.0
  - api-contract v1.1.0
  - README v2.1.0
  - DEPLOY_LOG v1.2.0
- **Arquivos modificados / incluídos**:
  - `frontend/` — Velodesk-cockpit ativo (Desk V2, auth JWT, API boxes/tickets/dashboard/whatsapp)
  - `frontend-legacy/` — React 19/MUI/TS anterior preservado como referência
  - `backend/` — API Express/MongoDB
  - `docs/api-contract.md`
  - `README.md`
  - `.gitignore`
  - `start-backend.ps1`, `start-frontend.ps1`
  - `DEPLOY_LOG.md`
- **Descrição**: Push do frontend Cockpit integrado ao backend. Legado movido para `frontend-legacy/`. Kanban/Desk CRM persistem via `/api/boxes` e `/api/tickets`. Rota padrão `/tickets?desk=v2`.
- **Status**: Em andamento

### Migração local — Frontend Cockpit substitui frontend ativo

- **Data/Hora**: 2026-06-18
- **Tipo**: Migração local (sem push)
- **Versão (componentes)**:
  - frontend package.json v2.1.0
  - App.js v2.1.0
  - index.js v2.1.0
  - client.js v1.0.0
  - ticketAdapter v1.0.0
  - ticketsCache v1.0.0
  - kanbanStorage v1.1.0
  - AuthContext v1.0.0
  - LoginPage v1.0.0
  - ProtectedRoute v1.0.0
  - TicketsContext v1.1.0
  - DeskV2Root v2.1.0
  - CreateTicketWorkspace v2.1.0
  - ChatView v2.1.0
  - DashboardView v2.1.0
  - TicketLateralForm v2.1.0
  - QuickRegisterModal v1.1.0
  - vite.config.js v1.0.0
  - api-contract v1.1.0
  - README v2.1.0
  - DEPLOY_LOG v1.1.0
- **Arquivos modificados / incluídos**:
  - `frontend/` — Velodesk-cockpit migrado com integração API (auth JWT, boxes, tickets, dashboard, whatsapp)
  - `frontend-legacy/` — front React 19/MUI/TS anterior preservado
  - `docs/api-contract.md` — endpoints obsoletos removidos da documentação
  - `README.md` — nova estrutura do repositório
  - `DEPLOY_LOG.md`
- **Descrição**: Substituição do frontend ativo pelo Velodesk-cockpit. Legado movido para `frontend-legacy/`. Removido auto-login lab; adicionados auth JWT, proxy Vite 8000→8001, camada `api/client.js` e adapter tickets. Kanban/Desk CRM passam a persistir via `/api/boxes` e `/api/tickets`. Seed demo apenas em DEV quando API vazia. WhatsApp via `/api/whatsapp/*` do backend velodesk.
- **Status**: ✅ Concluído (incluído no push 2026-06-18)

### GitHub Push — Velodesk React: repositório inicial + rascunho local de chamado

- **Data/Hora**: 2026-06-16
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - draftTicket v1.0.0
  - ConfirmDiscardDraftDialog v1.0.0
  - ticketUpdateMeta v1.0.0
  - TicketsPage v1.8.0
  - TicketDetail v1.2.0
  - MessageComposer v1.2.0
  - TicketsOpenTabs v1.5.2
  - LateralForm v1.2.1
  - ticketFormStyles v1.0.2
  - ticketStatuses v1.0.2
  - types v1.3.2
  - chamado.mapper v1.0.8
  - tickets.routes v1.2.0
  - auth.routes v1.0.3
  - boxes.routes v1.3.1
  - client.ts v1.0.4
  - globals.css v1.8.5
  - DEPLOY_LOG v1.0.0
- **Arquivos modificados / incluídos**:
  - `frontend/` — portal React/MUI (tickets, kanban, composer, lateral)
  - `backend/` — API Express/MongoDB (`chamados_n1`, auth, boxes, uploads)
  - `docs/api-contract.md`
  - `README.md`
  - `.gitignore`
  - `DEPLOY_LOG.md`
- **Descrição**: Primeiro push do Velodesk React para o repositório `admVeloHub/velodesk`. Novo chamado passa a ser rascunho 100% local até Salvar/status (POST único em `chamados_n1`). Removidos endpoints de criação imediata `POST /api/register` e `POST /api/boxes`. Backend enriquece `POST /api/tickets` com protocolo informado, status inicial, mensagem/anexos e retorno 409 em protocolo duplicado.
- **Status**: ✅ Concluído com sucesso
