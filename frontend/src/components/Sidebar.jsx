/**
 * Sidebar rail unificada — 3 estados: 5px | hover 52px | chevron fixa 220px
 * VERSION: v1.7.0 | DATE: 2026-06-24
 * Perfil: VeloHub (sem botão local na barra)
 */
import React, { useCallback, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '../config/profiles';
import { useProfile } from '../context/ProfileContext';

function navKeyActivate(e, action) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    action?.();
  }
}

export default function Sidebar({ onOpenAI }) {
  const { isNavAllowed, profile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const leaveTimerRef = useRef(null);

  const isOpen = hoverExpanded || pinned;

  const handleSidebarEnter = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setHoverExpanded(true);
  }, []);

  const handleSidebarLeave = useCallback(() => {
    if (pinned) return;
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      setHoverExpanded(false);
      leaveTimerRef.current = null;
    }, 60);
  }, [pinned]);

  const handleWrapLeave = useCallback((e) => {
    if (pinned) return;
    const nav = e.currentTarget.querySelector('#mainSidebar');
    if (nav && e.relatedTarget && nav.contains(e.relatedTarget)) return;
    handleSidebarLeave();
  }, [pinned, handleSidebarLeave]);

  const togglePinned = useCallback((e) => {
    e.stopPropagation();
    setPinned((prev) => {
      const next = !prev;
      if (next) setHoverExpanded(true);
      else setHoverExpanded(false);
      return next;
    });
  }, []);

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

  const wrapClass = [
    'velo-nav-rail-wrap',
    isOpen ? 'is-open' : '',
    pinned ? 'is-pinned' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={wrapClass}
      onMouseEnter={handleSidebarEnter}
      onMouseLeave={handleWrapLeave}
    >
      <nav
        className="sidebar collapsed velo-nav-rail"
        id="mainSidebar"
        aria-label="Navegação"
        onMouseEnter={handleSidebarEnter}
        onMouseLeave={handleSidebarLeave}
        onFocus={handleSidebarEnter}
        onBlur={(e) => {
          if (!pinned && !e.currentTarget.closest('.velo-nav-rail-wrap')?.contains(e.relatedTarget)) {
            handleSidebarLeave();
          }
        }}
      >
        <div className="velo-nav-rail__head">
          <button
            type="button"
            className="velo-nav-rail-chevron"
            id="btnSidebarPin"
            onClick={togglePinned}
            aria-expanded={pinned}
            aria-label={pinned ? 'Recolher menu lateral' : 'Fixar menu lateral com textos'}
            title={pinned ? 'Recolher menu' : 'Expandir menu com textos'}
          >
            <i className={'ti ti-chevron-' + (pinned ? 'left' : 'right')} aria-hidden="true" />
          </button>
        </div>
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
      </nav>
    </div>
  );
}
