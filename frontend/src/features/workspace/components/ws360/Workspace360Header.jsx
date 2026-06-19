import React, { useRef, useState } from 'react';
import { useNotifications } from '../../../../context/NotificationContext';
import { useTheme } from '../../../../context/ThemeContext';
import ProfileRoleSwitcher from '../../../../components/ProfileRoleSwitcher';
import Workspace360NewsPopover, { getWs360NewsUnreadCount } from './Workspace360NewsPopover';

export default function Workspace360Header({ greeting, agentName, dateTimeLabel }) {
  const { panelOpen, togglePanel } = useNotifications();
  const { darkMode, toggleDarkMode } = useTheme();
  const bellWrapRef = useRef(null);
  const [newsBadgeCount, setNewsBadgeCount] = useState(() => getWs360NewsUnreadCount());

  return (
    <header className="ws360-header">
      <div className="ws360-header__intro">
        <h2 className="ws360-header__greeting">
          {greeting}, {agentName} 👋
        </h2>
        <p className="ws360-header__datetime">{dateTimeLabel}</p>
      </div>
      <div className="ws360-header__actions">
        <div className="ws360-header__bell-wrap" ref={bellWrapRef}>
          <div
            className={'notification-bell ws360-notification-bell' + (panelOpen ? ' is-open' : '')}
            onClick={togglePanel}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                togglePanel();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Notificações"
            aria-expanded={panelOpen}
          >
            <i className="fas fa-bell" />
            <span className="notification-badge">{newsBadgeCount}</span>
          </div>
          <Workspace360NewsPopover
            open={panelOpen}
            onClose={() => panelOpen && togglePanel()}
            anchorRef={bellWrapRef}
            onUnreadChange={setNewsBadgeCount}
          />
        </div>
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
