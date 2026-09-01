/**
 * RaTicketSide — sidebar direita do ticket RA
 */
import React from 'react';
import { getStatusLabel } from '../../../services/especiais/reclameAquiData';
import { formatComplaintDate } from './raTicketFormatters';
import RaDadosEditableFields from './RaDadosEditableFields';
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
  onClassificacaoDraftChange,
}) {
  if (!raItem) return null;

  return (
    <aside className="ra-crm-side">
      <div className="ra-ticket__side">
        <section className="ra-ticket__side-card">
          <h2>RECLAME AQUI — DADOS</h2>
          <span className={`ra-badge ra-badge--${raItem.statusRa}`}>
            {getStatusLabel(raItem.statusRa)}
          </span>
          <dl>
            <RaDadosEditableFields raItem={raItem} onSaved={onRaItemUpdated} />
            <div>
              <dt>Produto</dt>
              <dd>{raItem.produto || '—'}</dd>
            </div>
            <div>
              <dt>Motivo</dt>
              <dd>{raItem.motivo || '—'}</dd>
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
          onClassificacaoDraftChange={onClassificacaoDraftChange}
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
