/**
 * TabulationOpcoesModal v1.1.0 — CRUD + reordenação de opções por categoria
 * VERSION: v1.1.0 | DATE: 2026-07-07
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { tabulationApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import ConfigAtivoToggle from './ConfigAtivoToggle';

function sortOpcoes(list) {
  return [...(list || [])].sort((a, b) => {
    const ordemDiff = (a.ordem ?? 0) - (b.ordem ?? 0);
    if (ordemDiff !== 0) return ordemDiff;
    return (a.valor || '').localeCompare(b.valor || '', 'pt-BR');
  });
}

function moveItem(list, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export default function TabulationOpcoesModal({
  categoria,
  title,
  description,
  onClose,
  onChanged,
}) {
  const { showNotification } = useNotifications();
  const [opcoes, setOpcoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newValor, setNewValor] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValor, setEditValor] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [orderEditMode, setOrderEditMode] = useState(false);
  const [orderDraft, setOrderDraft] = useState([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);

  const sortedOpcoes = useMemo(() => sortOpcoes(opcoes), [opcoes]);
  const displayOpcoes = orderEditMode ? orderDraft : sortedOpcoes;
  const columnCount = orderEditMode ? 2 : 3;

  const stats = useMemo(() => ({
    total: opcoes.length,
    ativos: opcoes.filter((item) => item.ativo !== false).length,
  }), [opcoes]);

  const load = useCallback(async () => {
    if (!categoria) return;
    setLoading(true);
    try {
      const data = await tabulationApi.getOpcoes(categoria, true);
      setOpcoes(sortOpcoes(data?.opcoes || []));
    } catch {
      showNotification('Erro ao carregar opções.', 'error');
    } finally {
      setLoading(false);
    }
  }, [categoria, showNotification]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !savingNew && !savingEdit && !deletingId && !savingOrder && !orderEditMode) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deletingId, onClose, orderEditMode, savingEdit, savingNew, savingOrder]);

  const handleAdd = async (event) => {
    event.preventDefault();
    const valor = String(newValor || '').trim();
    if (!valor) return;

    setSavingNew(true);
    try {
      const data = await tabulationApi.createOpcaoItem(categoria, { valor });
      setOpcoes(sortOpcoes(data?.opcoes || []));
      setNewValor('');
      showNotification('Opção adicionada.', 'success');
      onChanged?.();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao adicionar opção.';
      showNotification(msg, 'error');
    } finally {
      setSavingNew(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setEditValor(item.valor);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValor('');
  };

  const saveEdit = async (itemId) => {
    const valor = String(editValor || '').trim();
    if (!valor) return;

    setSavingEdit(true);
    try {
      const data = await tabulationApi.updateOpcaoItem(categoria, itemId, { valor });
      setOpcoes(sortOpcoes(data?.opcoes || []));
      setEditingId(null);
      setEditValor('');
      showNotification('Opção atualizada.', 'success');
      onChanged?.();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao atualizar opção.';
      showNotification(msg, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleAtivo = async (itemId, nextAtivo) => {
    setTogglingId(itemId);
    try {
      const data = await tabulationApi.updateOpcaoItem(categoria, itemId, { ativo: nextAtivo });
      setOpcoes(sortOpcoes(data?.opcoes || []));
      showNotification(nextAtivo ? 'Opção ativada.' : 'Opção desativada.', 'success');
      onChanged?.();
    } catch {
      showNotification('Erro ao atualizar status da opção.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const removeItem = async (itemId) => {
    setDeletingId(itemId);
    try {
      await tabulationApi.deleteOpcaoItem(categoria, itemId);
      setOpcoes((prev) => prev.filter((item) => item._id !== itemId));
      showNotification('Opção excluída.', 'success');
      onChanged?.();
    } catch {
      showNotification('Erro ao excluir opção.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const startOrderEdit = () => {
    setOrderDraft(sortedOpcoes);
    setOrderEditMode(true);
    cancelEdit();
  };

  const cancelOrderEdit = () => {
    setOrderEditMode(false);
    setOrderDraft([]);
    setDragIndex(null);
  };

  const moveOrderItem = (index, direction) => {
    setOrderDraft((prev) => moveItem(prev, index, index + direction));
  };

  const handleDragStart = (index) => (event) => {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (index) => (event) => {
    event.preventDefault();
    const fromIndex = dragIndex ?? Number(event.dataTransfer.getData('text/plain'));
    if (Number.isNaN(fromIndex) || fromIndex === index) {
      setDragIndex(null);
      return;
    }
    setOrderDraft((prev) => moveItem(prev, fromIndex, index));
    setDragIndex(null);
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    try {
      const updates = orderDraft
        .map((item, index) => ({ id: item._id, ordem: index }))
        .filter(({ id, ordem }) => {
          const original = sortedOpcoes.find((item) => item._id === id);
          return (original?.ordem ?? 0) !== ordem;
        });

      await Promise.all(
        updates.map(({ id, ordem }) => tabulationApi.updateOpcaoItem(categoria, id, { ordem }))
      );
      showNotification('Ordem salva.', 'success');
      setOrderEditMode(false);
      setOrderDraft([]);
      await load();
      onChanged?.();
    } catch {
      showNotification('Erro ao salvar ordem.', 'error');
    } finally {
      setSavingOrder(false);
    }
  };

  if (!categoria) return null;

  return (
    <div className="config-modal" role="presentation">
      <button
        type="button"
        className="config-modal__backdrop"
        aria-label="Fechar"
        onClick={orderEditMode || savingOrder ? undefined : onClose}
      />
      <div
        className="config-modal__dialog config-modal__dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tabulationOpcoesTitle"
      >
        <header className="config-modal__header">
          <h4 id="tabulationOpcoesTitle">{title}</h4>
          {description && <p className="config-modal__subtitle">{description}</p>}
        </header>

        <div className={'config-modal__body config-tabulation' + (orderEditMode ? ' config-tabulation--order-edit' : '')}>
          <div className="forms-stats-row forms-stats-row--compact">
            <div className="stat-card stat-card--static">
              <span className="stat-icon" aria-hidden="true"><i className="ti ti-list" /></span>
              <div className="stat-info">
                <h3>{stats.total}</h3>
                <p>Opções cadastradas</p>
              </div>
            </div>
            <div className="stat-card stat-card--static">
              <span className="stat-icon" aria-hidden="true"><i className="ti ti-circle-check" /></span>
              <div className="stat-info">
                <h3>{stats.ativos}</h3>
                <p>Ativas no desk</p>
              </div>
            </div>
          </div>

          {!orderEditMode && (
            <form className="config-opcoes-add-form" onSubmit={handleAdd}>
              <input
                type="text"
                className="config-opcoes-add-form__input"
                placeholder="Nova opção"
                value={newValor}
                onChange={(event) => setNewValor(event.target.value)}
                disabled={savingNew}
              />
              <button
                type="submit"
                className="config-action-btn config-action-btn--create config-action-btn--compact"
                disabled={savingNew || !String(newValor || '').trim()}
              >
                {savingNew ? 'Adicionando…' : 'Adicionar'}
              </button>
            </form>
          )}

          <div className="config-table-wrap">
            <div className="config-table-head-actions">
              {orderEditMode ? (
                <>
                  <button
                    type="button"
                    className="config-action-btn config-action-btn--edit config-action-btn--compact"
                    onClick={cancelOrderEdit}
                    disabled={savingOrder}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="config-action-btn config-action-btn--create config-action-btn--compact"
                    onClick={saveOrder}
                    disabled={savingOrder}
                  >
                    {savingOrder ? 'Salvando…' : 'Salvar ordem'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="config-action-btn config-action-btn--edit config-action-btn--compact"
                  onClick={startOrderEdit}
                  disabled={loading || sortedOpcoes.length < 2}
                >
                  Editar Ordem
                </button>
              )}
            </div>

            {orderEditMode && (
              <p className="config-order-edit-hint">
                Arraste pela alça ou use as setas para definir a sequência exibida no desk.
              </p>
            )}

            <table className={'config-table' + (orderEditMode ? ' config-table--order-edit' : '')}>
              <thead>
                <tr>
                  {orderEditMode && <th className="config-table-th-order">Ordem</th>}
                  <th>Opção</th>
                  {!orderEditMode && <th>Ações</th>}
                  {!orderEditMode && <th>Status</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={columnCount}>
                      <div className="config-loading" role="status">
                        <i className="ti ti-loader-2 config-loading__icon" aria-hidden="true" />
                        <span>Carregando opções…</span>
                      </div>
                    </td>
                  </tr>
                ) : displayOpcoes.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount}>
                      <div className="forms-empty-state">
                        <p className="forms-empty-text">Nenhuma opção configurada.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayOpcoes.map((item, index) => (
                    <tr
                      key={item._id}
                      className={orderEditMode ? 'config-table-row--draggable' : undefined}
                      draggable={orderEditMode}
                      onDragStart={orderEditMode ? handleDragStart(index) : undefined}
                      onDragOver={orderEditMode ? handleDragOver : undefined}
                      onDrop={orderEditMode ? handleDrop(index) : undefined}
                      onDragEnd={orderEditMode ? () => setDragIndex(null) : undefined}
                    >
                      {orderEditMode && (
                        <td className="config-table__order-controls">
                          <span className="config-order-handle" aria-hidden="true">
                            <i className="ti ti-grip-vertical" />
                          </span>
                          <div className="config-order-arrows">
                            <button
                              type="button"
                              className="config-order-arrow"
                              aria-label={'Subir ' + item.valor}
                              disabled={index === 0}
                              onClick={() => moveOrderItem(index, -1)}
                            >
                              <i className="ti ti-chevron-up" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="config-order-arrow"
                              aria-label={'Descer ' + item.valor}
                              disabled={index === displayOpcoes.length - 1}
                              onClick={() => moveOrderItem(index, 1)}
                            >
                              <i className="ti ti-chevron-down" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      )}
                      <td>
                        {editingId === item._id ? (
                          <input
                            type="text"
                            className="config-opcoes-edit-input"
                            value={editValor}
                            onChange={(event) => setEditValor(event.target.value)}
                            disabled={savingEdit}
                          />
                        ) : (
                          <strong className="config-table__name">{item.valor}</strong>
                        )}
                      </td>
                      {!orderEditMode && (
                        <td className="config-table__actions">
                          {editingId === item._id ? (
                            <>
                              <button
                                type="button"
                                className="config-action-btn config-action-btn--create"
                                onClick={() => saveEdit(item._id)}
                                disabled={savingEdit || !String(editValor || '').trim()}
                              >
                                {savingEdit ? 'Salvando…' : 'Salvar'}
                              </button>
                              <button
                                type="button"
                                className="config-action-btn config-action-btn--edit"
                                onClick={cancelEdit}
                                disabled={savingEdit}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="config-action-btn config-action-btn--edit"
                                onClick={() => startEdit(item)}
                                disabled={Boolean(deletingId)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="config-action-btn config-action-btn--delete"
                                onClick={() => removeItem(item._id)}
                                disabled={deletingId === item._id}
                              >
                                {deletingId === item._id ? 'Excluindo…' : 'Excluir'}
                              </button>
                            </>
                          )}
                        </td>
                      )}
                      {!orderEditMode && (
                        <td>
                          <ConfigAtivoToggle
                            ativo={item.ativo}
                            onChange={(nextAtivo) => toggleAtivo(item._id, nextAtivo)}
                            disabled={togglingId === item._id || editingId === item._id}
                          />
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="config-modal__footer">
          <button
            type="button"
            className="config-action-btn config-action-btn--edit"
            onClick={onClose}
            disabled={orderEditMode || savingOrder}
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
