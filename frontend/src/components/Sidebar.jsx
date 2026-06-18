/**
 * Sidebar rail unificada
 * VERSION: v1.0.0 | DATE: 2026-06-18
 */
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '../config/profiles';
import { useProfile } from '../context/ProfileContext';

export default function Sidebar({ onOpenAI }) {
  const { isNavAllowed } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleNav = NAV_ITEMS.filter((item) => isNavAllowed(item.id));

  const isActive = (item) => {
    const path = item.id === 'tickets' ? '/tickets' : item.path;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
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
            onClick={() => navigate(item.id === 'tickets' ? '/tickets?desk=v2' : item.path)}
            role="button"
            tabIndex={0}
          >
            <i className={'ti ' + item.icon} />
            <span>{item.label}</span>
            {item.badge && <span className="nav-item__badge" aria-hidden="true" />}
          </li>
        ))}
        <li className="nav-item" data-tooltip="Assistente IA" onClick={onOpenAI} role="button" tabIndex={0}>
          <i className="ti ti-robot" />
          <span>Assistente IA</span>
        </li>
      </ul>
      <div className="profile-section">
        <button className="profile-btn" id="profileBtn" onClick={() => setMenuOpen((v) => !v)}>
          <span className="sidebar-profile-initials" aria-hidden="true">AS</span>
          <span className="sidebar-profile-label">Meu Perfil</span>
        </button>
        {menuOpen && (
          <div className="profile-menu" id="profileMenu">
            <a href="#" onClick={(e) => { e.preventDefault(); navigate('/config'); setMenuOpen(false); }}>
              <i className="fas fa-user-edit" /> Editar Perfil
            </a>
            <a href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); }}>
              <i className="fas fa-key" /> Alterar Senha
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}
