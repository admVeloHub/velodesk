/**
 * Workspace360Header v1.1.0 — cabeçalho do Painel 360°
 */
import React from 'react';
import { useTheme } from '../../../../context/ThemeContext';
import ProfileRoleSwitcher from '../../../../components/ProfileRoleSwitcher';

export default function Workspace360Header({ greeting, agentName, dateTimeLabel }) {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <header className="ws360-header">
      <div className="ws360-header__intro">
        <h2 className="ws360-header__greeting">
          {greeting}, {agentName} 👋
        </h2>
        <p className="ws360-header__datetime">{dateTimeLabel}</p>
      </div>
      <div className="ws360-header__actions">
        <button
          type="button"
          className="btn-header-theme ws360-theme-toggle"
          id="ws360VelodeskThemeToggle"
          onClick={toggleDarkMode}
          title={darkMode ? 'Modo claro' : 'Modo escuro'}
        >
          <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'}`} />
        </button>
        <ProfileRoleSwitcher
          variant="badge"
          className="ws360-header__profile"
          badgeId="ws360ProfileRoleBadge"
        />
      </div>
    </header>
  );
}
