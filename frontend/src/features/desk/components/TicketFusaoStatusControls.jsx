/**
 * Badge Mesclado + botão lista de filhos — linha do status
 * VERSION: v1.2.0 | DATE: 2026-08-07
 */
import React, { useCallback, useMemo, useState } from 'react';
import FusaoFundidoBadge from './FusaoFundidoBadge';

function resolveFusaoChildren(fusao) {
  if (!fusao || fusao.fundido !== true || String(fusao.hierarquia || '') !== 'superior') {
    return [];
  }
  const ids = Array.isArray(fusao.childIds) ? fusao.childIds.map(String) : [];
  const protos = Array.isArray(fusao.childProtocolos) ? fusao.childProtocolos.map(String) : [];
  const len = Math.max(ids.length, protos.length);
  const rows = [];
  for (let i = 0; i < len; i += 1) {
    rows.push({
      id: ids[i] || '',
      protocolo: protos[i] || ids[i] || `filho-${i + 1}`,
    });
  }
  if (!rows.length && fusao.childId) {
    rows.push({
      id: String(fusao.childId),
      protocolo: fusao.childProtocolo || String(fusao.childId),
    });
  }
  return rows;
}

export default function TicketFusaoStatusControls({ ticket, onOpenChild }) {
  const [open, setOpen] = useState(false);
  const fusao = ticket?.fusao;
  const children = useMemo(() => resolveFusaoChildren(fusao), [fusao]);

  const openChild = useCallback((childId) => {
    if (!childId) return;
    setOpen(false);
    if (typeof onOpenChild === 'function') {
      onOpenChild(childId);
    }
  }, [onOpenChild]);

  if (!fusao?.fundido) return null;

  return (
    <div className="tabs-top__fusao">
      <FusaoFundidoBadge fusao={fusao} />
      {children.length ? (
        <div className="ticket-client-fusao-wrap">
          <button
            type="button"
            className="btn-secondary btn-sm ticket-client-fusao-btn"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            title="Tickets mesclados neste chamado"
          >
            <i className="ti ti-git-merge" aria-hidden="true" />
            {' '}
            Mesclados ({children.length})
          </button>
          {open ? (
            <div className="ticket-client-fusao-popover" role="menu">
              <ul className="ticket-client-fusao-list">
                {children.map((child) => (
                  <li key={child.id || child.protocolo}>
                    <button
                      type="button"
                      className="ticket-client-fusao-list__item"
                      onClick={() => openChild(child.id)}
                      disabled={!child.id}
                    >
                      #{child.protocolo}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
