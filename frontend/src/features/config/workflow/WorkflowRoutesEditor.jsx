/**
 * WorkflowRoutesEditor v1.0.0 — rotas de decisão por variável
 * VERSION: v1.0.0 | DATE: 2026-07-14
 */
import React from 'react';
import { ROTA_VARIAVEIS } from './workflowConfigData';

const STATUS_OPTIONS = [
  { value: '', label: '— manter —' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'em-andamento', label: 'Em andamento' },
  { value: 'resolvido', label: 'Resolvido' },
];

function emptyRota() {
  return { variavel: 'approve', rotulo: 'Aprovar', proximoPassoId: null, statusTicket: '' };
}

export default function WorkflowRoutesEditor({ rotas = [], passos = [], onChange }) {
  const list = rotas.length ? rotas : [];

  const passoOptions = (passos || [])
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((p, index) => ({
      id: p._id ? String(p._id) : '',
      label: p.passo?.nome || `Etapa ${index + 1}`,
    }))
    .filter((p) => p.id);

  const updateRow = (index, patch) => {
    onChange?.(list.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index) => {
    onChange?.(list.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange?.([...list, emptyRota()]);
  };

  return (
    <div className="wf-routes-editor">
      {list.length === 0 ? (
        <p className="wf-routes-editor__empty">Defina ao menos uma rota para etapas de aprovação.</p>
      ) : (
        <table className="config-table wf-routes-editor__table">
          <thead>
            <tr>
              <th>Variável</th>
              <th>Rótulo</th>
              <th>Próximo passo</th>
              <th>Status ticket</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((row, index) => (
              <tr key={`rota-${index}`}>
                <td>
                  <select
                    value={row.variavel || 'approve'}
                    onChange={(e) => updateRow(index, { variavel: e.target.value })}
                  >
                    {ROTA_VARIAVEIS.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={row.rotulo || ''}
                    onChange={(e) => updateRow(index, { rotulo: e.target.value })}
                    placeholder="Rótulo do botão"
                  />
                </td>
                <td>
                  <select
                    value={row.proximoPassoId ? String(row.proximoPassoId) : ''}
                    onChange={(e) => updateRow(index, { proximoPassoId: e.target.value || null })}
                  >
                    <option value="">Sequencial / fim</option>
                    {passoOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={row.statusTicket || ''}
                    onChange={(e) => updateRow(index, { statusTicket: e.target.value || null })}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value || 'keep'} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="config-action-btn config-action-btn--delete"
                    onClick={() => removeRow(index)}
                    aria-label="Remover rota"
                  >
                    <i className="ti ti-trash" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button type="button" className="wf-routes-editor__add" onClick={addRow}>
        <i className="ti ti-plus" aria-hidden="true" />
        Adicionar rota
      </button>
    </div>
  );
}
