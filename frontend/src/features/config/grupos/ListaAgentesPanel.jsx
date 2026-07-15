/**
 * ListaAgentesPanel v1.1.0 — colaboradores Desk via /api/colaboradores (Mongo)
 * VERSION: v1.1.0 | DATE: 2026-07-15 | AUTHOR: VeloHub Development Team
 */
import React, { useMemo, useState } from 'react';
import { useDeskColaboradores } from '../../../hooks/useDeskColaboradores';

export default function ListaAgentesPanel() {
  const { colaboradores, loading, error, reload } = useDeskColaboradores();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return colaboradores;
    return colaboradores.filter((c) => (
      c.label.toLowerCase().includes(term)
      || String(c.email || '').toLowerCase().includes(term)
      || String(c.atuacaoLabel || '').toLowerCase().includes(term)
      || String(c.empresa || '').toLowerCase().includes(term)
    ));
  }, [colaboradores, search]);

  const stats = useMemo(() => ({
    total: colaboradores.length,
    agentes: colaboradores.filter((c) => c.vision === 'agent').length,
    supervisao: colaboradores.filter((c) => c.vision === 'gestao').length,
  }), [colaboradores]);

  return (
    <div className="lista-agentes-panel">
      <div className="forms-stats-row">
        <div className="stat-card stat-card--static">
          <span className="stat-icon"><i className="ti ti-users" aria-hidden="true" /></span>
          <div className="stat-info"><h3>{stats.total}</h3><p>Com acesso Desk</p></div>
        </div>
        <div className="stat-card stat-card--static">
          <span className="stat-icon"><i className="ti ti-headset" aria-hidden="true" /></span>
          <div className="stat-info"><h3>{stats.agentes}</h3><p>Visão agente</p></div>
        </div>
        <div className="stat-card stat-card--static">
          <span className="stat-icon"><i className="ti ti-user-shield" aria-hidden="true" /></span>
          <div className="stat-info"><h3>{stats.supervisao}</h3><p>Visão supervisão</p></div>
        </div>
      </div>

      <div className="lista-agentes-panel__toolbar">
        <label className="lista-agentes-panel__search">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail, atuação ou empresa…"
            aria-label="Buscar agentes"
          />
        </label>
        <button type="button" className="config-action-btn" onClick={reload} disabled={loading}>
          <i className="ti ti-refresh" aria-hidden="true" />
          Atualizar
        </button>
      </div>

      {error ? (
        <div className="lista-agentes-panel__error" role="alert">
          <p>Não foi possível carregar a lista de colaboradores.</p>
          <p className="lista-agentes-panel__error-detail">{error}</p>
          <button type="button" className="config-action-btn config-action-btn--create" onClick={reload}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="config-loading" role="status">
          <i className="ti ti-loader-2 config-loading__icon" aria-hidden="true" />
          <span>Carregando agentes…</span>
        </div>
      ) : !error && filtered.length === 0 ? (
        <div className="forms-empty-state">
          <p className="forms-empty-text">
            {colaboradores.length === 0
              ? 'Nenhum colaborador com acessos.Desk=true encontrado.'
              : 'Nenhum agente corresponde à busca.'}
          </p>
        </div>
      ) : !error ? (
        <div className="lista-agentes-panel__table-wrap">
          <table className="config-table lista-agentes-panel__table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>E-mail</th>
                <th>Atuação</th>
                <th>Visão Desk</th>
                <th>Empresa</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id || c.email || c.value}>
                  <td>
                    <strong>{c.colaboradorNome || c.label}</strong>
                    {c.afastado ? (
                      <span className="lista-agentes-panel__badge lista-agentes-panel__badge--warn">Afastado</span>
                    ) : null}
                  </td>
                  <td>{c.email || '—'}</td>
                  <td>{c.atuacaoLabel}</td>
                  <td>
                    <span
                      className={
                        'lista-agentes-panel__vision'
                        + (c.vision === 'gestao' ? ' lista-agentes-panel__vision--gestao' : '')
                      }
                    >
                      {c.visionLabel}
                    </span>
                  </td>
                  <td>{c.empresa || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
