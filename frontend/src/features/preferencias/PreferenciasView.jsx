/**
 * Preferências do agente — comportamento ao salvar + caixas personalizadas
 * VERSION: v1.0.3 | DATE: 2026-07-31
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useProfile } from '../../context/ProfileContext';
import { usePermissions } from '../../context/PermissionContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  getAutoCloseOnSave,
  setAutoCloseOnSave,
} from '../../services/desk/agentDeskPreferences';
import {
  deleteCustomQueueBox,
  fetchAndHydrateCustomQueues,
  loadCustomQueues,
} from '../../services/desk/customQueueBoxes';
import { summarizeCriterios } from '../../services/desk/customQueueBoxCriteria';
import CreateQueueBoxModal from '../desk/components/CreateQueueBoxModal';

export default function PreferenciasView() {
  const { isNavAllowed } = useProfile();
  const { can, loading: permissionsLoading } = usePermissions();
  const { showNotification } = useNotifications();

  const [autoCloseOnSave, setAutoCloseOnSaveState] = useState(() => getAutoCloseOnSave());
  const [boxes, setBoxes] = useState(() => loadCustomQueues());
  const [loadingBoxes, setLoadingBoxes] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const navAllowed = isNavAllowed('preferencias');
  const canView = navAllowed && can('preferencias', 'visualizar');

  const refreshBoxes = useCallback(async () => {
    setLoadingBoxes(true);
    try {
      await fetchAndHydrateCustomQueues();
      setBoxes(loadCustomQueues());
    } finally {
      setLoadingBoxes(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return undefined;
    void refreshBoxes();
    return undefined;
  }, [canView, refreshBoxes]);

  if (!navAllowed) {
    return <Navigate to="/workspace" replace />;
  }

  if (permissionsLoading) {
    return (
      <div id="preferencias" className="page preferencias-page eco-page active">
        <div className="eco-page-inner preferencias-layout">
          <p className="preferencias-boxes__empty">Carregando preferências…</p>
        </div>
      </div>
    );
  }

  if (!canView) {
    return <Navigate to="/workspace" replace />;
  }

  const toggleAutoCloseOnSave = () => {
    setAutoCloseOnSaveState((prev) => {
      const next = !prev;
      setAutoCloseOnSave(next);
      return next;
    });
  };

  const handleDelete = async (box) => {
    if (!box?.id) return;
    const ok = window.confirm(`Excluir a caixa "${box.name}"?`);
    if (!ok) return;
    setDeletingId(box.id);
    try {
      await deleteCustomQueueBox(box.id);
      setBoxes(loadCustomQueues());
      showNotification('Caixa excluída', 'success');
    } catch (err) {
      showNotification(err?.response?.data?.message || err?.message || 'Não foi possível excluir.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div id="preferencias" className="page preferencias-page eco-page active">
      <div className="eco-page-inner preferencias-layout">
        <header className="preferencias-header">
          <div className="preferencias-header__icon" aria-hidden="true">
            <i className="ti ti-adjustments" />
          </div>
          <div>
            <h1 className="preferencias-header__title">Preferências</h1>
            <p className="preferencias-header__subtitle">
              Comportamento do atendimento e caixas personalizadas da fila
            </p>
          </div>
        </header>

        <section className="preferencias-section" aria-labelledby="prefSaveBehaviorTitle">
          <h2 className="preferencias-section__title" id="prefSaveBehaviorTitle">
            Comportamento ao salvar um ticket
          </h2>
          <p className="preferencias-section__desc">
            Defina se, ao salvar, o ticket deve ser fechado automaticamente ou permanecer aberto.
          </p>
          <div className="preferencias-save-row">
            <span className="preferencias-save-row__label">Ao salvar</span>
            <button
              type="button"
              className={
                'preferencias-save-toggle'
                + (autoCloseOnSave ? ' is-close' : ' is-keep')
              }
              aria-pressed={autoCloseOnSave}
              onClick={toggleAutoCloseOnSave}
            >
              {autoCloseOnSave ? 'Fechar' : 'Manter'}
            </button>
          </div>
        </section>

        <section className="preferencias-section" aria-labelledby="prefBoxesTitle">
          <div className="preferencias-section__head">
            <div>
              <h2 className="preferencias-section__title" id="prefBoxesTitle">
                Caixas personalizadas
              </h2>
              <p className="preferencias-section__desc">
                Visões filtradas na fila do Desk. Os critérios são combinados com E (AND).
              </p>
            </div>
            <button
              type="button"
              className="config-action-btn config-action-btn--create config-action-btn--compact"
              onClick={() => {
                setEditingBox(null);
                setModalOpen(true);
              }}
            >
              Adicionar caixa
            </button>
          </div>

          {loadingBoxes ? (
            <p className="preferencias-boxes__empty">Carregando caixas…</p>
          ) : boxes.length === 0 ? (
            <p className="preferencias-boxes__empty">
              Nenhuma caixa personalizada. Clique em Adicionar caixa para criar uma visão filtrada.
            </p>
          ) : (
            <ul className="preferencias-boxes">
              {boxes.map((box) => (
                <li key={box.id} className="preferencias-box-item">
                  <span
                    className="preferencias-box-item__dot"
                    style={{ background: box.dot || '#6366f1' }}
                    aria-hidden="true"
                  />
                  <div className="preferencias-box-item__main">
                    <strong className="preferencias-box-item__name">{box.name}</strong>
                    <span className="preferencias-box-item__summary">
                      {summarizeCriterios(box.criterios)}
                    </span>
                  </div>
                  <div className="preferencias-box-item__actions">
                    <button
                      type="button"
                      className="preferencias-box-item__btn"
                      onClick={() => {
                        setEditingBox(box);
                        setModalOpen(true);
                      }}
                      title="Editar"
                      aria-label={`Editar caixa ${box.name}`}
                    >
                      <i className="ti ti-pencil" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="preferencias-box-item__btn preferencias-box-item__btn--danger"
                      onClick={() => handleDelete(box)}
                      disabled={deletingId === box.id}
                      title="Excluir"
                      aria-label={`Excluir caixa ${box.name}`}
                    >
                      <i className="ti ti-trash" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <CreateQueueBoxModal
        open={modalOpen}
        initialBox={editingBox}
        onClose={() => {
          setModalOpen(false);
          setEditingBox(null);
        }}
        onSaved={() => {
          setBoxes(loadCustomQueues());
        }}
      />
    </div>
  );
}
