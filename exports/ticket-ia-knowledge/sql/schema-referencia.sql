-- ============================================================================
-- Schema de referência (genérico) — Análise de IA de tickets
-- Adaptado das migrations 117, 118, 119 e 123 do wfm_atendimento.
-- Ajuste nomes de tabela/FK para o CRM destino antes de executar.
-- ============================================================================

-- Configurações (pode usar system_settings ou tabela dedicada)
-- Chaves sugeridas:
--   ticket_ia_contexto_empresa
--   ticket_ia_instrucoes_outros
--   ticket_ia_taxonomia_motivos   (um motivo por linha)
--   ticket_ia_motivo_aliases      (formato: de => para, uma linha por alias)
--   ticket_ia_max_tickets         (padrão: 200)
--   ticket_ia_contexto_versao     (incrementa a cada save de contexto)

-- Cache de classificação por ticket
CREATE TABLE IF NOT EXISTS public.ticket_ia_analise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT NOT NULL UNIQUE,  -- FK para sua tabela de tickets
  ticket_number TEXT,              -- número visível ao usuário (opcional)
  motivo TEXT NOT NULL,
  motivo_novo BOOLEAN NOT NULL DEFAULT false,
  sentimento_classe TEXT NOT NULL,
  caso_grave_tipo TEXT,
  caso_grave_trecho TEXT,
  modelo TEXT NOT NULL,
  contexto_versao INTEGER NOT NULL,
  ticket_updated_at TIMESTAMPTZ NOT NULL,
  texto_hash TEXT,                 -- SHA-256 de titulo+descricao (migration 119)
  analisado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  needs_reanalysis BOOLEAN NOT NULL DEFAULT false,
  reanalise_motivo TEXT,
  origem TEXT NOT NULL DEFAULT 'auto',  -- 'auto' | 'manual'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_ia_analise_needs_reanalysis
  ON public.ticket_ia_analise(needs_reanalysis) WHERE needs_reanalysis;
CREATE INDEX IF NOT EXISTS idx_ticket_ia_analise_motivo
  ON public.ticket_ia_analise(motivo);

-- Exemplos de contexto (few-shot) — gerados ao corrigir tickets manualmente
CREATE TABLE IF NOT EXISTS public.ticket_ia_exemplo_motivo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  motivo TEXT NOT NULL,
  titulo TEXT,
  trecho_descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_ia_exemplo_motivo_motivo
  ON public.ticket_ia_exemplo_motivo(motivo) WHERE ativo;

COMMENT ON TABLE public.ticket_ia_analise IS
  'Cache de classificação de IA por ticket (motivo, sentimento, caso grave).';
COMMENT ON TABLE public.ticket_ia_exemplo_motivo IS
  'Exemplos reais (título + trecho + motivo) para few-shot no prompt de classificação.';
