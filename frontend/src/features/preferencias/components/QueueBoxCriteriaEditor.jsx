/**
 * Editor multi-critério para caixas personalizadas
 * VERSION: v1.0.0 | DATE: 2026-07-30
 */
import React from 'react';
import { useTabulation } from '../../../context/TabulationContext';

const CRITERIO_TIPOS = [
  { value: 'tabulacao', label: 'Tabulação' },
  { value: 'status', label: 'Status' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'atribuido', label: 'Atribuído' },
  { value: 'sla', label: 'SLA' },
];

const TAB_CAMPOS = [
  { value: 'tipoChamado', label: 'Tipo de chamado' },
  { value: 'produto', label: 'Produto' },
  { value: 'motivo', label: 'Motivo' },
  { value: 'detalhe', label: 'Detalhe' },
];

const STATUS_OPTIONS = [
  { value: 'novo', label: 'Novo' },
  { value: 'em-andamento', label: 'Em andamento' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'resolvido', label: 'Resolvido' },
  { value: 'fechado', label: 'Fechado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const WORKFLOW_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
];

const SLA_OPTIONS = [
  { value: 'ok', label: 'OK' },
  { value: 'warning', label: 'Atenção' },
  { value: 'critical', label: 'Crítico' },
];

const ATRIBUIDO_SHORTCUTS = [
  { value: '__me__', label: 'Eu (agente logado)' },
  { value: '__empty__', label: 'Vazio (sem atribuído)' },
];

function emptyCriterio() {
  return { tipo: 'status', campo: 'status', operador: 'equals', valor: 'em-andamento' };
}

export default function QueueBoxCriteriaEditor({ criterios = [], onChange }) {
  const {
    getProdutoNames,
    getTipoChamadoOptions,
    resolveMotivoOptions,
    resolveDetalheOptions,
  } = useTabulation();

  const list = Array.isArray(criterios) ? criterios : [];

  const updateRow = (index, patch) => {
    onChange?.(list.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index) => {
    onChange?.(list.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange?.([...list, emptyCriterio()]);
  };

  const tabValorOptions = (campo, rows) => {
    const produto = rows.find((r) => r.tipo === 'tabulacao' && r.campo === 'produto')?.valor || '';
    const motivo = rows.find((r) => r.tipo === 'tabulacao' && r.campo === 'motivo')?.valor || '';
    switch (campo) {
      case 'tipoChamado':
        return (getTipoChamadoOptions?.() || []).map((value) => ({ value, label: value }));
      case 'produto':
        return (getProdutoNames?.() || []).map((value) => ({ value, label: value }));
      case 'motivo':
        return (resolveMotivoOptions?.(produto) || []).map((value) => ({ value, label: value }));
      case 'detalhe':
        return (resolveDetalheOptions?.(produto, motivo) || []).map((value) => ({ value, label: value }));
      default:
        return [];
    }
  };

  const renderValor = (row, index) => {
    const tipo = row.tipo || 'status';

    if (tipo === 'status') {
      return (
        <select
          className="queue-box-criteria__control"
          value={row.valor || ''}
          onChange={(e) => updateRow(index, { valor: e.target.value, campo: 'status', operador: 'equals' })}
          aria-label="Status"
        >
          <option value="">Selecione…</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    }

    if (tipo === 'workflow') {
      return (
        <select
          className="queue-box-criteria__control"
          value={row.valor || ''}
          onChange={(e) => updateRow(index, { valor: e.target.value, campo: 'workflow', operador: 'equals' })}
          aria-label="Workflow"
        >
          <option value="">Selecione…</option>
          {WORKFLOW_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    }

    if (tipo === 'sla') {
      return (
        <select
          className="queue-box-criteria__control"
          value={row.valor || ''}
          onChange={(e) => updateRow(index, { valor: e.target.value, campo: 'sla', operador: 'equals' })}
          aria-label="SLA"
        >
          <option value="">Selecione…</option>
          {SLA_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    }

    if (tipo === 'atribuido') {
      const isShortcut = row.valor === '__me__' || row.valor === '__empty__';
      return (
        <div className="queue-box-criteria__atribuido">
          <select
            className="queue-box-criteria__control"
            value={isShortcut ? row.valor : '__custom__'}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '__custom__') {
                updateRow(index, { valor: '', campo: 'atribuido', operador: 'equals' });
                return;
              }
              updateRow(index, { valor: v, campo: 'atribuido', operador: 'equals' });
            }}
            aria-label="Atribuído"
          >
            {ATRIBUIDO_SHORTCUTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
            <option value="__custom__">Nome específico…</option>
          </select>
          {!isShortcut ? (
            <input
              type="text"
              className="queue-box-criteria__control"
              value={row.valor || ''}
              onChange={(e) => updateRow(index, { valor: e.target.value, campo: 'atribuido', operador: 'equals' })}
              placeholder="Nome do responsável"
              aria-label="Nome do atribuído"
            />
          ) : null}
        </div>
      );
    }

    // tabulacao
    const options = tabValorOptions(row.campo, list);
    if (options.length) {
      return (
        <select
          className="queue-box-criteria__control"
          value={row.valor || ''}
          onChange={(e) => updateRow(index, { valor: e.target.value })}
          aria-label="Valor da tabulação"
        >
          <option value="">Selecione…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="text"
        className="queue-box-criteria__control"
        value={row.valor || ''}
        onChange={(e) => updateRow(index, { valor: e.target.value })}
        placeholder="Valor"
        aria-label="Valor da tabulação"
      />
    );
  };

  return (
    <div className="queue-box-criteria">
      {list.length > 0 ? (
        <ul className="queue-box-criteria__list">
          {list.map((row, index) => (
            <li key={`box-crit-${index}`} className="queue-box-criteria__row">
              <select
                className="queue-box-criteria__control"
                value={row.tipo || 'status'}
                onChange={(e) => {
                  const tipo = e.target.value;
                  if (tipo === 'tabulacao') {
                    updateRow(index, { tipo, campo: 'produto', operador: 'equals', valor: '' });
                  } else if (tipo === 'atribuido') {
                    updateRow(index, { tipo, campo: 'atribuido', operador: 'equals', valor: '__me__' });
                  } else if (tipo === 'status') {
                    updateRow(index, { tipo, campo: 'status', operador: 'equals', valor: 'em-andamento' });
                  } else if (tipo === 'workflow') {
                    updateRow(index, { tipo, campo: 'workflow', operador: 'equals', valor: 'ativo' });
                  } else {
                    updateRow(index, { tipo, campo: 'sla', operador: 'equals', valor: 'ok' });
                  }
                }}
                aria-label="Tipo de critério"
              >
                {CRITERIO_TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              {row.tipo === 'tabulacao' ? (
                <select
                  className="queue-box-criteria__control"
                  value={row.campo || 'produto'}
                  onChange={(e) => updateRow(index, { campo: e.target.value, valor: '', operador: 'equals' })}
                  aria-label="Campo de tabulação"
                >
                  {TAB_CAMPOS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              ) : null}

              {row.tipo === 'tabulacao' ? (
                <select
                  className="queue-box-criteria__control queue-box-criteria__control--op"
                  value={row.operador || 'equals'}
                  onChange={(e) => updateRow(index, { operador: e.target.value })}
                  aria-label="Operador"
                >
                  <option value="equals">igual a</option>
                  <option value="contains">contém</option>
                </select>
              ) : null}

              {renderValor(row, index)}

              <button
                type="button"
                className="queue-box-criteria__remove"
                onClick={() => removeRow(index)}
                aria-label="Remover critério"
                title="Remover"
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="queue-box-criteria__empty">Nenhum critério. Adicione ao menos um filtro (combinados com E).</p>
      )}

      <button type="button" className="queue-box-criteria__add" onClick={addRow}>
        <i className="ti ti-plus" aria-hidden="true" /> Adicionar critério
      </button>
    </div>
  );
}
