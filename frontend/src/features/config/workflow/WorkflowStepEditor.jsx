/**
 * WorkflowStepEditor v1.0.0 — formulário de passos[n].passo
 * VERSION: v1.0.0 | DATE: 2026-07-14
 */
import React from 'react';
import WorkflowCriteriaEditor from './WorkflowCriteriaEditor';
import WorkflowRoutesEditor from './WorkflowRoutesEditor';
import { ACAO_TIPOS, ATRIBUICAO_TIPOS } from './workflowConfigData';

export default function WorkflowStepEditor({
  envelope,
  passos = [],
  grupos = [],
  onChange,
  onRemove,
  canRemove = true,
}) {
  const cfg = envelope?.passo || {};

  const patchPasso = (patch) => {
    onChange?.({
      ...envelope,
      passo: { ...cfg, ...patch },
    });
  };

  const patchAtribuicao = (patch) => {
    patchPasso({ atribuicao: { ...(cfg.atribuicao || {}), ...patch } });
  };

  const patchAcao = (patch) => {
    patchPasso({ acao: { ...(cfg.acao || {}), ...patch } });
  };

  return (
    <div className="wf-step-editor">
      <div className="wf-step-editor__grid">
        <label className="wf-step-editor__field">
          <span>Nome da etapa</span>
          <input
            type="text"
            value={cfg.nome || ''}
            onChange={(e) => patchPasso({ nome: e.target.value })}
          />
        </label>
        <label className="wf-step-editor__field">
          <span>Ícone (Tabler)</span>
          <input
            type="text"
            value={cfg.icone || 'ti-circle'}
            onChange={(e) => patchPasso({ icone: e.target.value })}
            placeholder="ti-circle-check"
          />
        </label>
        <label className="wf-step-editor__field">
          <span>SLA (horas)</span>
          <input
            type="number"
            min="0"
            step="1"
            value={cfg.slaHoras ?? ''}
            onChange={(e) => patchPasso({ slaHoras: e.target.value === '' ? null : Number(e.target.value) })}
            placeholder="Opcional"
          />
        </label>
      </div>

      <label className="wf-step-editor__field wf-step-editor__field--full">
        <span>Descrição</span>
        <textarea
          rows={2}
          value={cfg.descricao || ''}
          onChange={(e) => patchPasso({ descricao: e.target.value })}
        />
      </label>

      <section className="wf-step-editor__section">
        <h4>Critérios de validação</h4>
        <WorkflowCriteriaEditor
          criterios={cfg.criterios || []}
          grupos={grupos}
          onChange={(next) => patchPasso({ criterios: next })}
          compact
        />
      </section>

      <section className="wf-step-editor__section">
        <h4>Atribuição (→ tabulacao.atribuido)</h4>
        <div className="wf-step-editor__grid">
          <label className="wf-step-editor__field">
            <span>Tipo</span>
            <select
              value={cfg.atribuicao?.tipo || 'grupo'}
              onChange={(e) => patchAtribuicao({ tipo: e.target.value })}
            >
              {ATRIBUICAO_TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          {cfg.atribuicao?.tipo === 'grupo' ? (
            <label className="wf-step-editor__field">
              <span>Grupo</span>
              <select
                value={cfg.atribuicao?.grupoSlug || ''}
                onChange={(e) => patchAtribuicao({ grupoSlug: e.target.value })}
              >
                <option value="">Selecione…</option>
                {grupos.map((g) => (
                  <option key={g._id || g.slug} value={g.slug}>{g.nome || g.slug}</option>
                ))}
              </select>
            </label>
          ) : null}
          {cfg.atribuicao?.tipo === 'colaborador' ? (
            <label className="wf-step-editor__field">
              <span>Colaborador</span>
              <input
                type="text"
                value={cfg.atribuicao?.colaborador || ''}
                onChange={(e) => patchAtribuicao({ colaborador: e.target.value })}
              />
            </label>
          ) : null}
        </div>
      </section>

      <section className="wf-step-editor__section">
        <h4>Ação</h4>
        <label className="wf-step-editor__field">
          <span>Tipo de ação</span>
          <select
            value={cfg.acao?.tipo || 'manual'}
            onChange={(e) => patchAcao({
              tipo: e.target.value,
              rotas: e.target.value === 'aprovacao' ? (cfg.acao?.rotas?.length ? cfg.acao.rotas : [
                { variavel: 'approve', rotulo: 'Aprovar', proximoPassoId: null, statusTicket: 'em-andamento' },
                { variavel: 'reject', rotulo: 'Reprovar', proximoPassoId: null, statusTicket: 'pendente' },
                { variavel: 'request_info', rotulo: 'Pedir informação', proximoPassoId: null, statusTicket: 'pendente' },
              ]) : [],
            })}
          >
            {ACAO_TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>

        {cfg.acao?.tipo === 'aprovacao' ? (
          <WorkflowRoutesEditor
            rotas={cfg.acao?.rotas || []}
            passos={passos}
            onChange={(next) => patchAcao({ rotas: next })}
          />
        ) : null}
      </section>

      {canRemove ? (
        <button type="button" className="config-action-btn config-action-btn--delete wf-step-editor__remove" onClick={onRemove}>
          Remover etapa
        </button>
      ) : null}
    </div>
  );
}
