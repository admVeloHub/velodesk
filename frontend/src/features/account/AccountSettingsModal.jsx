/**
 * Modal — configurações de conta do usuário
 * VERSION: v1.0.0 | DATE: 2026-06-19
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { getInitials } from '../../services/desk/utils';
import ProfileRoleSwitcher from '../../components/ProfileRoleSwitcher';

export default function AccountSettingsModal({ open, onClose }) {
  const { user, updateUser } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const { showNotification } = useNotifications();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setName(user?.name || 'Ana Silva');
    setEmail(user?.email || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, user, onClose]);

  if (!open) return null;

  const initials = getInitials(name || user?.name || 'Ana Silva');

  const handleSave = () => {
    if (!name.trim()) {
      showNotification('Informe seu nome.', 'error');
      return;
    }

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword.trim()) {
        showNotification('Informe a senha atual.', 'error');
        return;
      }
      if (newPassword.length < 6) {
        showNotification('A nova senha deve ter ao menos 6 caracteres.', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        showNotification('A confirmação da senha não confere.', 'error');
        return;
      }
      showNotification('Senha atualizada (demo).', 'success');
    }

    updateUser({
      name: name.trim(),
      email: email.trim(),
    });
    showNotification('Configurações da conta salvas.', 'success');
    onClose();
  };

  return createPortal(
    <>
      <button
        type="button"
        className="account-modal__backdrop"
        aria-label="Fechar configurações da conta"
        onClick={onClose}
      />
      <div
        className="account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="accountModalTitle"
      >
        <header className="account-modal__header">
          <div className="account-modal__head-main">
            <span className="account-modal__avatar" aria-hidden="true">
              {initials}
            </span>
            <div>
              <h2 className="account-modal__title" id="accountModalTitle">
                Minha conta
              </h2>
              <p className="account-modal__subtitle">Dados pessoais e preferências</p>
            </div>
          </div>
          <button
            type="button"
            className="account-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>

        <div className="account-modal__body">
          <section className="account-modal__section">
            <h3 className="account-modal__section-title">Identidade</h3>
            <div className="account-modal__field">
              <label className="account-modal__label" htmlFor="accountName">
                Nome
              </label>
              <input
                id="accountName"
                type="text"
                className="account-modal__input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="account-modal__field">
              <label className="account-modal__label" htmlFor="accountEmail">
                E-mail
              </label>
              <input
                id="accountEmail"
                type="email"
                className="account-modal__input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
          </section>

          <section className="account-modal__section">
            <h3 className="account-modal__section-title">Perfil operacional</h3>
            <p className="account-modal__section-desc">
              Alterne a visão do portal entre Agente e Supervisor.
            </p>
            <ProfileRoleSwitcher variant="menu" className="account-modal__role-switcher" />
          </section>

          <section className="account-modal__section">
            <h3 className="account-modal__section-title">Preferências</h3>
            <label className="account-modal__toggle">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={toggleDarkMode}
              />
              <span>Modo escuro</span>
            </label>
          </section>

          <section className="account-modal__section">
            <h3 className="account-modal__section-title">Segurança</h3>
            <div className="account-modal__field">
              <label className="account-modal__label" htmlFor="accountCurrentPassword">
                Senha atual
              </label>
              <input
                id="accountCurrentPassword"
                type="password"
                className="account-modal__input"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="account-modal__field">
              <label className="account-modal__label" htmlFor="accountNewPassword">
                Nova senha
              </label>
              <input
                id="accountNewPassword"
                type="password"
                className="account-modal__input"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="account-modal__field">
              <label className="account-modal__label" htmlFor="accountConfirmPassword">
                Confirmar nova senha
              </label>
              <input
                id="accountConfirmPassword"
                type="password"
                className="account-modal__input"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
          </section>
        </div>

        <footer className="account-modal__footer">
          <button type="button" className="btn-secondary account-modal__btn" onClick={onClose}>
            Fechar
          </button>
          <button type="button" className="btn-primary account-modal__btn" onClick={handleSave}>
            Salvar
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
