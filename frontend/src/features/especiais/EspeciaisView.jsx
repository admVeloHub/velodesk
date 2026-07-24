/**
 * EspeciaisView v1.0.0 — portal canais regulatórios
 * VERSION: v1.0.0 | DATE: 2026-07-17
 */
import React, { useMemo } from 'react';
import { usePermissions } from '../../context/PermissionContext';
import { CANAL_ORIGEM_BY_FUNCAO } from '../../services/permissions/permissionService';

const CANAL_META = [
  { slug: 'reclame-aqui', label: 'Reclame Aqui', permKey: 'reclame_aqui_gerenciar', icon: 'ti-message-report' },
  { slug: 'bacen', label: 'Bacen', permKey: 'bacen_gerenciar', icon: 'ti-building-bank' },
  { slug: 'procon', label: 'Procon', permKey: 'procon_gerenciar', icon: 'ti-gavel' },
  { slug: 'consumidor-gov', label: 'Consumidor .GOV', permKey: 'consumidor_gov_gerenciar', icon: 'ti-world' },
];

export default function EspeciaisView() {
  const { can, funcaoSlug } = usePermissions();

  const canais = useMemo(() => CANAL_META.filter((c) => can('especiais', c.permKey)), [can]);

  return (
    <div className="page especiais-page active">
      <header className="config-content-header">
        <span className="config-content-eyebrow">Portal Especiais</span>
        <div className="config-content-title-row">
          <h3>Canais especiais</h3>
          <p>Gestão de tickets e canais regulatórios vinculados à função {funcaoSlug}.</p>
        </div>
      </header>

      {canais.length === 0 ? (
        <div className="forms-empty-state">
          <p className="forms-empty-text">Sua função não possui acesso a canais especiais.</p>
        </div>
      ) : (
        <div className="config-welcome-grid">
          {canais.map((canal) => (
            <article key={canal.slug} className="config-welcome-card config-welcome-card--static">
              <span className="config-welcome-card-icon" aria-hidden="true">
                <i className={'ti ' + canal.icon} />
              </span>
              <strong>{canal.label}</strong>
              <p className="grupos-atrib-hub__lead">
                Origens: {(CANAL_ORIGEM_BY_FUNCAO[canal.slug] || []).join(', ')}
              </p>
              <p className="grupos-atrib-hub__lead">
                Visualize e atue em tickets com origem {canal.label} na fila de Tickets.
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
