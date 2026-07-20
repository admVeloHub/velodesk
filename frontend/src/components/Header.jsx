/**
 * Header v1.2.0 — seletor de visão oculto em produção
 * VERSION: v1.2.0 | DATE: 2026-07-20 | AUTHOR: VeloHub Development Team
 */
import React, { useState } from 'react';
import { PROFILES } from '../config/profiles';
import { useProfile } from '../context/ProfileContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';

const showVisionSwitcher = !import.meta.env.PROD;

export default function Header({ onQuickRegister, onGlobalSearch }) {
  const {
    profile,
    profileId,
    profileLocked,
    dropdownOpen,
    setProfile,
    toggleDropdown,
    setDropdownOpen,
  } = useProfile();
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
          {showVisionSwitcher ? (
            <div className="header-profile-wrap">
              <button
                type="button"
                className={'profile-role-badge' + (profileLocked ? ' profile-role-badge--locked' : '')}
                id="profileRoleBadge"
                onClick={profileLocked ? undefined : toggleDropdown}
                style={{ background: 'linear-gradient(135deg, ' + profile.color + ', var(--eco-blue, #1634FF))' }}
                aria-expanded={profileLocked ? false : dropdownOpen}
                aria-haspopup={profileLocked ? false : 'true'}
                title={profileLocked ? 'Visão definida pelo seu acesso' : 'Alterar visão do portal'}
              >
                <i className={'fas ' + profile.icon} /> <span>{profile.label}</span>{' '}
                {!profileLocked ? <i className="fas fa-chevron-down eco-badge-chevron" /> : null}
              </button>
              {!profileLocked && dropdownOpen && (
                <div className={'eco-profile-dropdown open'} id="ecoProfileDropdown">
                  <div className="eco-profile-dropdown-header">Visão do portal</div>
                  {Object.keys(PROFILES).map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={'eco-profile-btn' + (profileId === id ? ' active' : '')}
                      data-profile={id}
                      onClick={() => setProfile(id)}
                    >
                      <i className={'fas ' + PROFILES[id].icon} /> {PROFILES[id].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
      {showVisionSwitcher && !profileLocked && dropdownOpen ? (
        <div className="eco-dropdown-backdrop" onClick={() => setDropdownOpen(false)} aria-hidden="true" />
      ) : null}
    </header>
  );
}
