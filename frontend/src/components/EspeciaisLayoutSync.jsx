/**
 * EspeciaisLayoutSync — garante layout flexível ao abrir canais Especiais
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ESPECIAIS_ROUTES = [
  { prefix: '/especiais/reclame-aqui', pageId: 'especiais-reclame-aqui' },
  { prefix: '/especiais/procon', pageId: 'especiais-procon' },
  { prefix: '/especiais/consumidor-gov', pageId: 'especiais-consumidor-gov' },
];

function matchEspeciaisRoute(pathname) {
  return ESPECIAIS_ROUTES.find(
    (route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`),
  );
}

export default function EspeciaisLayoutSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    const match = matchEspeciaisRoute(pathname);
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return undefined;

    if (match) {
      mainContent.classList.remove('tickets-active');
      mainContent.style.background = 'transparent';
      mainContent.style.display = 'flex';
      mainContent.style.flexDirection = 'column';
      mainContent.style.minHeight = '0';
      mainContent.style.overflow = 'hidden';
      mainContent.style.padding = '0';
      window.syncMainSidebarNav?.(match.pageId);
      return undefined;
    }

    mainContent.style.display = '';
    mainContent.style.flexDirection = '';
    mainContent.style.minHeight = '';
    mainContent.style.overflow = '';
    mainContent.style.padding = '';
    return undefined;
  }, [pathname]);

  return null;
}
