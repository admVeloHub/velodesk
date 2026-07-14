/**
 * GrupoAgentesEditor v1.0.0 — seleção de agentes Desk para grupos de responsabilidade
 * VERSION: v1.0.0 | DATE: 2026-07-14
 */
import React, { useMemo, useState } from 'react';
import {
  buildMembrosFromSelecao,
  getColaboradorMembros,
  getPerfilMembros,
  PERFIL_DESK_OPCOES,
  resolveAgentLabel,
} from './gruposAtribData';

export default function GrupoAgentesEditor({
  membros = [],
  agents = [],
  loading = false,
  onChange,
}) {
  const [search, setSearch] = useState('');

  const selectedColaboradores = useMemo(
    () => new Set(getColaboradorMembros(membros).map((m) => m.valor)),
    [membros],
  );

  const selectedPerfis = useMemo(
    () => new Set(getPerfilMembros(membros).map((m) => m.valor)),
    [membros],
  );

  const filteredAgents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return agents;
    return agents.filter(
      (a) => a.label.toLowerCase().includes(term)
        || String(a.email || '').toLowerCase().includes(term),
    );
  }, [agents, search]);

  const emitChange = (colaboradorValores, perfisDesk) => {
    onChange?.(buildMembrosFromSelecao(colaboradorValores, perfisDesk));
  };

  const toggleAgent = (agent) => {
    const next = new Set(selectedColaboradores);
    if (next.has(agent.value)) next.delete(agent.value);
    else next.add(agent.value);
    emitChange(Array.from(next), Array.from(selectedPerfis));
  };

  const togglePerfil = (perfilValue) => {
    const next = new Set(selectedPerfis);
    if (next.has(perfilValue)) next.delete(perfilValue);
    else next.add(perfilValue);
    emitChange(Array.from(selectedColaboradores), Array.from(next));
  };

  const removeColaborador = (valor) => {
    const next = Array.from(selectedColaboradores).filter((v) => v !== valor);
    emitChange(next, Array.from(selectedPerfis));
  };

  return (
    <section className="grupo-agentes-editor">
      <div className="grupo-agentes-editor__head">
        <h4>Agentes do grupo</h4>
        <span className="grupo-agentes-editor__count">
          {selectedColaboradores.size + selectedPerfis.size} selecionado(s)
        </span>
      </div>
      <p className="grupos-atrib__hint">
        Somente agentes listados aqui poderão atuar nas etapas de workflow atribuídas a este grupo.
      </p>

      {(selectedColaboradores.size > 0 || selectedPerfis.size > 0) ? (
        <div className="grupo-agentes-editor__chips">
          {Array.from(selectedColaboradores).map((valor) => (
            <span key={`col-${valor}`} className="grupo-agentes-editor__chip">
              <i className="ti ti-user" aria-hidden="true" />
              {resolveAgentLabel(valor, agents)}
              <button
                type="button"
                className="grupo-agentes-editor__chip-remove"
                onClick={() => removeColaborador(valor)}
                aria-label={`Remover ${resolveAgentLabel(valor, agents)}`}
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </span>
          ))}
          {Array.from(selectedPerfis).map((valor) => {
            const label = PERFIL_DESK_OPCOES.find((o) => o.value === valor)?.label || valor;
            return (
              <span key={`perfil-${valor}`} className="grupo-agentes-editor__chip grupo-agentes-editor__chip--perfil">
                <i className="ti ti-shield" aria-hidden="true" />
                {label}
                <button
                  type="button"
                  className="grupo-agentes-editor__chip-remove"
                  onClick={() => togglePerfil(valor)}
                  aria-label={`Remover ${label}`}
                >
                  <i className="ti ti-x" aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      <label className="grupo-agentes-editor__search">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar agente por nome ou e-mail…"
          aria-label="Buscar agente"
        />
      </label>

      <div className="grupo-agentes-editor__list-wrap">
        {loading ? (
          <p className="grupo-agentes-editor__empty">Carregando agentes…</p>
        ) : filteredAgents.length === 0 ? (
          <p className="grupo-agentes-editor__empty">
            {agents.length === 0 ? 'Nenhum agente cadastrado no Desk.' : 'Nenhum agente encontrado.'}
          </p>
        ) : (
          <ul className="grupo-agentes-editor__list">
            {filteredAgents.map((agent) => {
              const checked = selectedColaboradores.has(agent.value);
              return (
                <li key={agent.id || agent.email || agent.value}>
                  <label className={'grupo-agentes-editor__item' + (checked ? ' is-selected' : '')}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAgent(agent)}
                    />
                    <span className="grupo-agentes-editor__avatar" aria-hidden="true">
                      {(agent.label || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="grupo-agentes-editor__meta">
                      <strong>{agent.label}</strong>
                      <small>{agent.email}</small>
                    </span>
                    <span className="grupo-agentes-editor__role">{agent.role || 'agent'}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grupo-agentes-editor__perfis">
        <span className="grupo-agentes-editor__perfis-label">Acesso amplo por perfil</span>
        <div className="grupo-agentes-editor__perfis-options">
          {PERFIL_DESK_OPCOES.map((opt) => (
            <label key={opt.value} className="grupo-agentes-editor__perfil-option">
              <input
                type="checkbox"
                checked={selectedPerfis.has(opt.value)}
                onChange={() => togglePerfil(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
