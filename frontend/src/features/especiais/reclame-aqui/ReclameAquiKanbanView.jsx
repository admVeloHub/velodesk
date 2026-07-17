/**
 * ReclameAquiKanbanView — colunas por status RA
 */
import React from 'react';
import { getStatusLabel } from '../../../services/especiais/reclameAquiData';
import { formatPrazoRa } from '../../../services/especiais/reclameAquiStore';

export default function ReclameAquiKanbanView({ columns }) {
  return (
    <div className="ra-kanban">
      {columns.map((col) => (
        <section key={col.id} className={`ra-kanban__col ra-kanban__col--${col.tone}`}>
          <header className="ra-kanban__col-head">
            <h3>{col.label}</h3>
            <span className="ra-kanban__count">{col.items.length}</span>
          </header>
          <div className="ra-kanban__cards">
            {col.items.map((item) => (
              <article key={item.id} className="ra-kanban__card">
                <div className="ra-kanban__card-head">
                  <span className="ra-avatar ra-avatar--sm">{item.iniciais}</span>
                  <strong>{item.consumidor}</strong>
                </div>
                <p className="ra-kanban__assunto">{item.assunto}</p>
                <div className="ra-kanban__meta">
                  <span className={`ra-badge ra-badge--${item.statusRa}`}>
                    {getStatusLabel(item.statusRa)}
                  </span>
                  <span className="ra-kanban__prazo">{formatPrazoRa(item.prazoRa)}</span>
                </div>
              </article>
            ))}
            {!col.items.length ? (
              <p className="ra-kanban__empty">Nenhum item</p>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
