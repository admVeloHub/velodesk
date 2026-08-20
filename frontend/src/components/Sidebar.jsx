/**
 * Sidebar rail unificada — 3 estados: 10px | hover 52px | chevron fixa 220px
 * VERSION: v1.11.0 | DATE: 2026-07-27
 * Perfil: VeloHub (sem botÃ£o local na barra)
 */
import React, { useCallback, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isEspeciaisNavId, NAV_ITEMS } from '../config/profiles';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useVeloNews } from '../features/velonews/VeloNewsProvider';
import VeloNewsPopover from '../features/velonews/VeloNewsPopover';

function navKeyActivate(e, action) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    action?.();
  }
}

function isInsideNode(parent, target) {
  return parent instanceof Node && target instanceof Node && parent.contains(target);
}

function isInsideVeloNewsPopover(target) {
  return target instanceof Element && Boolean(target.closest?.('.velonews-popover'));
}

export default function Sidebar() {
  const { logout } = useAuth();
  const { isNavAllowed } = useProfile();
  const { unreadCount, popoverOpen, togglePopover, bellAnchorRef } = useVeloNews();
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
    const wrap = e.currentTarget;
    const related = e.relatedTarget;
    if (isInsideNode(wrap, related) || isInsideVeloNewsPopover(related)) return;
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

  // Ordem natural de NAV_ITEMS (não a ordem de um único perfil "ativo"), pra quem acumula
  // funções ver todos os módulos liberados numa posição estável e previsível.
  // Nem "Finalizados" do Desk (tickets-resolvidos) nem o do workflow (workflow-finalizados)
  // são exibidos — "Feito"/conclusão apenas remove o ticket da fila, sem tela de finalizados.
  const visibleNav = NAV_ITEMS.filter((item) => (
    isNavAllowed(item.id)
    && item.id !== 'workflow-finalizados'
    && item.id !== 'tickets-resolvidos'
  ));

  const handleNavClick = useCallback((item) => {
    const path = item.id === 'tickets' ? '/tickets?desk=v2' : item.path;
    // Canais Especiais usam React Router direto — navigateToPage remove .active cedo demais
    if (isEspeciaisNavId(item.id)) {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.classList.remove('tickets-active');
        mainContent.style.background = 'transparent';
      }
      window.syncMainSidebarNav?.(item.id);
      navigate(path);
      return;
    }
    if (item.id === 'workflow-finalizados') {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.classList.remove('tickets-active');
        mainContent.style.background = 'transparent';
      }
      window.syncMainSidebarNav?.('workflow-finalizados');
      navigate('/workflow?view=finalizados');
      return;
    }
    if (typeof window.navigateToPage === 'function' && item.id !== 'workflow-inbox') {
      window.navigateToPage(item.id);
      return;
    }
    if (item.id === 'workflow-inbox') {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.classList.remove('tickets-active');
        mainContent.style.background = 'transparent';
      }
      window.syncMainSidebarNav?.('workflow-inbox');
    }
    navigate(path);
  }, [navigate]);

  const isActive = (item) => {
    const path = item.id === 'tickets' ? '/tickets' : item.path;
    if (item.id === 'workflow-finalizados') {
      return location.pathname === '/workflow' && new URLSearchParams(location.search).get('view') === 'finalizados';
    }
    if (item.id === 'workflow-inbox') {
      return location.pathname === '/workflow' && !new URLSearchParams(location.search).get('view');
    }
    if (item.id === 'tickets-resolvidos') {
      return location.pathname === '/tickets' && new URLSearchParams(location.search).get('queue') === 'resolvidos';
    }
    if (item.id === 'tickets') {
      return location.pathname === '/tickets' && new URLSearchParams(location.search).get('queue') !== 'resolvidos';
    }
    const basePath = path.split('?')[0];
    return location.pathname === basePath || location.pathname.startsWith(basePath + '/');
  };

  const wrapClass = [
    'velo-nav-rail-wrap',
    isOpen ? 'is-open' : '',
    pinned ? 'is-pinned' : '',
  ].filter(Boolean).join(' ');

  const renderNavItem = (item) => (
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
  );

  const renderNavList = () => visibleNav.map((item, index) => {
    const isEspeciais = isEspeciaisNavId(item.id);
    const prevIsEspeciais = index > 0 && isEspeciaisNavId(visibleNav[index - 1].id);
    const showDivider = isEspeciais && pinned && !prevIsEspeciais;
    return (
      <React.Fragment key={item.id}>
        {showDivider && (
          <li className="velo-nav-rail__nav-section" role="presentation">
            <div className="velo-nav-rail__section-divider" aria-hidden="true" />
            <span className="velo-nav-rail__section-label">Especiais</span>
          </li>
        )}
        {renderNavItem(item)}
      </React.Fragment>
    );
  });

  return (
    <div
      className={wrapClass}
      onMouseEnter={handleSidebarEnter}
      onMouseLeave={handleWrapLeave}
    >
      <nav
        className="sidebar collapsed velo-nav-rail"
        id="mainSidebar"
        aria-label="NavegaÃ§Ã£o"
        onMouseEnter={handleSidebarEnter}
        onMouseLeave={handleSidebarLeave}
        onFocus={handleSidebarEnter}
        onBlur={(e) => {
          if (pinned) return;
          const wrap = e.currentTarget.closest('.velo-nav-rail-wrap');
          const related = e.relatedTarget;
          if (isInsideNode(wrap, related) || isInsideVeloNewsPopover(related)) return;
          handleSidebarLeave();
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
          {renderNavList()}
        </ul>
        <div className="velo-nav-rail__foot">
          <div ref={bellAnchorRef} className="velo-nav-rail__foot-actions" data-tooltip="VeloNews">
            <div
              className={'notification-bell ws360-notification-bell velo-nav-rail__alerts-bell' + (popoverOpen ? ' is-open' : '')}
              id="btnAlertsNav"
              data-tooltip="VeloNews"
              title="VeloNews â€” alertas e notÃ­cias"
              onClick={togglePopover}
              onKeyDown={(e) => navKeyActivate(e, togglePopover)}
              role="button"
              tabIndex={0}
              aria-label="VeloNews â€” alertas e notÃ­cias"
              aria-expanded={popoverOpen}
            >
              <i className="fas fa-bell" />
              {unreadCount > 0 ? (
                <span className="notification-badge" aria-label={`${unreadCount} nÃ£o lidos`}>
                  {unreadCount}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="velo-nav-rail__logout-btn"
              data-tooltip="Sair"
              title="Sair da conta"
              aria-label="Sair da conta"
              onClick={logout}
            >
              <i className="ti ti-logout" aria-hidden="true" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </nav>
      <VeloNewsPopover />
    </div>
  );
}
