/**
 * Ponte global — navegação e ações do cockpit ↔ React Router
 * VERSION: v2.1.0 | DATE: 2026-07-13
 */
const PAGE_ROUTES = {
  workspace: '/workspace',
  dashboard: '/dashboard',
  tickets: '/tickets?desk=v2',
  'workflow-inbox': '/workflow',
  reports: '/reports',
  chat: '/chat',
  config: '/config',
  'analytics-ia': '/analytics-ia',
  'client-portal': '/client-portal',
};

function resolveOpenTicketPath(profileId, ticketId) {
  if (profileId === 'workflow') {
    return ticketId ? `/workflow?ticket=${ticketId}` : '/workflow';
  }
  return '/tickets?desk=v2';
}

export function installCockpitBridge(navigate, showNotification, ticketActions = {}) {
  const profileId = ticketActions.profileId || 'agent';

  window.navigateToPage = function navigateToPage(page) {
    document.querySelectorAll('.page').forEach((p) => {
      p.classList.remove('active', 'ticket-tab-open');
    });

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      if (page === 'tickets') {
        mainContent.style.background = 'transparent';
        mainContent.classList.add('tickets-active');
      } else {
        mainContent.classList.remove('tickets-active');
        mainContent.style.background = 'var(--light-gray)';
      }
    }

    if (page === 'tickets' && profileId === 'workflow') {
      navigate('/workflow');
      return;
    }

    navigate(PAGE_ROUTES[page] || '/workspace');
  };

  window.navigateToPageMobile = window.navigateToPage;

  window.syncMainSidebarNav = function syncMainSidebarNav(page) {
    document.querySelectorAll('#mainSidebar .nav-item[data-page]').forEach((item) => {
      item.classList.toggle('active', item.getAttribute('data-page') === page);
    });
  };

  window.openQuickRegisterModal = function openQuickRegisterModal() {
    if (profileId === 'workflow') {
      navigate('/workflow');
      return;
    }
    navigate('/tickets?desk=v2');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('velodesk:quick-register'));
    }, 0);
  };

  window.closeQuickRegisterModal = function closeQuickRegisterModal() {
    window.dispatchEvent(new CustomEvent('velodesk:quick-register-close'));
  };

  if (ticketActions.openTicket) {
    window.openTicket = function openTicket(ticketId) {
      if (profileId !== 'workflow') {
        ticketActions.openTicket(ticketId);
      }
      navigate(resolveOpenTicketPath(profileId, ticketId));
    };
  }

  if (ticketActions.refreshTickets) {
    window.refreshTickets = function refreshTickets() {
      return ticketActions.refreshTickets();
    };
  }

  window.dispatchRefreshTickets = function dispatchRefreshTickets() {
    window.dispatchEvent(new CustomEvent('velodesk:refresh-tickets'));
  };

  window.showNotification = function cockpitShowNotification(message, type) {
    showNotification(message, type || 'info');
  };
}
