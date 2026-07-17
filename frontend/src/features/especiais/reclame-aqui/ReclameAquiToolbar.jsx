/**
 * ReclameAquiToolbar — busca, ações e chips de filtro
 */
import React from 'react';
import { RA_FILTER_CHIPS } from '../../../services/especiais/reclameAquiData';

export default function ReclameAquiToolbar({
  search,
  onSearchChange,
  activeChips,
  onToggleChip,
  onAction,
}) {
  const toggleChip = (chipId) => {
    onToggleChip?.(chipId);
  };

  return (
    <div className="ra-toolbar">
      <div className="ra-toolbar__row">
        <div className="ra-toolbar__search">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="search"
            className="ra-toolbar__search-input"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>
        <div className="ra-toolbar__actions">
          <button type="button" className="ra-toolbar__btn" onClick={() => onAction?.('filtrar')}>
            <i className="ti ti-filter" aria-hidden="true" /> Filtrar
          </button>
          <button type="button" className="ra-toolbar__btn" onClick={() => onAction?.('ordenar')}>
            <i className="ti ti-arrows-sort" aria-hidden="true" /> Ordenar
          </button>
          <button type="button" className="ra-toolbar__btn" onClick={() => onAction?.('exportar')}>
            <i className="ti ti-download" aria-hidden="true" /> Exportar
          </button>
          <button type="button" className="ra-toolbar__btn ra-toolbar__btn--primary" onClick={() => onAction?.('nova')}>
            <i className="ti ti-plus" aria-hidden="true" /> Nova reclamação
          </button>
        </div>
      </div>

      <div className="ra-toolbar__filters">
        <div className="ra-toolbar__chips">
          {RA_FILTER_CHIPS.map((chip) => {
            const isActive = activeChips.includes(chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                className={'ra-chip' + (isActive ? ' is-active' : '')}
                onClick={() => toggleChip(chip.id)}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <span className="ra-toolbar__group-label">Agrupar por: Status RA</span>
      </div>
    </div>
  );
}
