/**
 * Ponte global — navegação e ações do cockpit ↔ React Router
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
const PAGE_ROUTES = {
  workspace: '/workspace',
  dashboard: '/dashboard',
  tickets: '/tickets?desk=v2',
  chat: '/chat',
  reports: '/reports',
  config: '/config',
  'analytics-ia': '/analytics-ia',
  'client-portal': '/client-portal'
};

export function installCockpitBridge(navigate, showNotification, ticketActions) {
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

    navigate(PAGE_ROUTES[page] || '/workspace');
  };

  window.navigateToPageMobile = window.navigateToPage;

  window.syncMainSidebarNav = function syncMainSidebarNav(page) {
    document.querySelectorAll('#mainSidebar .nav-item[data-page]').forEach((item) => {
      item.classList.toggle('active', item.getAttribute('data-page') === page);
    });
  };

  window.openQuickRegisterModal = function openQuickRegisterModal() {
    window.dispatchEvent(new CustomEvent('velodesk:quick-register'));
  };

  window.closeQuickRegisterModal = function closeQuickRegisterModal() {
    window.dispatchEvent(new CustomEvent('velodesk:quick-register-close'));
  };

  if (ticketActions?.openTicket) {
    window.openTicket = function openTicket(ticketId) {
      ticketActions.openTicket(ticketId);
      navigate('/tickets?desk=v2');
    };
  }

  window.showNotification = function cockpitShowNotification(message, type) {
    showNotification(message, type || 'info');
  };
}
