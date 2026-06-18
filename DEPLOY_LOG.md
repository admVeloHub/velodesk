# DEPLOY LOG — Velodesk React

<!-- VERSION: v1.2.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team -->

---

## Deploys e pushes realizados

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
