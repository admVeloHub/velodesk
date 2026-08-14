/**
 * RaTicketSide — sidebar direita do ticket RA
 */
import React from 'react';
import { getStatusLabel } from '../../../services/especiais/reclameAquiData';
import { formatRaDeadlineLabel } from '../../../services/especiais/reclameAquiTicketService';
import { formatComplaintDate } from './raTicketFormatters';
import EspeciaisWorkflowSolicitacoesSection from '../shared/EspeciaisWorkflowSolicitacoesSection';
import EspeciaisTicketSideFooter from '../shared/EspeciaisTicketSideFooter';

export default function RaTicketSide({
  raItem,
  ticket,
  waChatOpen = false,
  onOpenChat,
  onCloseChat,
  onTicketUpdated,
  onSave,
  onFinalize,
  saving = false,
  disabled = false,
  finalized = false,
}) {
  if (!raItem) return null;

  const protocoloDisplay = raItem.protocoloRa ? `#${raItem.protocoloRa}` : '—';
  const deadlineLabel = formatRaDeadlineLabel(raItem.prazoRa);

  return (
    <aside className="ra-crm-side">
      <div className="ra-ticket__side">
        <section className="ra-ticket__side-card">
          <h2>RECLAME AQUI — DADOS</h2>
          <span className={`ra-badge ra-badge--${raItem.statusRa}`}>
            {getStatusLabel(raItem.statusRa)}
          </span>
          <dl>
            <div>
              <dt>Protocolo RA</dt>
              <dd>{protocoloDisplay}</dd>
            </div>
            <div>
              <dt>Assunto</dt>
              <dd>{raItem.assunto || '—'}</dd>
            </div>
            <div>
              <dt>Prazo de resposta</dt>
              <dd className="ra-ticket__deadline-value">{deadlineLabel}</dd>
            </div>
            <div>
              <dt>Data da reclamação</dt>
              <dd>{formatComplaintDate(raItem.dataReclamacao)}</dd>
            </div>
            {raItem.workflowAtivo ? (
              <div>
                <dt>Workflow</dt>
                <dd>{raItem.workflow || 'Tratativa RA'}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <EspeciaisWorkflowSolicitacoesSection
          ticket={ticket}
          onTicketUpdated={onTicketUpdated}
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
