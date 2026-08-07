/**
 * CgTicketSide — sidebar direita do ticket Consumidor.gov
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getStatusLabel } from '../../../services/especiais/consumidorGovData';
import { formatCgDeadlineLabel } from '../../../services/especiais/consumidorGovTicketService';
import { formatComplaintDate } from './cgTicketFormatters';
import EspeciaisWorkflowSolicitacoesSection from '../shared/EspeciaisWorkflowSolicitacoesSection';

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
  onTicketUpdated,
}) {
  const navigate = useNavigate();

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
            {cgItem.idDemanda ? (
              <div>
                <dt>ID da demanda</dt>
                <dd>{cgItem.idDemanda}</dd>
              </div>
            ) : null}
            <div>
              <dt>Assunto</dt>
              <dd>{cgItem.assunto || '—'}</dd>
            </div>
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

        <EspeciaisWorkflowSolicitacoesSection
          ticket={ticket}
          onTicketUpdated={onTicketUpdated}
        />

        <div className="ra-ticket__side-footer">
          <button
            type="button"
            className={`rp-footer-btn rp-footer-btn--secondary${waChatOpen ? ' is-active' : ''}`}
            id="btnOpenChat"
            onClick={waChatOpen ? onCloseChat : onOpenChat}
          >
            <i className="ti ti-message-circle" aria-hidden="true" />
            {waChatOpen ? 'Fechar conversa' : 'Abrir conversa'}
          </button>
          <button
            type="button"
            className="ra-ticket__save-btn"
            onClick={() => navigate('/especiais/consumidor-gov')}
          >
            <i className="ti ti-device-floppy" aria-hidden="true" />
            Salvar ticket
          </button>
        </div>
      </div>
    </aside>
  );
}
