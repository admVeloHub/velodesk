# DEPLOY LOG — Velodesk React

<!-- VERSION: v1.22.0 | DATE: 2026-07-10 | AUTHOR: VeloHub Development Team -->

---

## Deploys e pushes realizados

### GitHub Push — Sugestão IA (nome cliente), envio por perfil e liberação ao usar sugestão

- **Data/Hora**: 2026-07-10
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Branch**: dev
- **Versão (componentes)**:
  - DEPLOY_LOG v1.22.0
  - openaiTicketSuggest.service v1.0.4, ticketSuggestPersona v1.1.1, clientResponseFormatPersona v1.0.1, ticketAi.routes v1.0.1, index (backend)
  - useTicketAiSuggestions v1.1.1, composeRichEditor v1.0.1, constants v2.2.0, desk/utils, ticketsCache
  - DeskV2Root v3.7.5, DeskComposePanel v1.12.4, DeskConversation, DeskWhatsAppChat, client.js
  - velodesk-crm.css v1.6.2
- **Arquivos modificados / incluídos**:
  - `backend/src/services/openaiTicketSuggest.service.ts` — primeiro nome do cliente no bloco do prompt; `nomeOperador`; diagnóstico de config OpenAI
  - `backend/src/services/clientResponseFormatPersona.ts`, `ticketSuggestPersona.ts` — saudação obrigatória com nome do cliente
  - `backend/src/routes/ticketAi.routes.ts`, `backend/src/index.ts` — GET `/api/ticket-ai/status`; resposta 503 com `missing`
  - `frontend/src/hooks/useTicketAiSuggestions.js` — resolve nome do cliente; logs de diagnóstico; envia `nomeOperador`
  - `frontend/src/features/desk/DeskV2Root.jsx` — usar sugestão IA libera envio (`iaSuggestionApproved`); normalização plain/HTML; status Cancelado só supervisor
  - `frontend/src/features/desk/components/DeskComposePanel.jsx` — opções de envio por perfil; labels só com status
  - `frontend/src/services/desk/constants.js` — `getSendStatusOptions(agent|supervisor)`; Cancelado exclusivo supervisor
  - `frontend/src/services/desk/utils.js` — `applySendStatus` para cancelado
  - `frontend/velodesk-crm.css` — estilo opção Cancelado no dropdown de envio
- **Descrição**: Prompt da sugestão IA passa a incluir nome do cliente na saudação. Clicar em "Usar resposta" equivale à Revisão de texto e libera o envio. Botão Enviar exibe apenas o status (sem "Enviar como:"). Agentes veem Em andamento/Pendente/Resolvido; supervisores também Cancelado.
- **Status**: Concluído

### GitHub Push — Sugestão IA de resposta e tabulação na abertura do ticket (OpenAI + POPs)

- **Data/Hora**: 2026-07-03
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.21.0
  - openaiTicketSuggest.service v1.0.1, ticketSuggestPersona v1.0.0, ticketAi.routes v1.0.0
  - env v1.12.1, index v1.6.0
  - useTicketAiSuggestions v1.0.1, client.js v1.5.0, TabulationContext v1.1.1
  - DeskV2Root v3.6.0, DeskConversation v1.3.0, DeskWhatsAppChat v1.2.0, DeskRightPanel v1.4.0
