/**
 * Editor multi-critério para caixas personalizadas (seleção múltipla por categoria)
 * VERSION: v1.1.1 | DATE: 2026-07-31
 */
import React from 'react';
import { useTabulation } from '../../../context/TabulationContext';
import CriteriaMultiSelect from './CriteriaMultiSelect';

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

function rowValores(row) {
  if (Array.isArray(row?.valores) && row.valores.length) return row.valores;
  const single = String(row?.valor ?? '').trim();
  return single ? [single] : [];
}

function patchValores(row, valores) {
  const list = (valores || []).map((v) => String(v).trim()).filter(Boolean);
  return { ...row, valores: list, valor: list[0] || '' };
}

function emptyCriterio() {
  return {
    tipo: 'status',
    campo: 'status',
    operador: 'equals',
    valor: 'em-andamento',
    valores: ['em-andamento'],
  };
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

  const updateRowValores = (index, valores) => {
    updateRow(index, patchValores(list[index], valores));
  };

  const removeRow = (index) => {
    onChange?.(list.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange?.([...list, emptyCriterio()]);
  };

  const tabValorOptions = (campo, rows) => {
    const produtoRows = rows.filter((r) => r.tipo === 'tabulacao' && r.campo === 'produto');
    const produtoValores = produtoRows.flatMap((r) => rowValores(r));
    const produto = produtoValores[0] || '';
    const motivoRows = rows.filter((r) => r.tipo === 'tabulacao' && r.campo === 'motivo');
    const motivoValores = motivoRows.flatMap((r) => rowValores(r));
    const motivo = motivoValores[0] || '';
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
        <CriteriaMultiSelect
          options={STATUS_OPTIONS}
          values={rowValores(row)}
          onChange={(next) => updateRowValores(index, next)}
          placeholder="Selecione status…"
          ariaLabel="Status"
        />
      );
    }

    if (tipo === 'workflow') {
      return (
        <CriteriaMultiSelect
          options={WORKFLOW_OPTIONS}
          values={rowValores(row)}
          onChange={(next) => updateRowValores(index, next)}
          placeholder="Selecione workflow…"
          ariaLabel="Workflow"
        />
      );
    }

    if (tipo === 'sla') {
      return (
        <CriteriaMultiSelect
          options={SLA_OPTIONS}
          values={rowValores(row)}
          onChange={(next) => updateRowValores(index, next)}
          placeholder="Selecione SLA…"
          ariaLabel="SLA"
        />
      );
    }

    if (tipo === 'atribuido') {
      const current = rowValores(row)[0] || '';
      const isShortcut = current === '__me__' || current === '__empty__';
      return (
        <div className="queue-box-criteria__atribuido">
          <select
            className="queue-box-criteria__control"
            value={isShortcut ? current : '__custom__'}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '__custom__') {
                updateRow(index, patchValores({ ...row, campo: 'atribuido', operador: 'equals' }, []));
                return;
              }
              updateRow(index, patchValores({ ...row, campo: 'atribuido', operador: 'equals' }, [v]));
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
              value={current}
              onChange={(e) => updateRow(
                index,
                patchValores({ ...row, campo: 'atribuido', operador: 'equals' }, [e.target.value]),
              )}
              placeholder="Nome do responsável"
              aria-label="Nome do atribuído"
            />
          ) : null}
        </div>
      );
    }

    const options = tabValorOptions(row.campo, list);
    if (options.length) {
      return (
        <CriteriaMultiSelect
          options={options}
          values={rowValores(row)}
          onChange={(next) => updateRowValores(index, next)}
          placeholder={`Selecione ${TAB_CAMPOS.find((c) => c.value === row.campo)?.label?.toLowerCase() || 'valores'}…`}
          ariaLabel="Valor da tabulação"
        />
      );
    }

    return (
      <input
        type="text"
        className="queue-box-criteria__control"
        value={rowValores(row).join(', ')}
        onChange={(e) => {
          const parts = String(e.target.value || '')
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
          updateRowValores(index, parts);
        }}
        placeholder="Valores separados por vírgula"
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
              <div className="queue-box-criteria__head">
                <select
                  className="queue-box-criteria__control queue-box-criteria__control--tipo"
                  value={row.tipo || 'status'}
                  onChange={(e) => {
                    const tipo = e.target.value;
                    if (tipo === 'tabulacao') {
                      updateRow(index, { tipo, campo: 'produto', operador: 'equals', valores: [], valor: '' });
                    } else if (tipo === 'atribuido') {
                      updateRow(index, patchValores({ tipo, campo: 'atribuido', operador: 'equals' }, ['__me__']));
                    } else if (tipo === 'status') {
                      updateRow(index, patchValores({ tipo, campo: 'status', operador: 'equals' }, ['em-andamento']));
                    } else if (tipo === 'workflow') {
                      updateRow(index, patchValores({ tipo, campo: 'workflow', operador: 'equals' }, ['ativo']));
                    } else {
                      updateRow(index, patchValores({ tipo, campo: 'sla', operador: 'equals' }, ['ok']));
                    }
                  }}
                  aria-label="Tipo de critério"
                >
                  {CRITERIO_TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>

                <button
                  type="button"
                  className="queue-box-criteria__remove"
                  onClick={() => removeRow(index)}
                  aria-label="Remover critério"
                  title="Remover critério"
                >
                  <i className="ti ti-trash" aria-hidden="true" />
                </button>
              </div>

              {row.tipo === 'tabulacao' ? (
                <select
                  className="queue-box-criteria__control queue-box-criteria__control--campo"
                  value={row.campo || 'produto'}
                  onChange={(e) => updateRow(index, {
                    campo: e.target.value,
                    operador: 'equals',
                    valores: [],
                    valor: '',
                  })}
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

              <div className="queue-box-criteria__valor">
                {renderValor(row, index)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="queue-box-criteria__empty">
          Nenhum critério. Adicione ao menos um filtro (combinados com E; múltiplas opções na mesma linha usam OU).
        </p>
      )}

      <button type="button" className="queue-box-criteria__add" onClick={addRow}>
        <i className="ti ti-plus" aria-hidden="true" /> Adicionar critério
      </button>
    </div>
  );
}
