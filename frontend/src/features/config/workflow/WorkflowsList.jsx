/**
 * WorkflowsList v1.0.0 — cards + tabela de workflows (padrão Formulários)
 * VERSION: v1.0.0 | DATE: 2026-07-14
 */
import React, { useMemo, useState } from 'react';
import { useNotifications } from '../../../context/NotificationContext';
import ConfigAtivoToggle from '../components/ConfigAtivoToggle';
import { computeWorkflowStats, formatTriggerPath } from './workflowConfigData';
import WorkflowDeleteConfirmModal from './WorkflowDeleteConfirmModal';

function sortWorkflows(list) {
  return [...(list || [])].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR'));
}

export default function WorkflowsList({
  id,
  workflows,
  onEdit,
  onCreate,
  onToggleActive,
  onDelete,
}) {
  const { showNotification } = useNotifications();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const sortedWorkflows = useMemo(() => sortWorkflows(workflows), [workflows]);
  const stats = useMemo(() => computeWorkflowStats(workflows), [workflows]);

  const handleToggleActive = async (workflowId, nextActive) => {
    setTogglingId(workflowId);
    try {
      await onToggleActive?.(workflowId, nextActive);
      showNotification(nextActive ? 'Workflow ativado.' : 'Workflow desativado.', 'success');
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
      await onDelete?.(deleteTarget.id);
      showNotification('Workflow excluído.', 'success');
      setDeleteTarget(null);
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
          <div className="stat-info">
            <h3>{stats.total}</h3>
            <p>Workflows cadastrados</p>
          </div>
        </div>
        <div className="stat-card stat-card--static">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-circle-check" /></span>
          <div className="stat-info">
            <h3>{stats.ativos}</h3>
            <p>Ativos no desk</p>
          </div>
        </div>
        <div className="stat-card stat-card--static">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-list-details" /></span>
          <div className="stat-info">
            <h3>{stats.etapas}</h3>
            <p>Etapas configuradas</p>
          </div>
        </div>
        <div className="stat-card stat-card--static">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-lock" /></span>
          <div className="stat-info">
            <h3>{stats.comAprovacao}</h3>
            <p>Com etapa de aprovação</p>
          </div>
        </div>
        <div className="stat-card stat-card--static">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-forms" /></span>
          <div className="stat-info">
            <h3>{stats.tabulacao}</h3>
            <p>Gatilhos por tabulação</p>
          </div>
        </div>
        <div className="stat-card stat-card--static">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-player-pause" /></span>
          <div className="stat-info">
            <h3>{stats.inativos}</h3>
            <p>Workflows inativos</p>
          </div>
        </div>
      </div>

      <div className="config-table-wrap">
        <div className="config-table-head-actions">
          <button
            type="button"
            className="config-action-btn config-action-btn--create config-action-btn--compact"
            onClick={onCreate}
          >
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
            {sortedWorkflows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="forms-empty-state">
                    <p className="forms-empty-text">Nenhum workflow configurado.</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedWorkflows.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong className="config-table__name">{item.title}</strong>
                  </td>
                  <td>{(item.steps || []).length}</td>
                  <td>{formatTriggerPath(item.trigger)}</td>
                  <td className="config-table__actions">
                    <button
                      type="button"
                      className="config-action-btn config-action-btn--edit"
                      onClick={() => onEdit?.(item.id)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="config-action-btn config-action-btn--delete"
                      onClick={() => setDeleteTarget(item)}
                    >
                      Excluir
                    </button>
                  </td>
                  <td>
                    <ConfigAtivoToggle
                      ativo={item.active}
                      onChange={(nextActive) => handleToggleActive(item.id, nextActive)}
                      disabled={togglingId === item.id}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <WorkflowDeleteConfirmModal
        workflow={deleteTarget}
        deleting={deleting}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