- **Arquivos modificados / incluídos**:
  - `backend/package.json`, `backend/package-lock.json` — dependência `openai`
  - `backend/src/config/env.ts`, `backend/.env.example` — OPENAI_API_KEY, OPENAI_VECTOR_STORE_ID, VECTOR_STORE_PATH (alias)
  - `backend/src/services/openaiTicketSuggest.service.ts` — Responses API + file_search na vector store de POPs; fetch nativo (Windows)
  - `backend/src/services/ticketSuggestPersona.ts` — persona sugestão resposta + tabulação
  - `backend/src/routes/ticketAi.routes.ts` — POST `/api/ticket-ai/suggest`
  - `backend/src/index.ts` — rota ticket-ai e log de startup
  - `frontend/src/hooks/useTicketAiSuggestions.js` — gatilho por canal (mensagem pública vs anotação interna telefone)
  - `frontend/src/features/desk/DeskV2Root.jsx` — integração hook; aplicar tabulação da IA
  - `frontend/src/features/desk/components/DeskConversation.jsx`, `DeskWhatsAppChat.jsx`, `DeskRightPanel.jsx` — UI sugestão IA operacional
  - `frontend/src/context/TabulationContext.jsx` — retry em 503 transitório (desk_config)
  - `frontend/src/api/client.js` — ticketAiApi
  - `frontend/src/features/desk/components/ClientThermoGauge.jsx`, `DeskClientProfileBar.jsx`, `DeskComposePanel.jsx`, `frontend/velodesk-crm.css` — termômetro cliente e estilos alinhados
- **Descrição**: v1 operacional da sugestão IA na abertura do ticket: e-mail/app usam 1ª mensagem pública; telefone usa anotação interna (≥80 chars) + hint de produto. Backend consulta vector store OpenAI com POPs Velotax e valida tabulação contra config ativa. Corrige Premature close do SDK OpenAI no Windows via fetch nativo.
- **Status**: Concluído

### GitHub Push — Notas do Desk, fila Novos e fix tabulação Tipo

- **Data/Hora**: 2026-07-03
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.20.0
  - chamado.mapper v1.8.5, boxes.routes v1.3.8
  - responsavelSegmentation v1.2.0, ticketsCache v1.5.1
  - tabulationConfig v1.3.1, ticketAdapter v1.4.2
  - desk/utils v2.9.1, DeskInternalNotesPanel v1.4.0, DeskRightPanel v1.3.2, DeskV2Root v3.5.9
- **Arquivos modificados / incluídos**:
  - `backend/src/services/chamado.mapper.ts` — tickets Novos sem responsável visíveis na fila do agente
  - `backend/src/routes/boxes.routes.ts` — versão alinhada ao filtro Novos
  - `frontend/src/services/desk/responsavelSegmentation.js` — Novos sem responsável = fila compartilhada
  - `frontend/src/services/tabulationConfig.js` — default Tipo Solicitação; mergeRightFieldsWithDefaults
  - `frontend/src/features/desk/DeskV2Root.jsx` — validação/envio com tipoChamado explícito
  - `frontend/src/api/adapters/ticketAdapter.js` — tipoChamado no payload lateralForm
  - `frontend/src/services/desk/utils.js` — aba Notas: supervisor (diff tabulação, status, internas); agente (só internas); ordem cronológica
  - `frontend/src/features/desk/components/DeskInternalNotesPanel.jsx` — UI diff alterações e status
  - `frontend/src/features/desk/components/DeskRightPanel.jsx` — select Tipo com default
  - `frontend/src/services/ticketsCache.js` — versão alinhada
- **Descrição**: Corrige fila Novos vazia para agentes (tickets sem responsável). Corrige erro "Preencha Tipo" ao salvar Em andamento. Aba Notas exibe só conteúdo relevante por perfil (sem mensagens públicas), com diff de tabulação/status e ordem do mais antigo ao mais recente.
- **Status**: Concluído

### GitHub Push — Fila meus-chamados, autor do registro e landing Painel 360°

- **Data/Hora**: 2026-07-02
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.19.0
  - boxes.routes v1.3.7, tickets.routes v1.3.7, chamado.mapper v1.8.4, ChamadoN1 v1.4.0
  - responsavelSegmentation v1.1.0, ticketsCache v1.5.0, ticketAdapter v1.4.1
  - desk/utils v2.8.2, TicketsContext v1.3.0, ProfileContext v1.4.0, profiles v1.3.0
  - DeskInternalNotesPanel v1.3.4, App v2.4.0, DefaultLandingRedirect v1.0.0
