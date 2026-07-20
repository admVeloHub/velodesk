/**
 * WorkflowsList v2.2.0 — cards + tabela via API
 * VERSION: v2.2.0 | DATE: 2026-07-17
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { workflowApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import ConfigAtivoToggle from '../components/ConfigAtivoToggle';
import { computeWorkflowStats, formatTriggerPath } from './workflowConfigData';
import WorkflowDeleteConfirmModal from './WorkflowDeleteConfirmModal';

function sortWorkflows(list) {
  return [...(list || [])].sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR'));
}

export default function WorkflowsList({
  id,
  onEdit,
  onCreate,
  onToggleActive,
  onDelete,
}) {
  const { showNotification } = useNotifications();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workflowApi.listAll(true);
      setWorkflows(sortWorkflows(data || []));
    } catch {
      showNotification('Erro ao carregar workflows.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => computeWorkflowStats(workflows), [workflows]);

  const handleToggleActive = async (workflowId, nextActive) => {
    setTogglingId(workflowId);
    try {
      await onToggleActive?.(workflowId, nextActive);
      showNotification(nextActive ? 'Workflow ativado.' : 'Workflow desativado.', 'success');
      await load();
    } catch {
      showNotification('Erro ao atualizar status do workflow.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDelete?.(deleteTarget._id);
      showNotification('Workflow excluído.', 'success');
      setDeleteTarget(null);
      await load();
    } catch {
      showNotification('Erro ao excluir workflow.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div id={id} className="config-section-body config-tabulation">
      <div className="forms-stats-row">
        <div className="stat-card stat-card--static">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-hierarchy-2" /></span>
          <div className="stat-info"><h3>{stats.total}</h3><p>Workflows cadastrados</p></div>
        </div>
        <div className="stat-card stat-card--static">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-circle-check" /></span>
          <div className="stat-info"><h3>{stats.ativos}</h3><p>Ativos no desk</p></div>
        </div>
        <div className="stat-card stat-card--static">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-list-details" /></span>
          <div className="stat-info"><h3>{stats.etapas}</h3><p>Etapas configuradas</p></div>
        </div>
        <div className="stat-card stat-card--static">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-lock" /></span>
          <div className="stat-info"><h3>{stats.comAprovacao}</h3><p>Com etapa de aprovação</p></div>
        </div>
        <div className="stat-card stat-card--static">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-forms" /></span>
          <div className="stat-info"><h3>{stats.tabulacao}</h3><p>Gatilhos por tabulação</p></div>
        </div>
        <div className="stat-card stat-card--static">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-shield-lock" /></span>
          <div className="stat-info"><h3>RBAC</h3><p>Atribuição por função</p></div>
        </div>
        <div className="stat-card stat-card--static">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-player-pause" /></span>
          <div className="stat-info"><h3>{stats.inativos}</h3><p>Workflows inativos</p></div>
        </div>
      </div>

      <div className="config-table-wrap">
        <div className="config-table-head-actions">
          <button type="button" className="config-action-btn config-action-btn--create config-action-btn--compact" onClick={onCreate}>
            Adicionar Workflow
          </button>
        </div>

        <table className="config-table">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Etapas</th>
              <th>Gatilho</th>
              <th>Ações</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>
                  <div className="config-loading" role="status">
                    <i className="ti ti-loader-2 config-loading__icon" aria-hidden="true" />
                    <span>Carregando workflows…</span>
                  </div>
                </td>
              </tr>
            ) : workflows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="forms-empty-state">
                    <p className="forms-empty-text">Nenhum workflow configurado.</p>
                  </div>
                </td>
              </tr>
            ) : (
              workflows.map((item) => (
                <tr key={item._id}>
                  <td><strong className="config-table__name">{item.titulo}</strong></td>
                  <td>{(item.passos || []).length}</td>
                  <td>{formatTriggerPath(item.gatilho)}</td>
                  <td className="config-table__actions">
                    <button type="button" className="config-action-btn config-action-btn--edit" onClick={() => onEdit?.(item._id)}>Editar</button>
                    <button type="button" className="config-action-btn config-action-btn--delete" onClick={() => setDeleteTarget(item)}>Excluir</button>
                  </td>
                  <td>
                    <ConfigAtivoToggle
                      ativo={item.ativo}
                      onChange={(nextActive) => handleToggleActive(item._id, nextActive)}
                      disabled={togglingId === item._id}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <WorkflowDeleteConfirmModal
        workflow={deleteTarget ? { title: deleteTarget.titulo, steps: deleteTarget.passos } : null}
        deleting={deleting}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
      />

    </div>
  );
}
