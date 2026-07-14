/**
 * WorkflowCriteriaEditor v2.1.1 — floating labels gatilho corrigidos
 * VERSION: v2.1.1 | DATE: 2026-07-14
 */
import React, { useMemo } from 'react';
import { useTabulation } from '../../../context/TabulationContext';
import {
  CRITERIO_CAMPOS,
  CRITERIO_CAMPOS_INTEGRACAO,
  CRITERIO_FONTES,
  CRITERIO_OPERADORES,
  GATILHO_CRITERIO_OPCOES,
  criterioOptionKey,
  getIntegracaoValoresForCampo,
  parseCriterioOptionKey,
  resolveGatilhoCascadeContext,
} from './workflowConfigData';

function emptyCriterio(mode) {
  if (mode === 'gatilho') {
    return { fonte: 'tabulacao', campo: '', operador: 'equals', valor: '' };
  }
  return { fonte: 'tabulacao', campo: 'produto', operador: 'contains', valor: '' };
}

function defaultCampoForFonte(fonte, grupos) {
  if (fonte === 'grupo_responsabilidade') return grupos[0]?.slug || '';
  if (fonte === 'integracao') return CRITERIO_CAMPOS_INTEGRACAO[0]?.value || 'statusPagamento';
  return 'produto';
}

function clearDependentTabulationValues(rows, campo) {
  if (campo === 'produto') {
    return rows.map((row) => (
      row.fonte === 'tabulacao' && (row.campo === 'motivo' || row.campo === 'detalhe')
        ? { ...row, valor: '' }
        : row
    ));
  }
  if (campo === 'motivo') {
    return rows.map((row) => (
      row.fonte === 'tabulacao' && row.campo === 'detalhe' ? { ...row, valor: '' } : row
    ));
  }
  return rows;
}

function FloatingField({
  label,
  filled,
  children,
  className = '',
}) {
  return (
    <label className={'wf-float-field' + (filled ? ' is-filled' : '') + (className ? ` ${className}` : '')}>
      {children}
      <span className="wf-float-field__label">{label}</span>
    </label>
  );
}

