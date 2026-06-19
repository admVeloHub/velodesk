/**
 * Modal — criar nova caixa na fila de atendimento
 * VERSION: v1.0.0 | DATE: 2026-06-19
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNotifications } from '../../../context/NotificationContext';
import {
  QUEUE_BOX_ACTIONS,
  createCustomQueueBox,
} from '../../../services/desk/customQueueBoxes';

export default function CreateQueueBoxModal({ open, onClose, onCreated }) {
  const { showNotification } = useNotifications();
  const nameRef = useRef(null);
  const [name, setName] = useState('');
  const [action, setAction] = useState('em-andamento');
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setName('');
    setAction('em-andamento');
    setNameError(false);
    setSaving(false);
    nameRef.current?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    if (!name.trim()) {
      setNameError(true);
      showNotification('Informe o nome da caixa.', 'error');
      nameRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const box = createCustomQueueBox({ name, action });
      onCreated?.(box);
      showNotification(`Caixa "${box.name}" criada na fila.`, 'success');
      onClose();
    } catch {
      showNotification('Não foi possível criar a caixa.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <button
        type="button"
        className="queue-box-modal__backdrop"
        aria-label="Fechar criação de caixa"
        onClick={onClose}
      />
      <div
        className="queue-box-modal"
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
                Nova caixa
              </h2>
              <p className="queue-box-modal__subtitle">
                Defina o nome e a ação automática da caixa na fila.
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
              placeholder="Ex.: Retenção VIP, N2 Financeiro"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>

          <div className="queue-box-modal__field">
            <label className="queue-box-modal__label" htmlFor="queueBoxAction">
              Ação
            </label>
            <select
              id="queueBoxAction"
              className="queue-box-modal__select"
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              {QUEUE_BOX_ACTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className="queue-box-modal__hint">
              A ação define o comportamento padrão dos tickets nesta caixa.
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
            {saving ? 'Criando…' : 'Salvar e criar caixa'}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
