/**
 * WorkflowRequisicaoFieldsEditor v1.2.2 — key estável; id só no blur
 * VERSION: v1.2.2 | DATE: 2026-07-23
 */
import React from 'react';
import {
  REQUISICAO_CAMPO_TIPOS,
  isReservedRequisicaoFieldId,
  slugifyRequisicaoLabel,
} from '../../../services/workflow/workflowRequisicao';

function resolveCampoListKey(campo, index) {
  return campo._clientKey || campo.id || `idx-${index}`;
}

function resolveExistingIds(list, skipIndex) {
  return list
    .filter((_, i) => i !== skipIndex)
    .map((c) => c.id)
    .filter(Boolean);
}

export default function WorkflowRequisicaoFieldsEditor({
  campos = [],
  gatilho,
  onChange,
}) {
  const list = campos || [];

  const updateCampo = (index, patch) => {
    const next = list.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange?.(next.map((row, ordem) => ({ ...row, ordem })));
  };

  const syncCampoIdFromLabel = (index) => {
    const row = list[index];
    if (!row) return;
    const others = resolveExistingIds(list, index);
    const id = slugifyRequisicaoLabel(row.label, gatilho, others);
    if (id === row.id) return;
    updateCampo(index, { id });
  };

  const removeCampo = (index) => {
    onChange?.(list.filter((_, i) => i !== index).map((row, ordem) => ({ ...row, ordem })));
  };

  const addOpcao = (index) => {
    const row = list[index];
    const opcoes = [...(row.opcoes || []), { valor: '', label: '' }];
    updateCampo(index, { opcoes });
  };

  const updateOpcao = (campoIndex, opcaoIndex, patch) => {
    const row = list[campoIndex];
    const opcoes = (row.opcoes || []).map((o, i) => (i === opcaoIndex ? { ...o, ...patch } : o));
    updateCampo(campoIndex, { opcoes });
  };

  const removeOpcao = (campoIndex, opcaoIndex) => {
    const row = list[campoIndex];
    updateCampo(campoIndex, { opcoes: (row.opcoes || []).filter((_, i) => i !== opcaoIndex) });
  };

  return (
    <div className="wf-config-requisicao">
      <p className="wf-config-requisicao__hint">
        Campos complementares preenchidos ao iniciar o workflow. Não inclua CPF, produto, motivo ou detalhe — já vêm da tabulação.
      </p>

      <ul className="wf-config-requisicao__list">
        {list.map((campo, index) => {
          const previewId = campo.label.trim()
            ? slugifyRequisicaoLabel(campo.label, gatilho, resolveExistingIds(list, index))
            : '';
          const reserved = Boolean(previewId) && isReservedRequisicaoFieldId(previewId, gatilho);
          return (
            <li key={resolveCampoListKey(campo, index)} className="wf-config-requisicao__item">
              <div className="wf-config-requisicao__row">
                <label className="wf-config-requisicao__field">
                  <span>Rótulo</span>
                  <input
                    type="text"
                    value={campo.label}
                    placeholder="Rótulo do campo"
                    onChange={(e) => updateCampo(index, { label: e.target.value })}
                    onBlur={() => syncCampoIdFromLabel(index)}
                  />
                </label>
                <label className="wf-config-requisicao__field">
                  <span>Tipo</span>
                  <select
                    value={campo.tipo}
                    onChange={(e) => updateCampo(index, { tipo: e.target.value })}
                  >
                    {REQUISICAO_CAMPO_TIPOS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
                <label className="wf-config-requisicao__check">
                  <input
                    type="checkbox"
                    checked={campo.obrigatorio === true}
                    onChange={(e) => updateCampo(index, { obrigatorio: e.target.checked })}
                  />
                  <span>Obrigatório</span>
                </label>
                <button
                  type="button"
                  className="wf-config-requisicao__remove"
                  onClick={() => removeCampo(index)}
                  aria-label="Remover campo"
                >
                  <i className="ti ti-trash" aria-hidden="true" />
                </button>
              </div>

              <label className="wf-config-requisicao__field wf-config-requisicao__field--full">
                <span>Ajuda (opcional)</span>
                <input
                  type="text"
                  value={campo.ajuda || ''}
                  onChange={(e) => updateCampo(index, { ajuda: e.target.value })}
                />
              </label>

              {reserved ? (
                <p className="wf-config-requisicao__warn">Este rótulo conflita com dados do ticket ou gatilho e será ignorado.</p>
              ) : null}

              {campo.tipo === 'select' ? (
                <div className="wf-config-requisicao__opcoes">
                  <div className="wf-config-requisicao__opcoes-head">
                    <span>Opções</span>
                    <button type="button" className="wf-config-requisicao__add-opcao" onClick={() => addOpcao(index)}>
                      + Opção
                    </button>
                  </div>
                  {(campo.opcoes || []).map((opcao, opcaoIndex) => (
                    <div key={opcaoIndex} className="wf-config-requisicao__opcao-row">
                      <input
                        type="text"
                        placeholder="Valor"
                        value={opcao.valor}
                        onChange={(e) => updateOpcao(index, opcaoIndex, { valor: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Rótulo"
                        value={opcao.label}
                        onChange={(e) => updateOpcao(index, opcaoIndex, { label: e.target.value })}
                      />
                      <button type="button" onClick={() => removeOpcao(index, opcaoIndex)} aria-label="Remover opção">
                        <i className="ti ti-x" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
