/**
 * MacrosConfigSection v1.0.0 — CRUD das macros de resposta rápida do compose
 * VERSION: v1.0.0 | DATE: 2026-09-03
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { macrosApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import { invalidateMacrosCache } from '../../../services/desk/macrosCache';
import { htmlToPlainText } from '../../../services/desk/composeRichEditor';
import MacroEditor from './MacroEditor';
import MacroDeleteConfirmModal from './MacroDeleteConfirmModal';
import ConfigAtivoToggle from '../components/ConfigAtivoToggle';

function sortMacros(list) {
  return [...(list || [])].sort((a, b) => {
    const ordemDiff = (a.ordem ?? 0) - (b.ordem ?? 0);
    if (ordemDiff !== 0) return ordemDiff;
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
  });
}

function previewText(html) {
  const plain = htmlToPlainText(html).trim();
  return plain.length > 90 ? `${plain.slice(0, 90)}…` : plain;
}

export default function MacrosConfigSection() {
  const { showNotification } = useNotifications();
  const [macros, setMacros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const sortedMacros = useMemo(() => sortMacros(macros), [macros]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await macrosApi.list(true);
      setMacros(sortMacros(data || []));
    } catch {
      showNotification('Erro ao carregar macros.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => { load(); }, [load]);

  const afterChange = useCallback(async () => {
    invalidateMacrosCache();
    await load();
  }, [load]);

  const toggleAtivo = async (id, nextAtivo) => {
    setTogglingId(id);
    try {
      await macrosApi.update(id, { ativo: nextAtivo });
      showNotification(nextAtivo ? 'Macro ativada.' : 'Macro desativada.', 'success');
      await afterChange();
    } catch {
      showNotification('Erro ao atualizar status da macro.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await macrosApi.remove(deleteTarget._id);
      showNotification('Macro excluída.', 'success');
      setDeleteTarget(null);
      await afterChange();
    } catch {
      showNotification('Erro ao excluir macro.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (creating || editingId) {
    return (
      <MacroEditor
        macroId={editingId}
        onClose={() => { setCreating(false); setEditingId(null); }}
        onSaved={afterChange}
      />
    );
  }

  return (
    <div id="macrosTab" className="config-section-body config-macros">
      <div className="config-table-wrap">
        <div className="config-table-head-actions">
          <button
            type="button"
            className="config-action-btn config-action-btn--create config-action-btn--compact"
            onClick={() => setCreating(true)}
          >
            Adicionar Macro
          </button>
        </div>

        <table className="config-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Prévia</th>
              <th>Ações</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>
                  <div className="config-loading" role="status">
                    <i className="ti ti-loader-2 config-loading__icon" aria-hidden="true" />
                    <span>Carregando macros…</span>
                  </div>
                </td>
              </tr>
            ) : sortedMacros.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="forms-empty-state">
                    <p className="forms-empty-text">Nenhuma macro cadastrada.</p>
                  </div>
                </td>
              </tr>
            ) : sortedMacros.map((item) => (
              <tr key={item._id}>
                <td>
                  <strong className="config-table__name">{item.nome}</strong>
                </td>
                <td className="config-table__preview">{previewText(item.texto)}</td>
                <td className="config-table__actions">
                  <button type="button" className="config-action-btn config-action-btn--edit" onClick={() => setEditingId(item._id)}>Editar</button>
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
                    ativo={item.ativo}
                    onChange={(nextAtivo) => toggleAtivo(item._id, nextAtivo)}
                    disabled={togglingId === item._id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MacroDeleteConfirmModal
        macro={deleteTarget}
        deleting={deleting}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
