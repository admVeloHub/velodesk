/**
 * CgTicketSide — sidebar direita do ticket Consumidor.gov
 */
import React from 'react';
import { getStatusLabel } from '../../../services/especiais/consumidorGovData';
import { formatCgDeadlineLabel } from '../../../services/especiais/consumidorGovTicketService';
import { formatComplaintDate } from './cgTicketFormatters';
import CgClassificacaoFields from './CgClassificacaoFields';
import EspeciaisTicketSideFooter from '../shared/EspeciaisTicketSideFooter';

function formatLocal(value, uf) {
  const city = String(value || '').trim();
  const state = String(uf || '').trim();
  if (city && state) return `${city} / ${state}`;
  return city || state || '';
}

export default function CgTicketSide({
  cgItem,
  ticket,
  waChatOpen = false,
  onOpenChat,
  onCloseChat,
  onSave,
  onFinalize,
  saving = false,
  disabled = false,
  finalized = false,
  onCgItemUpdated,
}) {
  if (!cgItem) return null;

  const protocoloDisplay = cgItem.protocoloGov ? `#${cgItem.protocoloGov}` : '—';
  const deadlineLabel = formatCgDeadlineLabel(cgItem.prazoLegal);
  const localDisplay = formatLocal(cgItem.cidade, cgItem.uf);

  return (
    <aside className="ra-crm-side">
      <div className="ra-ticket__side">
        <section className="ra-ticket__side-card">
          <h2>CONSUMIDOR.GOV — DADOS</h2>
          <span className={`ra-badge ra-badge--${cgItem.statusGov}`}>
            {getStatusLabel(cgItem.statusGov)}
          </span>
          <dl>
            <div>
              <dt>Protocolo Consumidor.gov</dt>
              <dd>{protocoloDisplay}</dd>
            </div>
            <div>
              <dt>Assunto</dt>
              <dd>{cgItem.assunto || '—'}</dd>
            </div>
            {cgItem.motivo ? (
              <div>
                <dt>Problema</dt>
                <dd>{cgItem.motivo}</dd>
              </div>
            ) : null}
            {cgItem.orgaoGov ? (
              <div>
                <dt>Órgão Consumidor.gov</dt>
                <dd>{cgItem.orgaoGov}</dd>
              </div>
            ) : null}
            {localDisplay ? (
              <div>
                <dt>Local</dt>
                <dd>{localDisplay}</dd>
              </div>
            ) : null}
            <div>
              <dt>Prazo de resposta</dt>
              <dd className="ra-ticket__deadline-value">{deadlineLabel}</dd>
            </div>
            <div>
              <dt>Data da demanda</dt>
              <dd>{formatComplaintDate(cgItem.dataDemanda)}</dd>
            </div>
            {cgItem.workflowAtivo ? (
              <div>
                <dt>Workflow</dt>
                <dd>{cgItem.workflow || 'Tratativa Consumidor.Gov'}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <CgClassificacaoFields
          cgItem={cgItem}
          onSaved={onCgItemUpdated}
        />

        <EspeciaisTicketSideFooter
          waChatOpen={waChatOpen}
          onOpenChat={onOpenChat}
          onCloseChat={onCloseChat}
          onSave={onSave}
          onFinalize={onFinalize}
          saving={saving}
          disabled={disabled}
          finalized={finalized}
        />
      </div>
    </aside>
  );
}
