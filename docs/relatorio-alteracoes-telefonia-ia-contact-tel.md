# Relatório de alterações — Integração Atendimento IA Telefônico (Velotax × Contact-Tel)

<!-- VERSION: v1.0.0 | DATE: 2026-08-07 | DESTINATÁRIO: Contact-Tel / provedor telefonia IA -->

**Data:** 07/08/2026  
**Projeto:** Velodesk — módulo Atendimento IA Telefônico (LetícIA Velotax SAC)  
**Escopo:** contrato v2 de recados operacionais + consumo do dicionário `data_collected`  
**Status:** implementado no repositório; aguardando deploy e homologação conjunta

---

## 1. Resumo executivo

A Velotax concluiu a implementação alinhada aos documentos:

1. **Proposta de contrato v2 para recados operacionais** (validada em 05/08/2026)
2. **Dicionário de dados das chamadas da Letícia** (v1.0)

As rotas inbound **permanecem as mesmas**. A mudança relevante para a Contact-Tel é a **evolução da resposta** de `GET /api/inbound/telephony/recados` para o envelope **schemaVersion 2.0**. O endpoint `POST /api/inbound/telephony/calls` **não teve alteração de contrato** — continua recebendo `data_collected` conforme o dicionário.

---

## 2. O que mudou para a Contact-Tel

### 2.1 GET `/api/inbound/telephony/recados`

| Aspecto | Antes (v1) | Agora (v2) |
|---------|------------|------------|
| `schemaVersion` | ausente | `"2.0"` obrigatório |
| Campo de fala | `mensagem` | `mensagemCliente` |
| Orientação interna | ausente | `orientacaoAtendimento` |
| Escopo | global implícito | `areas[]` (11 áreas) |
| Tipo de ocorrência | ausente | `tipo` |
| Política de chamado | ausente | `politicaChamado` + `criterioChamado` |
| Homologação | ausente | `telefonesOrigemLiberados` |
| Item | 4 campos | 11 campos + `updatedAt` por item |
| Content-Type | JSON | `application/json; charset=utf-8` |
| Ordenação | prioridade | prioridade → `updatedAt` desc → `id` asc |

**Exemplo de resposta v2:**

```json
{
  "schemaVersion": "2.0",
  "updatedAt": "2026-08-05T14:30:00Z",
  "items": [
    {
      "id": "pix-recebido-2026-08-05",
      "titulo": "Instabilidade no Pix recebido",
      "areas": ["conta_e_pix"],
      "tipo": "instabilidade",
      "mensagemCliente": "Estamos com uma instabilidade temporária na entrada de Pix nas contas.",
      "orientacaoAtendimento": "Use este aviso somente quando o cliente disser que recebeu um Pix, mas o saldo ainda não foi atualizado.",
      "politicaChamado": "nao_abrir",
      "criterioChamado": null,
      "prioridade": "alta",
      "telefonesOrigemLiberados": [],
      "updatedAt": "2026-08-05T14:30:00Z"
    }
  ]
}
```

**Lista vazia (sem recados ativos):**

```json
{
  "schemaVersion": "2.0",
  "updatedAt": "2026-08-05T18:00:00Z",
  "items": []
}
```

### 2.2 GET `/api/inbound/telephony/health`

Novo campo informativo:

```json
{
  "status": "ok",
  "enabled": true,
  "apiVersion": "1.0.0",
  "recadosSchemaVersion": "2.0",
  "activeRecados": 0,
  "lastRecadoUpdate": "2026-08-07T19:00:00.000Z"
}
```

### 2.3 POST `/api/inbound/telephony/calls`

**Sem alteração de rota, autenticação ou formato.**  
O Velodesk continua persistindo `data_collected` integralmente, incluindo:

- `recados_operacionais_status`
- `recados_operacionais_ativos` (string JSON conforme dicionário)
- demais campos enumerados/booleanos do dicionário v1.0

---

## 3. Responsabilidades mantidas conforme contrato

| Responsabilidade | Quem |
|------------------|------|
| Publicar recados ativos | Velotax (Velodesk) |
| Filtrar recado por `areas` | LetícIA / Contact-Tel |
| Filtrar recado por `telefonesOrigemLiberados` | LetícIA / Contact-Tel |
| Aplicar `politicaChamado` temporária | LetícIA |
| Enviar `data_collected` ao encerrar ligação | Contact-Tel |
| Falha na consulta de recados não bloqueia atendimento | LetícIA (conforme garantias do contrato) |

---

## 4. Validações implementadas no Velodesk (publicação)

Antes de incluir um recado na resposta inbound, o servidor valida:

- ao menos 1 área, máximo 5
- enums: `tipo`, `politicaChamado`, `prioridade`, `areas`
- `criterioChamado` obrigatório somente em `abrir_se_persistir`; `null` nos demais
- limites de caracteres (título 120, mensagens 500, etc.)
- máximo 20 recados ativos simultâneos
- telefones de homologação normalizados (preferência E.164)
- itens inválidos ou incompletos **não são retornados parcialmente**

Registros legados da v1 são migrados automaticamente na primeira consulta, com `areas: ["geral"]` e orientação genérica até revisão operacional.

---

## 5. Áreas disponíveis (`areas[]`)

