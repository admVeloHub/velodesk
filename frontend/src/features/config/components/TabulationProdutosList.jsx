/**
 * TabulationProdutosList v1.3.5 — lista, desativar e excluir com confirmação
 * VERSION: v1.3.5 | DATE: 2026-06-25
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { tabulationApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import TabulationProdutoEditor from './TabulationProdutoEditor';
import TabulationDeleteConfirmModal, { countDetalhes } from './TabulationDeleteConfirmModal';

function computeStats(produtos) {
  const list = produtos || [];
  return {
    total: list.length,
    ativos: list.filter((p) => p.ativo !== false).length,
    motivos: list.reduce((sum, p) => sum + (p.motivos || []).length, 0),
    detalhes: list.reduce((sum, p) => sum + countDetalhes(p.motivos), 0),
  };
}

export default function TabulationProdutosList({ id, onChanged }) {
  const { showNotification } = useNotifications();
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const stats = useMemo(() => computeStats(produtos), [produtos]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tabulationApi.listProdutos(true);
      setProdutos(data || []);
    } catch {
      showNotification('Erro ao carregar produtos.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => { load(); }, [load]);

  const deactivate = async (itemId) => {
    try {
      await tabulationApi.patchProduto(itemId, { ativo: false });
      showNotification('Produto desativado.', 'success');
      await load();
      onChanged?.();
    } catch {
      showNotification('Erro ao desativar produto.', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await tabulationApi.deleteProduto(deleteTarget._id);
      showNotification('Produto excluído.', 'success');
      setDeleteTarget(null);
      await load();
      onChanged?.();
    } catch {
      showNotification('Erro ao excluir produto.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (creating || editingId) {
    return (
      <TabulationProdutoEditor
        produtoId={editingId}
        onClose={() => { setCreating(false); setEditingId(null); }}
        onSaved={async () => { await load(); onChanged?.(); }}
      />
    );
  }

  return (
    <div id={id} className="config-section-body config-tabulation">
      <div className="forms-stats-row">
        <div className="stat-card">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-box" /></span>
          <div className="stat-info">
            <h3>{stats.total}</h3>
            <p>Produtos cadastrados</p>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-circle-check" /></span>
          <div className="stat-info">
            <h3>{stats.ativos}</h3>
            <p>Ativos no desk</p>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-list-tree" /></span>
          <div className="stat-info">
            <h3>{stats.motivos}</h3>
            <p>Motivos na árvore</p>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon" aria-hidden="true"><i className="ti ti-git-branch" /></span>
          <div className="stat-info">
            <h3>{stats.detalhes}</h3>
            <p>Detalhes vinculados</p>
          </div>
        </div>
      </div>

      <div className="config-table-wrap">
        <div className="config-table-head-actions">
          <button
            type="button"
            className="btn-primary btn-forms-primary btn-forms-primary--compact"
            onClick={() => setCreating(true)}
          >
            Adicionar Produto
          </button>
        </div>

        <table className="config-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Ordem</th>
              <th>Status</th>
              <th>Motivos</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>
                  <div className="config-loading" role="status">
                    <i className="ti ti-loader-2 config-loading__icon" aria-hidden="true" />
                    <span>Carregando produtos…</span>
                  </div>
                </td>
              </tr>
            ) : produtos.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="forms-empty-state">
                    <p className="forms-empty-text">Nenhum produto configurado.</p>
                  </div>
                </td>
              </tr>
            ) : (
              produtos.map((item) => (
                <tr key={item._id}>
                  <td>
                    <strong className="config-table__name">{item.produto}</strong>
                  </td>
                  <td>{item.ordem ?? 0}</td>
                  <td>
                    <span className={'config-status-badge' + (item.ativo !== false ? ' config-status-badge--active' : ' config-status-badge--inactive')}>
                      {item.ativo !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>{(item.motivos || []).length}</td>
                  <td className="config-table__actions">
                    <button type="button" className="config-action-btn config-action-btn--edit" onClick={() => setEditingId(item._id)}>Editar</button>
                    {item.ativo !== false && (
                      <button type="button" className="config-action-btn config-action-btn--deactivate" onClick={() => deactivate(item._id)}>Desativar</button>
                    )}
                    <button
                      type="button"
                      className="config-action-btn config-action-btn--delete"
                      onClick={() => setDeleteTarget(item)}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TabulationDeleteConfirmModal
        produto={deleteTarget}
        motivosCount={(deleteTarget?.motivos || []).length}
        detalhesCount={countDetalhes(deleteTarget?.motivos)}
        deleting={deleting}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
