/**
 * ProdSolicTrackingSidebar — busca e acompanhamento
 */
import React, { useState } from 'react';
import { STATUS_LABELS, getErrosBugsItemSubtitle } from '../../../services/cadastral/solicitacoesProdutosData';

function formatRequestDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function ProdSolicTrackingSidebar({
  items,
  onSearch,
  onRefresh,
}) {
  const [searchCpf, setSearchCpf] = useState('');

  const handleSearch = (event) => {
    event.preventDefault();
    onSearch(searchCpf);
  };

  return (
    <aside className="prod-solic-track" aria-label="Busca e acompanhamento">
      <h2 className="prod-solic-track__title">
        <span className="prod-solic-track__accent" aria-hidden="true" />
        Busca e acompanhamento
      </h2>

      <form className="prod-solic-track__search" onSubmit={handleSearch}>
        <input
          type="text"
          className="prod-solic-track__input"
          placeholder="Digite o CPF"
          value={searchCpf}
          onChange={(e) => setSearchCpf(e.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="prod-solic-track__search-btn">
          Buscar
        </button>
      </form>

      <button type="button" className="prod-solic-track__refresh-link" onClick={onRefresh}>
        Atualizar
      </button>

      <ul className="prod-solic-track__list">
        {items.length === 0 ? (
          <li className="prod-solic-track__empty">Nenhuma solicitação encontrada.</li>
        ) : (
          items.map((item) => {
            const isDone = item.status === 'feito';
            const subtitle = getErrosBugsItemSubtitle(item);
            return (
              <li key={item.id} className={'prod-solic-track__item' + (isDone ? ' is-done' : ' is-sent')}>
                <div className="prod-solic-track__item-head">
                  <span className="prod-solic-track__icon" aria-hidden="true">
                    <i className={'ti ' + (isDone ? 'ti-circle-check' : 'ti-clock')} />
                  </span>
                  <div className="prod-solic-track__item-main">
                    <strong className="prod-solic-track__item-title">{item.titulo}</strong>
                    {subtitle ? (
                      <span className="prod-solic-track__item-subtitle">{subtitle}</span>
                    ) : null}
                    <span className="prod-solic-track__item-date">{formatRequestDate(item.createdAt)}</span>
                  </div>
                </div>
                <div className={'prod-solic-track__bar' + (isDone ? ' is-done' : '')}>
                  <span className="prod-solic-track__bar-fill" />
                </div>
                <span className="prod-solic-track__status">{STATUS_LABELS[item.status] || item.status}</span>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}
