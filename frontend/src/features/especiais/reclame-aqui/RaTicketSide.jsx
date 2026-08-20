/**
 * RaTicketSide — sidebar direita do ticket RA
 */
import React from 'react';
import { getStatusLabel } from '../../../services/especiais/reclameAquiData';
import { formatRaDeadlineLabel } from '../../../services/especiais/reclameAquiTicketService';
import { formatComplaintDate } from './raTicketFormatters';
import RaClassificacaoFields from './RaClassificacaoFields';
import RaNotaContatoCard from './RaNotaContatoCard';
import EspeciaisTicketSideFooter from '../shared/EspeciaisTicketSideFooter';

export default function RaTicketSide({
  raItem,
  ticket,
  waChatOpen = false,
  onOpenChat,
  onCloseChat,
  onSave,
  onFinalize,
  saving = false,
  disabled = false,
  finalized = false,
  onRaItemUpdated,
}) {
  if (!raItem) return null;

  const idReclamacaoDisplay = raItem.idReclamacaoRa || '—';
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
              <dt>ID Reclame Aqui</dt>
              <dd>{idReclamacaoDisplay}</dd>
            </div>
            <div>
              <dt>Assunto</dt>
              <dd>{raItem.assunto || '—'}</dd>
            </div>
            <div>
              <dt>Produto</dt>
              <dd>{raItem.produto || '—'}</dd>
            </div>
            <div>
              <dt>Motivo</dt>
              <dd>{raItem.motivo || '—'}</dd>
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

        <RaClassificacaoFields
          raItem={raItem}
          onSaved={onRaItemUpdated}
        />

        <RaNotaContatoCard
          raItem={raItem}
          onSaved={onRaItemUpdated}
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