- **Arquivos modificados / incluídos**:
  - `backend/src/routes/boxes.routes.ts` — agente sempre recebe fila `meus-chamados` (filtro por tabulacao.responsavel)
  - `backend/src/services/chamado.mapper.ts` — campo `autor` no registro; executor ≠ responsavel; alteracoes[] só diff de tabulação
  - `backend/src/models/ChamadoN1.ts` — schema `registro.autor`
  - `backend/src/routes/tickets.routes.ts` — persiste autor da sessão em mensagens e updates
  - `backend/src/services/email-inbound.service.ts` — autor cliente em registro inbound
  - `frontend/src/services/desk/responsavelSegmentation.js` — segmentação meus-chamados por papel da sessão
  - `frontend/src/services/ticketsCache.js` — `fila=meus-chamados` + filtro defensivo client-side
  - `frontend/src/api/adapters/ticketAdapter.js` — adaptação colunas meus-chamados; `author` em updates
  - `frontend/src/services/desk/utils.js` — feed de notas/registro com "Realizado por" correto
  - `frontend/src/features/desk/components/DeskInternalNotesPanel.jsx` — visão supervisor com ocorrências de registro
  - `frontend/src/routes/DefaultLandingRedirect.jsx` — landing por perfil (Painel 360°)
  - `frontend/src/app/App.js`, `ProfileContext.js`, auth pages — redirect pós-login para workspace
  - `frontend/velodesk-crm.css`, `velodesk-dark-theme.css` — estilos painel notas/registro
- **Descrição**: Agentes veem apenas tickets em que são responsáveis; supervisor vê fila completa. Registro grava `origin` (cliente/agente) e `autor` (quem executou a ação). Notas internas e alterações de tabulação exibem executor real, não o responsável do chamado. Landing padrão passa a ser Painel 360°.
- **Status**: Concluído

### GitHub Push — Compose WYSIWYG e toolbar de formatação com estado ativo

- **Data/Hora**: 2026-07-02
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.18.0
  - ComposeRichEditor v1.0.2, composeRichEditor v1.0.1, ComposeFormatToolbar v1.0.3
  - DeskComposePanel v1.9.1, DeskConversation v1.2.0, DeskV2Root v3.5.8
  - useComposeSpellCheck v2.0.1, composeFormatPreview v1.0.0
- **Arquivos modificados / incluídos**:
  - `frontend/src/features/desk/components/ComposeRichEditor.jsx` — editor contenteditable WYSIWYG (sem tags visíveis na seleção)
  - `frontend/src/services/desk/composeRichEditor.js` — sanitização HTML, execCommand, readComposeFormatState
  - `frontend/src/features/desk/components/ComposeFormatToolbar.jsx` — botões destacam formatação ativa (queryCommandState)
  - `frontend/src/features/desk/components/DeskComposePanel.jsx` — compose público e anotação interna migrados para rich editor
  - `frontend/src/hooks/useComposeSpellCheck.js` — onReplaceRange preserva formatação ao corrigir ortografia
  - `frontend/src/features/desk/DeskV2Root.jsx` — gate ortográfico em texto plano; envio preserva HTML
  - `frontend/src/features/desk/components/DeskConversation.jsx` — renderização segura de HTML nas mensagens
  - `frontend/velodesk-crm.css`, `velodesk-dark-theme.css` — estilos editor rich e toolbar ativa
- **Descrição**: Substitui textarea+mirror por editor WYSIWYG; negrito/itálico/sublinhado/listas aplicam formatação visual; toolbar indica estado ativo; corretor ortográfico opera em texto plano sem destruir markup.
- **Status**: Concluído

### GitHub Push — Protocolo sequencial, Assistente IA Gemini e painel cliente

