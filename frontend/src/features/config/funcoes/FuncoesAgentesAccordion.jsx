/**
 * FuncoesAgentesAccordion v1.2.0 — lista read-only; atualização via GET ao abrir a seção
 * VERSION: v1.2.0 | DATE: 2026-07-24
 */
import React, { useMemo, useState } from 'react';
import { formatAtuacaoLabels } from '../../../services/desk/atuacaoVision';

export default function FuncoesAgentesAccordion({
  open,
  onToggle,
  agentes,
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return agentes || [];
    return (agentes || []).filter((a) => (
      String(a.colaboradorNome || '').toLowerCase().includes(term)
      || String(a.email || '').toLowerCase().includes(term)
      || formatAtuacaoLabels(a.atuacao).toLowerCase().includes(term)
      || String(a.funcaoNome || '').toLowerCase().includes(term)
    ));
  }, [agentes, search]);

  return (
    <div className="fp-accordion">
      <button
        type="button"
        className={'fp-accordion__header' + (open ? ' is-open' : '')}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="fp-accordion__title">
          Agentes
          {(agentes || []).length > 0 ? (
            <span className="fp-accordion__count">{agentes.length}</span>
          ) : null}
        </span>
        <i className={'ti ti-chevron-' + (open ? 'up' : 'down')} aria-hidden="true" />
      </button>
      {open ? (
        <div className="fp-accordion__panel fp-agentes-panel">
          {(agentes || []).length === 0 ? (
            <div className="fp-agentes-empty">
              <p>
                Nenhum colaborador com acesso Desk encontrado no VeloHub
                (empresa Velotax, acessos.Desk).
              </p>
            </div>
          ) : (
            <>
              <label className="fp-agentes-search">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar agente…"
                  aria-label="Buscar agentes"
                />
              </label>
              <div className="fp-agentes-table-wrap">
                <table className="config-table fp-agentes-table">
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>E-mail</th>
                      <th>Atuação (cargo)</th>
                      <th>Função</th>
                      <th>Nível</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => (
                      <tr key={a.email}>
                        <td>
                          <strong>{a.colaboradorNome || a.email}</strong>
                          {a.afastado ? (
                            <span className="fp-agentes-badge">Afastado</span>
                          ) : null}
                        </td>
                        <td>{a.email || '—'}</td>
                        <td>{formatAtuacaoLabels(a.atuacao)}</td>
                        <td>{a.funcaoNome || a.funcaoSlug || '—'}</td>
                        <td>
                          {a.nivel != null ? (
                            <span className="fp-badge">Nível {a.nivel}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (agentes || []).length > 0 ? (
                <p className="fp-agentes-no-match">Nenhum agente corresponde à busca.</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
