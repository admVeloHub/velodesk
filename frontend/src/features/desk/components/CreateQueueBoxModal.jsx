/**
 * Modal — criar/editar caixa personalizada com critérios
 * VERSION: v2.0.0 | DATE: 2026-07-30
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNotifications } from '../../../context/NotificationContext';
import {
  createCustomQueueBox,
  updateCustomQueueBox,
} from '../../../services/desk/customQueueBoxes';
import QueueBoxCriteriaEditor from '../../preferencias/components/QueueBoxCriteriaEditor';

function defaultCriterios() {
  return [{ tipo: 'status', campo: 'status', operador: 'equals', valor: 'em-andamento' }];
}

export default function CreateQueueBoxModal({ open, onClose, onSaved, initialBox = null }) {
  const { showNotification } = useNotifications();
  const nameRef = useRef(null);
  const [name, setName] = useState('');
  const [criterios, setCriterios] = useState(defaultCriterios);
  const [nameError, setNameError] = useState(false);
  const [criteriaError, setCriteriaError] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initialBox?.id);

  useEffect(() => {
    if (!open) return undefined;
    setName(String(initialBox?.name || ''));
    setCriterios(
      Array.isArray(initialBox?.criterios) && initialBox.criterios.length
        ? initialBox.criterios.map((c) => ({ ...c }))
        : defaultCriterios(),
    );
    setNameError(false);
    setCriteriaError(false);
    setSaving(false);
    nameRef.current?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, initialBox]);

  if (!open) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError(true);
      showNotification('Informe o nome da caixa.', 'error');
      nameRef.current?.focus();
      return;
    }
    const validCriterios = (criterios || []).filter((c) => {
      if (!c?.tipo) return false;
      const valor = String(c.valor || '').trim();
      if (c.tipo === 'atribuido') {
        return valor === '__me__' || valor === '__empty__' || Boolean(valor);
      }
      return Boolean(valor);
    });
    if (!validCriterios.length) {
      setCriteriaError(true);
      showNotification('Informe ao menos um critério de filtragem.', 'error');
      return;
    }

    setSaving(true);
    try {
      const box = isEdit
        ? await updateCustomQueueBox(initialBox.id, { name, criterios: validCriterios })
        : await createCustomQueueBox({ name, criterios: validCriterios });
      onSaved?.(box);
      showNotification(isEdit ? 'Caixa atualizada' : 'Caixa adicionada', 'success');
      onClose();
    } catch (err) {
      showNotification(err?.response?.data?.message || err?.message || 'Não foi possível salvar a caixa.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <button
        type="button"
        className="queue-box-modal__backdrop"
        aria-label="Fechar modal de caixa"
        onClick={onClose}
      />
      <div
        className="queue-box-modal queue-box-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="queueBoxModalTitle"
      >
        <header className="queue-box-modal__header">
          <div className="queue-box-modal__head-main">
            <span className="queue-box-modal__icon" aria-hidden="true">
              <i className="ti ti-inbox" />
            </span>
            <div>
              <h2 className="queue-box-modal__title" id="queueBoxModalTitle">
                {isEdit ? 'Editar caixa' : 'Nova caixa'}
              </h2>
              <p className="queue-box-modal__subtitle">
                Defina o nome e os critérios de filtragem (combinados com E).
              </p>
            </div>
          </div>
          <button
            type="button"
            className="queue-box-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>

        <div className="queue-box-modal__body">
          <div className="queue-box-modal__field">
            <label className="queue-box-modal__label" htmlFor="queueBoxName">
              Nome <span className="queue-box-modal__req">*</span>
            </label>
            <input
              ref={nameRef}
              id="queueBoxName"
              type="text"
              className={'queue-box-modal__input' + (nameError ? ' queue-box-modal__input--error' : '')}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError) setNameError(false);
              }}
              placeholder="Ex.: Meus VIP, SLA crítico, Pendentes N2"
            />
          </div>

          <div className="queue-box-modal__field">
            <label className="queue-box-modal__label">
              Critérios <span className="queue-box-modal__req">*</span>
            </label>
            <div className={criteriaError ? 'queue-box-criteria--error' : ''}>
              <QueueBoxCriteriaEditor
                criterios={criterios}
                onChange={(next) => {
                  setCriterios(next);
                  if (criteriaError) setCriteriaError(false);
                }}
              />
            </div>
            <p className="queue-box-modal__hint">
              A caixa lista os tickets visíveis ao agente que atendem todos os critérios.
            </p>
          </div>
        </div>

        <footer className="queue-box-modal__footer">
          <button
            type="button"
            className="btn-secondary queue-box-modal__btn"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary queue-box-modal__btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Salvar e criar caixa')}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
