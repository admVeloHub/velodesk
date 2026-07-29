# Pacote de exportação — Análise de IA de tickets

Este pacote reúne **todo o conhecimento operacional** construído no WFM (taxonomia, instruções, aliases e exemplos de contexto), além de referências de código e schema, para você importar em **outro CRM** ou repositório.

> Gerado a partir do projeto `wfm_atendimento`. Rode `node scripts/export-ticket-ia-knowledge.js` para atualizar os arquivos de dados.

---

## Conteúdo do pacote

| Arquivo | Descrição |
|---------|-----------|
| `knowledge.json` | **Arquivo único** com tudo (ideal para seed/import) |
| `metadata.json` | Data da exportação, contagens e defaults recomendados |
| `taxonomia-motivos.json` / `.txt` | Lista oficial de motivos (27 rótulos) |
| `instrucoes-outros.txt` | Regras de desambiguação (Celcoin, IR, cobrança, etc.) |
| `contexto-empresa.txt` | Contexto geral do negócio (pode estar vazio) |
| `motivo-aliases.json` / `.txt` | Mapeamentos `de => para` (sinônimos de rótulo) |
| `exemplos-contexto.json` | Exemplos few-shot (título + trecho + motivo confirmado) |
| `CHECKLIST-CODIGO.md` | Arquivos do WFM para copiar/adaptar |
| `prompt-referencia.md` | Estrutura do prompt de classificação |
| `sql/schema-referencia.sql` | Tabelas genéricas sugeridas no projeto destino |
| `seed-ticket-ia.example.js` | Script de exemplo para importar `knowledge.json` no Supabase |

---

## Como usar no projeto novo (passo a passo)

### 1. Importar o conhecimento

Opção A — **JSON único** (`knowledge.json`):

```typescript
import knowledge from './knowledge.json';

await seedSettings({
  contextoEmpresa: knowledge.contextoEmpresa,
  instrucoesOutros: knowledge.instrucoesOutros,
  taxonomiaMotivos: knowledge.taxonomiaMotivos.join('\n'),
  motivoAliases: knowledge.motivoAliases.map(a => `${a.de} => ${a.para}`).join('\n'),
});
```

Opção B — **Arquivos `.txt`**: cole o conteúdo nas telas de configuração da IA (equivalente ao `IaContextoEditor` do WFM).

### 2. Mapear campos do CRM novo

| Conceito | WFM (Octadesk) | Seu CRM (adaptar) |
|----------|----------------|-------------------|
| ID interno | `ticket_id` | `id` |
| Número visível | `ticket_number` | `protocol` / `number` |
| Título | `summary` | `subject` / `title` |
| Descrição | `description_as_text` | `body` / `message` |
| Canal | `channel_name` + tags | `source` / `channel` |
| Atualização | `last_date_update` | `updated_at` |

### 3. Copiar/adaptar o código

Veja `CHECKLIST-CODIGO.md` — copie as libs genéricas e reimplemente só o **adapter** do CRM.

### 4. Criar as tabelas

Execute `sql/schema-referencia.sql` no Supabase (ou Postgres) do projeto novo, ajustando nomes e FK para sua tabela de tickets.

### 5. Fluxo recomendado de aprendizado

1. **Corrigir ticket na UI** → grava cache + exemplo de contexto automaticamente  
2. **Aliases** → só quando for sinônimo puro de rótulo (checkbox desmarcado por padrão)  
3. **Instruções Outros** → regras gerais escritas pelo gestor  
4. **Exemplos** → few-shot no prompt (até 3 por motivo, 60 no total)

---

## O que NÃO importar

- Cache completo `octadesk_ticket_ia_analise` — parte foi gerada com aliases errados antes da revisão de 28/07/2026  
- Código Octadesk-specific: sync, canais Letícia IA, KPIs de volumetria  
- Tickets com `origem='manual'` antigos sem revisão — prefira recomeçar exemplos com correções novas no CRM destino  

---

## Variáveis de ambiente (projeto destino)

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini   # opcional; padrão gpt-5-mini
```

---

## Atualizar este pacote

No repositório WFM:

```bash
node scripts/export-ticket-ia-knowledge.js
```

Os arquivos em `exports/ticket-ia-knowledge/` serão sobrescritos com o estado atual do Supabase.