| Código | Descrição |
|--------|-----------|
| `geral` | Ocorrência realmente global |
| `app_cadastro_seguranca` | App, login, cadastro, OTP, identidade |
| `conta_e_pix` | Conta, saldo, Pix, Celcoin/Velobank |
| `emprestimo_pessoal` | Empréstimo Pessoal |
| `antecipacao_salario` | Antecipação de Salário |
| `antecipacao_irpf` | Antecipação IRPF |
| `credito_trabalhador` | Crédito do Trabalhador |
| `pagamentos_cobranca_documentos` | Pagamentos, boletos, documentos |
| `seguros` | Seguros |
| `beneficios` | Indique e Ganhe, cupons, Vibe |
| `atendimento_e_chamados` | Abertura e acompanhamento de chamados |

---

## 6. Políticas de chamado (`politicaChamado`)

| Valor | Comportamento esperado na LetícIA |
|-------|-----------------------------------|
| `fluxo_normal` | Recado não altera regra permanente |
| `nao_abrir` | Não oferecer/abrir chamado para ocorrência coberta |
| `abrir_se_persistir` | Executar orientação + critério antes de abrir |
| `abrir_imediatamente` | Seguir fluxo de abertura sem tentativa prévia específica |

---

## 7. Homologação sugerida (checklist conjunto)

### Recados v2

- [ ] `GET /recados` retorna `schemaVersion: "2.0"`
- [ ] Item completo com todos os campos obrigatórios
- [ ] `items: []` quando não há recado ativo
- [ ] Recado com `telefonesOrigemLiberados` chega só em origens autorizadas
- [ ] Recado com `[]` ou `null` em telefones chega a todas as origens
- [ ] `nao_abrir` impede abertura para ocorrência coberta
- [ ] `abrir_se_persistir` exige confirmação do critério
- [ ] Remoção/desativação reflete em novas ligações

### POST calls / dicionário

- [ ] `recados_operacionais_status` reflete consulta real (`available`, `empty`, etc.)
- [ ] `recados_operacionais_ativos` espelha snapshot JSON dos recados da ligação
- [ ] `chamado_octadesk_registrado` só `true` com confirmação real
- [ ] Automações usam `.value`, não `rationale`

---

## 8. Arquivos alterados (referência técnica)

### Backend

| Arquivo | Versão | Alteração |
|---------|--------|-----------|
| `backend/src/models/TelephonyRecado.ts` | v2.0.0 | Modelo v2 completo |
| `backend/src/services/telephonyRecado.constants.ts` | v2.0.0 | Enums e limites |
| `backend/src/services/telephonyRecado.validation.ts` | v2.0.0 | Validação de publicação |
| `backend/src/services/telephonyRecado.service.ts` | v2.0.0 | CRUD + envelope v2 |
| `backend/src/services/telephony-inbound/telephonyInbound.service.ts` | v2.0.0 | Publicação inbound |
| `backend/src/services/telephony-inbound/types.ts` | — | Tipos v2 |
| `backend/src/routes/inbound.routes.ts` | v1.6.0 | charset UTF-8, health |
| `backend/src/routes/telephony.routes.ts` | v2.0.0 | schema interno |
| `backend/src/services/telephony.service.ts` | v1.2.0 | Filtros desfecho/rota |

### Frontend (Desk — operação Velotax)

| Arquivo | Versão | Alteração |
|---------|--------|-----------|
| `TelephonyRecadosPanel.jsx` | v2.0.0 | Formulário v2 completo |
| `TelephonyCallDetail.jsx` | v2.0.0 | Dicionário `data_collected` |
| `TelephonyCallsPanel.jsx` | v1.2.0 | Colunas/filtros desfecho e rota |
| `telephonyRecadoConstants.js` | v2.0.0 | Enums UI |
| `telephonyDataCollected.js` | v1.0.0 | Rótulos dicionário |

### Documentação

| Arquivo | Alteração |
|---------|-----------|
| `docs/api-inbound-telephony-parceiro.md` | v2.0.0 — contrato recados |
| `docs/Proposta de contrato v2 para recados operacionais.md` | referência canônica (sem alteração) |
| `docs/Dicionário de dados das chamadas da Letícia - agente IA.md` | referência canônica (sem alteração) |

---

## 9. Compatibilidade e breaking change

- **Breaking change controlado:** consumidores do endpoint de recados devem migrar de `mensagem` para o envelope v2.
- **POST /calls:** retrocompatível — campos novos em `data_collected` continuam opcionais.
- **Autenticação:** inalterada (`X-Inbound-Secret`).
- **URLs:** inalteradas.

---

## 10. Próximos passos

1. Deploy Velodesk em ambiente de homologação/produção
2. Contact-Tel validar checklist da seção 7
3. Velotax publicar recado de teste com `telefonesOrigemLiberados` restrito
4. Chamadas de homologação (autorizada e não autorizada)
5. Esvaziar telefones de homologação e validar publicação geral
6. Validar remoção de recado (`items: []`)

---

## 11. Contato técnico

Documentação de integração atualizada: `docs/api-inbound-telephony-parceiro.md`  
Contrato recados v2: `docs/Proposta de contrato v2 para recados operacionais.md`  
Dicionário chamadas: `docs/Dicionário de dados das chamadas da Letícia - agente IA.md`

---

*Relatório gerado pela equipe VeloHub — Velodesk.*