- **Data/Hora**: 2026-07-02
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.17.0
  - protocolo.service v1.0.2, geminiRefinar.service v1.0.2, compose.routes v1.0.1
  - DeskClientProfileBar v1.3.1, ComposeRefinarModal v1.0.2, DeskV2Root v3.5.7
  - clienteAdapter v1.0.4, ticketAdapter v1.3.2, env.ts v1.11.0
- **Arquivos modificados / incluídos**:
  - `backend/src/services/protocolo.service.ts` — contador atômico; exibição `0100177678` … `0999999999` → `1000000000+`
  - `backend/src/services/geminiRefinar.service.ts`, `compose.routes.ts`, `refinarRascunhoPersona.ts` — Assistente IA refinar rascunho (Gemini)
  - `backend/src/services/chamado.mapper.ts`, `email-inbound.service.ts` — protocolo numérico e regex e-mail
  - `frontend/src/features/desk/components/DeskClientProfileBar.jsx` — layout protocolo + linha cliente; persistência cadastro
  - `frontend/src/features/desk/components/ComposeRefinarModal.jsx`, `ComposeFormatToolbar.jsx` — IA com cancelamento; formatação compose
  - `frontend/src/api/adapters/clienteAdapter.js`, `client.js` — `PUT /clients/:id`, `persistClienteContact`
  - `frontend/velodesk-crm.css`, `velodesk-dark-theme.css` — estilos painel cliente e modais
- **Descrição**: Numeração de tickets continua CRM legado (floor 100177678) com zero à esquerda; painel superior redesenhado; edição de contato persiste em `b2c_cadastros.clientes`; Assistente IA Gemini no compose com fallback de modelo e cancelamento.
- **Status**: Concluído

### GitHub Push — Corretor LanguageTool self-hosted no compose

- **Data/Hora**: 2026-07-01
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.16.0
  - languagetool.service v1.0.2, spellcheckSuggestionRank v1.0.0
  - spellEngine v2.0.0, languageToolEngine v1.0.0, useComposeSpellCheck v2.0.0
  - docker-compose v1.1.0, index.ts v1.5.0, env.ts v1.10.0
- **Arquivos modificados / incluídos**:
  - `docker-compose.yml` — serviço `languagetool` (erikvl87/languagetool)
  - `backend/src/services/languagetool.service.ts` — proxy `/v2/check` pt-BR, filtro STYLE/CASING
  - `backend/src/services/spellcheckSuggestionRank.ts` — ranking atendimento (ex.: criente → cliente)
  - `backend/src/routes/spellcheck.routes.ts` — `GET /status`, `POST /check` (JWT)
  - `frontend/src/services/spellcheck/languageToolEngine.js` — adapter via API backend
  - `frontend/src/hooks/useComposeSpellCheck.js` — debounce, abort, modo degradado
  - Removido `dictionary-pt-br` do bundle frontend
- **Descrição**: Substitui Hunspell local por LanguageTool open source self-hosted; bloqueio de envio só com erros reais; fallback se LT offline; sugestões priorizadas para vocabulário de atendimento.
- **Status**: Concluído

### GCP Cloud Run — MONGODB_URI voltou para velodesk-dev (MONGO_URI)

- **Data/Hora**: 2026-06-30
- **Tipo**: GCP Cloud Run (gcloud)
- **Projeto**: velohub-471220
- **Serviço**: velodesk (us-east1)
- **Revisões**: velodesk-00018-sg2 → velodesk-00019-tzq
- **Alterações**:
  - `MONGODB_URI` ← secret **`MONGO_URI`** (cluster **velodesk-dev** — dados Desk)
  - Removido secret **`MONGO_ENV`** do container (VelohubCentral reservado ao VeloNews via `VITE_VELOHUB_API_URL`)
- **Resultado**: `/health` → `status: ok`, `cadastrosConnected: true`, `deskConfigConnected: true`, cluster `appName=velodesk-dev`
- **Status**: Concluído

