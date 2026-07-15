/**
 * GruposResponsabilidadePanel v1.2.0 — CRUD Grupos de Atuação (pool VeloHub)
 * VERSION: v1.2.0 | DATE: 2026-07-15
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { workflowApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import { useDeskColaboradores } from '../../../hooks/useDeskColaboradores';
import ConfigAtivoToggle from '../components/ConfigAtivoToggle';
import GrupoAgentesEditor from './GrupoAgentesEditor';
import {
  countAgentesNoGrupo,
  formatGrupoAgentesResumo,
} from './gruposAtribData';

function sortGrupos(list) {
  return [...(list || [])].sort(
    (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || (a.nome || '').localeCompare(b.nome || '', 'pt-BR'),
  );
}

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function emptyDraft(ordem = 0) {
  return { slug: '', nome: '', descricao: '', ordem, ativo: true, membros: [] };
}

export default function GruposResponsabilidadePanel({ onChanged, showStats = true }) {
  const { showNotification } = useNotifications();
  const { agents, loading: agentsLoading, error: agentsError } = useDeskColaboradores();
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [togglingId, setTogglingId] = useState(null);

  const stats = useMemo(() => ({
    total: grupos.length,
    ativos: grupos.filter((g) => g.ativo !== false).length,
    agentes: grupos.reduce((sum, g) => sum + countAgentesNoGrupo(g.membros), 0),
  }), [grupos]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workflowApi.listGrupos(true);
      setGrupos(sortGrupos(data || []));
    } catch {
      showNotification('Erro ao carregar grupos.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => { load(); }, [load]);

  const resetDraft = () => {
    setEditingId(null);
    setDraft(emptyDraft(grupos.length));
  };

  const startEdit = (grupo) => {
    setEditingId(grupo._id);
    setDraft({
      slug: grupo.slug || '',
      nome: grupo.nome || '',
      descricao: grupo.descricao || '',
      ordem: grupo.ordem ?? 0,
      ativo: grupo.ativo !== false,
      membros: grupo.membros || [],
    });
  };

  const handleSave = async () => {
    const nome = String(draft.nome || '').trim();
    if (!nome) {
      showNotification('Informe o nome do grupo.', 'error');
      return;
    }
    if (!countAgentesNoGrupo(draft.membros)) {
      showNotification('Adicione ao menos um agente ou visão ao grupo para limitar atuações nos workflows.', 'error');
      return;
    }
    const slug = String(draft.slug || slugify(nome)).trim();
    setSaving(true);
    try {
      if (editingId) {
        await workflowApi.updateGrupo(editingId, { ...draft, slug, nome });
        showNotification('Grupo atualizado.', 'success');
      } else {
        await workflowApi.createGrupo({ ...draft, slug, nome });
        showNotification('Grupo criado.', 'success');
      }
      await load();
      await onChanged?.();
      resetDraft();
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Erro ao salvar grupo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id, nextActive) => {
    setTogglingId(id);
    try {
      await workflowApi.patchGrupo(id, { ativo: nextActive });
      await load();
      await onChanged?.();
    } catch {
      showNotification('Erro ao atualizar status.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir este grupo de atuação?')) return;
    setSaving(true);
    try {
      await workflowApi.deleteGrupo(id);
      showNotification('Grupo excluído.', 'success');
      await load();
      await onChanged?.();
      if (editingId === id) resetDraft();
    } catch {
      showNotification('Erro ao excluir grupo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {showStats ? (
        <div className="forms-stats-row">
          <div className="stat-card stat-card--static">
            <span className="stat-icon"><i className="ti ti-users-group" aria-hidden="true" /></span>
            <div className="stat-info"><h3>{stats.total}</h3><p>Grupos de atuação</p></div>
          </div>
          <div className="stat-card stat-card--static">
            <span className="stat-icon"><i className="ti ti-circle-check" aria-hidden="true" /></span>
            <div className="stat-info"><h3>{stats.ativos}</h3><p>Grupos ativos</p></div>
          </div>
          <div className="stat-card stat-card--static">
            <span className="stat-icon"><i className="ti ti-user-check" aria-hidden="true" /></span>
            <div className="stat-info"><h3>{stats.agentes}</h3><p>Vínculos no total</p></div>
          </div>
        </div>
      ) : null}

      {agentsError ? (
        <div className="lista-agentes-panel__error" role="alert">
          <p>Pool de agentes indisponível. Não é possível montar membros até a lista carregar.</p>
          <p className="lista-agentes-panel__error-detail">{agentsError}</p>
        </div>
      ) : null}

      <div className="wf-grupos-layout">
        <div className="wf-grupos-list">
          <div className="config-table-head-actions">
            <button type="button" className="config-action-btn config-action-btn--create config-action-btn--compact" onClick={resetDraft}>
              Novo grupo de atuação
            </button>
          </div>

          {loading ? (
            <div className="config-loading" role="status">
              <i className="ti ti-loader-2 config-loading__icon" aria-hidden="true" />
              <span>Carregando grupos…</span>
            </div>
          ) : grupos.length === 0 ? (
            <div className="forms-empty-state">
              <p className="forms-empty-text">Nenhum grupo de atuação cadastrado. Crie o primeiro ao lado.</p>
            </div>
          ) : (
            <table className="config-table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Slug</th>
                  <th>Membros</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g._id} className={editingId === g._id ? 'is-selected' : ''}>
                    <td><strong>{g.nome}</strong></td>
                    <td><code>{g.slug}</code></td>
                    <td className="grupos-atrib-table__agentes">{formatGrupoAgentesResumo(g.membros, agents)}</td>
                    <td>
                      <ConfigAtivoToggle
                        ativo={g.ativo !== false}
                        onChange={(next) => handleToggle(g._id, next)}
                        disabled={togglingId === g._id}
                      />
                    </td>
                    <td className="config-table__actions">
                      <button type="button" className="config-action-btn config-action-btn--edit" onClick={() => startEdit(g)}>Editar</button>
                      <button type="button" className="config-action-btn config-action-btn--delete" onClick={() => handleDelete(g._id)}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="wf-grupos-form">
          <h3>{editingId ? 'Editar grupo de atuação' : 'Novo grupo de atuação'}</h3>
          <label className="wf-step-editor__field">
            <span>Nome</span>
            <input
              type="text"
              value={draft.nome}
              onChange={(e) => setDraft((p) => ({ ...p, nome: e.target.value, slug: p.slug || slugify(e.target.value) }))}
            />
          </label>
          <label className="wf-step-editor__field">
            <span>Slug</span>
            <input type="text" value={draft.slug} onChange={(e) => setDraft((p) => ({ ...p, slug: e.target.value }))} />
          </label>
          <label className="wf-step-editor__field">
            <span>Descrição</span>
            <textarea rows={2} value={draft.descricao} onChange={(e) => setDraft((p) => ({ ...p, descricao: e.target.value }))} />
          </label>

          <GrupoAgentesEditor
            membros={draft.membros || []}
            agents={agents}
            loading={agentsLoading}
            onChange={(membros) => setDraft((p) => ({ ...p, membros }))}
          />

          <div className="wf-grupos-form__actions">
            {editingId ? (
              <button type="button" className="config-action-btn" onClick={resetDraft}>Cancelar edição</button>
            ) : null}
            <button type="button" className="config-action-btn config-action-btn--create" disabled={saving} onClick={handleSave}>
              {editingId ? 'Salvar alterações' : 'Criar grupo'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