export default function WorkflowCriteriaEditor({
  criterios = [],
  grupos = [],
  onChange,
  compact = false,
  mode = 'step',
  hideAddButton = false,
}) {
  const tabulation = useTabulation();
  const list = criterios.length ? criterios : [];
  const cascade = useMemo(() => resolveGatilhoCascadeContext(list), [list]);
  const isGatilho = mode === 'gatilho';

  const updateRow = (index, patch) => {
    let next = list.map((row, i) => {
      if (i !== index) return row;
      const merged = { ...row, ...patch };
      if (isGatilho) merged.operador = 'equals';
      return merged;
    });
    const updated = next[index];

    if (isGatilho && updated?.fonte === 'tabulacao') {
      if (patch.campo !== undefined && patch.campo !== list[index]?.campo) {
        next = clearDependentTabulationValues(next, patch.campo);
      }
      if (patch.valor !== undefined && updated.campo === 'produto') {
        next = clearDependentTabulationValues(next, 'produto');
      }
      if (patch.valor !== undefined && updated.campo === 'motivo') {
        next = clearDependentTabulationValues(next, 'motivo');
      }
    }

    onChange?.(next);
  };

  const removeRow = (index) => {
    onChange?.(list.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange?.([...list, emptyCriterio(mode)]);
  };

  const getTabulationValueOptions = (campo) => {
    switch (campo) {
      case 'tipoChamado':
        return (tabulation?.getTipoChamadoOptions?.() || []).map((value) => ({ value, label: value }));
      case 'produto':
        return (tabulation?.getProdutoNames?.() || []).map((value) => ({ value, label: value }));
      case 'motivo':
        return (tabulation?.getMotivos?.(cascade.produto) || []).map((value) => ({ value, label: value }));
      case 'detalhe':
        return (tabulation?.getDetalhes?.(cascade.produto, cascade.motivo) || []).map((value) => ({
          value,
          label: value,
        }));
      default:
        return [];
    }
  };

  const renderGatilhoCampoSelect = (row, index) => {
    const key = row.campo ? criterioOptionKey(row.fonte, row.campo) : '';
    return (
      <FloatingField label="Campo" filled={Boolean(key)}>
        <select
          className="wf-float-field__control"
          value={key}
          onChange={(e) => {
            const raw = e.target.value;
            if (!raw) {
              updateRow(index, { fonte: 'tabulacao', campo: '', operador: 'equals', valor: '' });
              return;
            }
            const { fonte, campo } = parseCriterioOptionKey(raw);
            updateRow(index, { fonte, campo, operador: 'equals', valor: '' });
          }}
        >
          <option value="" disabled hidden />
          {GATILHO_CRITERIO_OPCOES.map((option) => (
            <option key={criterioOptionKey(option.fonte, option.campo)} value={criterioOptionKey(option.fonte, option.campo)}>
              {option.label}
            </option>
          ))}
        </select>
      </FloatingField>
    );
  };

  const renderGatilhoValorSelect = (row, index, options, disabled = false) => (
    <FloatingField label="Valor" filled={Boolean(row.valor)}>
      <select
        className="wf-float-field__control"
        value={row.valor || ''}
        disabled={disabled}
        onChange={(e) => updateRow(index, { valor: e.target.value, operador: 'equals' })}
      >
        <option value="" disabled hidden />
        {options.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
    </FloatingField>
  );

  const renderGatilhoValorField = (row, index) => {
    if (!row.campo) {
      return renderGatilhoValorSelect(row, index, [], true);
    }

    if (row.fonte === 'integracao') {
      const options = getIntegracaoValoresForCampo(row.campo);
      if (options.length) return renderGatilhoValorSelect(row, index, options);
    }

    if (row.fonte === 'tabulacao') {
      if (row.campo === 'motivo' && !cascade.produto) {
        return renderGatilhoValorSelect(row, index, [], true);
      }
      if (row.campo === 'detalhe' && (!cascade.produto || !cascade.motivo)) {
        return renderGatilhoValorSelect(row, index, [], true);
      }
      const options = getTabulationValueOptions(row.campo);
      if (options.length || ['tipoChamado', 'produto', 'motivo', 'detalhe'].includes(row.campo)) {
        return renderGatilhoValorSelect(row, index, options);
      }
    }

    return (
      <FloatingField label="Valor" filled={Boolean(row.valor)}>
        <input
          type="text"
          className="wf-float-field__control"
          value={row.valor || ''}
          onChange={(e) => updateRow(index, { valor: e.target.value, operador: 'equals' })}
        />
      </FloatingField>
    );
  };

  const renderIntegracaoValorSelect = (row, index, options) => (
    <select
      value={row.valor || ''}
      onChange={(e) => updateRow(index, { valor: e.target.value })}
      aria-label="Valor da integração"
    >
      <option value="">Selecione…</option>
      {options.map((item) => (
        <option key={item.value} value={item.value}>{item.label}</option>
      ))}
    </select>
  );

  const renderTabulationValorSelect = (row, index, options, hint) => {
    if (hint) {
      return (
        <select disabled aria-label="Valor" title={hint}>
          <option value="">{hint}</option>
        </select>
      );
    }
    return (
      <select
        value={row.valor || ''}
        onChange={(e) => updateRow(index, { valor: e.target.value })}
        aria-label="Valor"
      >
        <option value="">Selecione…</option>
        {options.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
    );
  };

  const renderValorInput = (row, index) => {
    if (row.fonte === 'grupo_responsabilidade' || row.operador === 'not_empty') {
      return <span className="wf-criteria-editor__spacer" aria-hidden="true" />;
    }

    if (row.fonte === 'integracao' && row.operador !== 'in') {
      const options = getIntegracaoValoresForCampo(row.campo);
      if (options.length) {
        return renderIntegracaoValorSelect(row, index, options);
      }
    }

    if (isGatilho && row.fonte === 'tabulacao') {
      if (row.campo === 'motivo' && !cascade.produto) {
        return renderTabulationValorSelect(row, index, [], 'Selecione um produto primeiro');
      }
      if (row.campo === 'detalhe' && !cascade.produto) {
        return renderTabulationValorSelect(row, index, [], 'Selecione um produto primeiro');
      }
      if (row.campo === 'detalhe' && !cascade.motivo) {
        return renderTabulationValorSelect(row, index, [], 'Selecione um motivo primeiro');
      }
      const options = getTabulationValueOptions(row.campo);
      if (options.length || ['tipoChamado', 'produto', 'motivo', 'detalhe'].includes(row.campo)) {
        return renderTabulationValorSelect(row, index, options);
      }
    }

    return (
      <input
        type="text"
        value={row.valor || ''}
        onChange={(e) => updateRow(index, { valor: e.target.value })}
        placeholder={row.fonte === 'integracao' ? 'Valor da integração' : 'Valor'}
        aria-label="Valor"
      />
    );
  };

  const renderStepFonteCampo = (row, index) => (
    <>
      <select
        value={row.fonte || 'tabulacao'}
        onChange={(e) => {
          const fonte = e.target.value;
          updateRow(index, { fonte, campo: defaultCampoForFonte(fonte, grupos), valor: '' });
        }}
        aria-label="Fonte do critério"
      >
        {CRITERIO_FONTES.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      {row.fonte === 'grupo_responsabilidade' ? (
        <select
          value={row.campo || ''}
          onChange={(e) => updateRow(index, { campo: e.target.value, valor: e.target.value })}
          aria-label="Grupo"
        >
          <option value="">Selecione…</option>
          {grupos.map((g) => (
            <option key={g._id || g.slug} value={g.slug}>{g.nome || g.slug}</option>
          ))}
        </select>
      ) : row.fonte === 'integracao' ? (
        <select
          value={row.campo || 'statusPagamento'}
          onChange={(e) => updateRow(index, { campo: e.target.value, valor: '' })}
          aria-label="Campo de integração"
        >
          {CRITERIO_CAMPOS_INTEGRACAO.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      ) : (
        <select
          value={row.campo || 'produto'}
          onChange={(e) => updateRow(index, { campo: e.target.value, valor: '' })}
          aria-label="Campo"
        >
          {CRITERIO_CAMPOS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      )}
    </>
  );

  const rootClass = [
    'wf-criteria-editor',
    compact ? 'wf-criteria-editor--compact' : '',
    isGatilho ? 'wf-criteria-editor--gatilho' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      {list.length > 0 ? (
        <ul className="wf-criteria-editor__list">
          {list.map((row, index) => (
            <li key={`crit-${index}`} className="wf-criteria-editor__row">
              {isGatilho ? (
                <>
                  {renderGatilhoCampoSelect(row, index)}
                  {renderGatilhoValorField(row, index)}
                </>
              ) : (
                <>
                  {renderStepFonteCampo(row, index)}
                  <select
                    value={row.operador || 'equals'}
                    onChange={(e) => updateRow(index, { operador: e.target.value })}
                    aria-label="Operador"
                  >
                    {CRITERIO_OPERADORES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {renderValorInput(row, index)}
                </>
              )}

              <button
                type="button"
                className="config-action-btn config-action-btn--delete wf-criteria-editor__remove"
                onClick={() => removeRow(index)}
                aria-label="Remover critério"
              >
                <i className="ti ti-trash" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : !isGatilho ? (
        <p className="wf-criteria-editor__empty">Nenhum critério.</p>
      ) : null}

      {!hideAddButton && (
        <button type="button" className="wf-criteria-editor__add" onClick={addRow}>
          <i className="ti ti-plus" aria-hidden="true" />
          Adicionar critério
        </button>
      )}
    </div>
  );
}
