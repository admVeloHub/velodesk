/**
 * Sidebar rail unificada
 * VERSION: v1.3.0 | DATE: 2026-06-19
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '../config/profiles';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../services/desk/utils';
import AccountSettingsModal from '../features/account/AccountSettingsModal';

function navKeyActivate(e, action) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    action?.();
  }
}

export default function Sidebar({ onOpenAI }) {
  const { isNavAllowed, profile } = useProfile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);

  const profileInitials = useMemo(
    () => getInitials(user?.name || 'Ana Silva'),
    [user?.name],
  );

  const visibleNav = NAV_ITEMS
    .filter((item) => isNavAllowed(item.id))
    .sort((a, b) => {
      const orderA = profile.nav.indexOf(a.id);
      const orderB = profile.nav.indexOf(b.id);
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
    });

  const handleNavClick = useCallback((item) => {
    if (typeof window.navigateToPage === 'function') {
      window.navigateToPage(item.id);
      return;
    }
    navigate(item.id === 'tickets' ? '/tickets?desk=v2' : item.path);
  }, [navigate]);

  const isActive = (item) => {
    const path = item.id === 'tickets' ? '/tickets' : item.path;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <>
      <nav className="sidebar collapsed velo-nav-rail" id="mainSidebar" aria-label="Navegação">
        <div className="sidebar-brand" title="Velodesk">V</div>
        <ul className="nav-list">
          {visibleNav.map((item) => (
            <li
              key={item.id}
              className={'nav-item' + (isActive(item) ? ' active' : '')}
              data-page={item.id}
              data-tooltip={item.tooltip}
              title={item.tooltip}
              onClick={() => handleNavClick(item)}
              onKeyDown={(e) => navKeyActivate(e, () => handleNavClick(item))}
              role="button"
              tabIndex={0}
            >
              <i className={'ti ' + item.icon} />
              <span>{item.label}</span>
              {item.badge && <span className="nav-item__badge" aria-hidden="true" />}
            </li>
          ))}
          <li
            className="nav-item"
            id="btnAiAssistantNav"
            data-tooltip="Assistente IA"
            title="Assistente IA"
            onClick={onOpenAI}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => navKeyActivate(e, onOpenAI)}
          >
            <i className="ti ti-robot" />
            <span>Assistente IA</span>
          </li>
        </ul>
        <div className="profile-section">
          <button
            className="profile-btn"
            id="profileBtn"
            title={(user?.name || 'Minha conta') + ' — configurações da conta'}
            aria-expanded={accountOpen}
            aria-haspopup="dialog"
            onClick={() => setAccountOpen(true)}
          >
            <span className="sidebar-profile-initials" aria-hidden="true">
              {profileInitials}
            </span>
            <span className="sidebar-profile-label">Meu Perfil</span>
          </button>
        </div>
      </nav>

      <AccountSettingsModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
      />
    </>
  );
}