### GitHub Push — Fix 502: API não morre se desk_config cair

- **Data/Hora**: 2026-06-30
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.14.0
  - database.ts v1.7.0, index.ts v1.4.1
  - tabulation.routes v1.2.1, boxes.routes v1.3.6
  - start-velodesk.sh v1.0.3
- **Arquivos modificados / incluídos**:
  - `backend/src/config/database.ts` — reconexão cadastros/desk_config; `isAllMongoReady()`
  - `backend/src/index.ts` — monitor Mongo 15s; uncaughtException/unhandledRejection não derrubam processo
  - `backend/src/routes/tabulation.routes.ts` — 503 em vez de crash se desk_config indisponível
  - `backend/src/routes/boxes.routes.ts` — 503 se Mongo principal indisponível
  - `docker/start-velodesk.sh` — loop auto-restart do Node se encerrar
- **Descrição**: Corrige 502 em `/api/boxes`, `/api/tabulation`, `/api/clients` quando conexão desk_config falha e derruba o Node; nginx passa a receber 503/500 em vez de connection refused.
- **Status**: Concluído

### GitHub Push — Proxy VeloHub /velohub-api + responsável com usuários logados

- **Data/Hora**: 2026-06-30
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.13.0
  - nginx-cloudrun v1.0.2, start-velodesk.sh v1.0.2, velohubApiConfig v1.3.0
  - useDeskAgents v1.0.0, DeskRightPanel v1.3.0, chamado.mapper v1.2.4
- **Arquivos modificados / incluídos**:
  - `docker/nginx-cloudrun.conf.template` — proxy `/velohub-api/` → VeloHub (CORS VeloNews)
  - `frontend/src/config/velohubApiConfig.js` — sempre usa proxy same-origin
  - `frontend/src/hooks/useDeskAgents.js` — lista agentes via `/api/users`
  - `frontend/src/features/desk/components/DeskRightPanel.jsx` — select Responsável + auto-atribuição
  - `backend/src/services/chamado.mapper.ts` — fila Meus Chamados reconhece prefixo do e-mail
- **Descrição**: VeloNews sem CORS em produção GCP; atribuições usam usuários Google registrados no Mongo.
- **Status**: Concluído

### GCP Cloud Run — MONGODB_URI apontado para secret MONGO_ENV (VelohubCentral)

- **Data/Hora**: 2026-06-30
- **Tipo**: GCP Cloud Run (gcloud)
- **Projeto**: velohub-471220
- **Serviço**: velodesk (us-east1)
- **Revisão**: velodesk-00013-zrf
- **Alteração**: `MONGODB_URI` ← secret `MONGO_ENV` (substitui `MONGO_URI` / cluster velodesk-dev bloqueado por IP no Atlas)
- **Resultado**: `/health` → `status: ok`, `mongo: true`
- **Status**: Concluído

### GitHub Push — Fix URI Atlas com /dbname + tabulação só após login

- **Data/Hora**: 2026-06-30
- **Tipo**: GitHub Push
- **Repositório**: https://github.com/admVeloHub/velodesk
- **Versão (componentes)**:
  - DEPLOY_LOG v1.11.0
  - resolveAtlasUri v1.0.1, env.ts v1.9.1, index.ts v1.3.1
  - TabulationContext v1.1.0
- **Arquivos modificados / incluídos**:
  - `backend/src/config/resolveAtlasUri.ts` — parser `mongodb+srv://.../dbname?...` (formato Atlas)
  - `backend/src/config/env.ts` — trim de secrets (newline/aspas)
  - `backend/src/index.ts` — helmet sem COOP (Google postMessage)
  - `frontend/src/context/TabulationContext.jsx` — não chama `/api/tabulation` na tela de login
- **Descrição**: Corrige 503 no login Google quando `MONGODB_URI` Atlas inclui nome do banco no path; elimina 401 de tabulação antes de autenticar.
- **Status**: Concluído

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
