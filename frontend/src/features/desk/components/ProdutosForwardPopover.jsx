/**
 * ProdutosForwardPopover — solicitação ao time de Produtos ao encaminhar ticket
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ProdSolicWorkspace from '../../cadastral/ProdSolicWorkspace';

const RIGHT_PANEL_ID = 'crmRightPanel';
const DRAWER_MAX_WIDTH = 1120;
const DRAWER_MIN_WIDTH = 680;
const DRAWER_GAP = 12;

function useProdutosForwardDrawerPosition(open) {
  const [layout, setLayout] = useState(null);

  useEffect(() => {
    if (!open) {
      setLayout(null);
      return undefined;
    }

    const update = () => {
      const panel = document.getElementById(RIGHT_PANEL_ID);
      if (!panel) return;

      const panelRect = panel.getBoundingClientRect();
      const sidebar = document.querySelector('.velo-nav-rail, .sidebar, #velodeskSidebar, .ws360-sidebar');
      const sidebarRight = sidebar instanceof Element
        ? sidebar.getBoundingClientRect().right
        : 56;

      const availableWidth = panelRect.left - sidebarRight - DRAWER_GAP;
      const width = Math.min(
        DRAWER_MAX_WIDTH,
        Math.max(DRAWER_MIN_WIDTH, availableWidth),
      );

      setLayout({
        panel: {
          position: 'fixed',
          top: `${panelRect.top}px`,
          height: `${panelRect.height}px`,
          right: `${window.innerWidth - panelRect.left}px`,
          width: `${width}px`,
        },
        backdrop: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: `${window.innerWidth - panelRect.left}px`,
          bottom: 0,
        },
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  return layout;
}

export default function ProdutosForwardPopover({
  open,
  ticket,
  client,
  onClose,
  onSubmitted,
}) {
  const [visible, setVisible] = useState(false);
  const layout = useProdutosForwardDrawerPosition(open);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return undefined;
    }

    const raf = requestAnimationFrame(() => setVisible(true));

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const handleSubmitted = () => {
    onSubmitted?.();
  };

  if (!open || !layout) return null;

  return createPortal(
    <div className="produtos-forward-popover" id="produtosForwardPopover">
      <button
        type="button"
        className={`produtos-forward-popover__backdrop${visible ? ' is-visible' : ''}`}
        style={layout.backdrop}
        aria-label="Fechar solicitação ao time de Produtos"
        onClick={onClose}
      />

      <aside
        className={`produtos-forward-popover__panel${visible ? ' is-visible' : ''}`}
        style={layout.panel}
        role="dialog"
        aria-label="Solicitações ao time de Produtos"
        aria-modal="true"
      >
        <button
          type="button"
          className="produtos-forward-popover__close"
          onClick={onClose}
          aria-label="Fechar"
        >
          <i className="ti ti-x" aria-hidden="true" />
        </button>

        <div className="produtos-forward-popover__workspace">
          <ProdSolicWorkspace
            className="prod-solic-page--embed"
            ticketOverride={ticket}
            clientOverride={client}
            onSubmitted={handleSubmitted}
          />
        </div>
      </aside>
    </div>,
    document.body,
  );
}
