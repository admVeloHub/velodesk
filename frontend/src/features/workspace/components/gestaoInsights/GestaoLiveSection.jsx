/**
 * GestaoLiveSection v1.0.0 — wrapper recolhível compartilhado pelos cards "ao vivo" do Painel 360
 * (Telefonia, Aderência), no mesmo padrão visual/compacto do Realtime (.realtime-section).
 */
import React, { useState } from 'react';
import './gestaoLiveOperations.css';

export default function GestaoLiveSection({ icon, title, badge, live, defaultOpen = true, unavailable, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="realtime-section gestao-live-ops__section">
      <div className="realtime-section__header">
        <span className="realtime-section__icon">
          <i className={`ti ${icon}`} aria-hidden="true" />
        </span>
        <h2>{title}</h2>
        <div className="gestao-live-ops__header-actions">
          {badge ? (
            <span className="gestao-live-ops__badge">
              {live ? (
                <span className={`realtime-section__live-dot${live === 'alert' ? ' realtime-section__live-dot--alert' : ''}`} />
              ) : null}
              {badge}
            </span>
          ) : null}
          <button
            type="button"
            className="gestao-live-ops__toggle"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            <i className={`ti ti-chevron-${open ? 'up' : 'down'}`} aria-hidden="true" />
            {open ? 'Recolher' : 'Expandir'}
          </button>
        </div>
      </div>
      {open ? <div className="gestao-live-ops__body">{unavailable ?? children}</div> : null}
    </section>
  );
}
