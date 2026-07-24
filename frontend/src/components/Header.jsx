/**
 * Header v1.3.0 — visão fixa por RBAC (sem seletor manual)
 * VERSION: v1.3.0 | DATE: 2026-07-23 | AUTHOR: VeloHub Development Team
 */
import React, { useState } from 'react';
import ProfileRoleSwitcher from './ProfileRoleSwitcher';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';

export default function Header({ onQuickRegister, onGlobalSearch }) {
  const { darkMode, toggleDarkMode } = useTheme();
  const { badgeCount, togglePanel } = useNotifications();
  const [search, setSearch] = useState('');

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="header-brand">Velodesk</h1>
          <div className="header-tools-left" id="headerToolsLeft">
            <button type="button" id="cockpitKeyboardHelpBtn" className="btn-header-theme" title="Atalhos de teclado (?)">
              <i className="fas fa-keyboard" />
            </button>
            <button type="button" className="btn-header-theme" id="velodeskThemeToggle" onClick={toggleDarkMode} title="Modo escuro">
              <i className={'fas ' + (darkMode ? 'fa-sun' : 'fa-moon')} />
            </button>
            <div className="notification-bell" onClick={togglePanel} role="button" tabIndex={0}>
              <i className="fas fa-bell" />
              <span className="notification-badge" id="notificationBadge">{badgeCount}</span>
            </div>
            <div className="online-indicator">
              <i className="fas fa-circle" />
              <span>Online</span>
            </div>
          </div>
        </div>
        <div className="header-right" id="headerRight">
          <button type="button" className="btn-header-quick" onClick={onQuickRegister} title="Registro rápido">
            <i className="fas fa-bolt" /> <span>Registro rápido</span>
          </button>
          <div className="cockpit-global-search">
            <i className="fas fa-search" />
            <input
              type="search"
              id="cockpitGlobalSearch"
              placeholder="Buscar ticket #, CPF ou cliente…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (onGlobalSearch) onGlobalSearch(e.target.value);
              }}
              autoComplete="off"
            />
            <kbd>Ctrl+K</kbd>
          </div>
          <ProfileRoleSwitcher badgeId="profileRoleBadge" />
        </div>
      </div>
    </header>
  );
}
