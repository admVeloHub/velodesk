/**
 * PcTicketSide — sidebar direita do ticket Procon
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getStatusLabel } from '../../../services/especiais/proconData';
import { formatPcDeadlineLabel } from '../../../services/especiais/proconTicketService';
import { formatComplaintDate } from './pcTicketFormatters';
import EspeciaisWorkflowSolicitacoesSection from '../shared/EspeciaisWorkflowSolicitacoesSection';

function formatLocal(value, uf) {
  const city = String(value || '').trim();
  const state = String(uf || '').trim();
  if (city && state) return `${city} / ${state}`;
  return city || state || '';
}

export default function PcTicketSide({
  pcItem,
  ticket,
  waChatOpen = false,
  onOpenChat,
  onCloseChat,
  onTicketUpdated,
}) {
  const navigate = useNavigate();

  if (!pcItem) return null;

  const protocoloDisplay = pcItem.protocoloProcon ? `#${pcItem.protocoloProcon}` : '—';
  const deadlineLabel = formatPcDeadlineLabel(pcItem.prazoLegal);
  const localDisplay = formatLocal(pcItem.cidade, pcItem.uf);

  return (
    <aside className="ra-crm-side">
      <div className="ra-ticket__side">
        <section className="ra-ticket__side-card">
          <h2>PROCON — DADOS</h2>
          <span className={`ra-badge ra-badge--${pcItem.statusPc}`}>
            {getStatusLabel(pcItem.statusPc)}
          </span>
          <dl>
            <div>
              <dt>Protocolo Procon</dt>
              <dd>{protocoloDisplay}</dd>
            </div>
            {pcItem.idDemanda ? (
              <div>
                <dt>ID da demanda</dt>
                <dd>{pcItem.idDemanda}</dd>
              </div>
            ) : null}
            <div>
              <dt>Assunto</dt>
              <dd>{pcItem.assunto || '—'}</dd>
            </div>
            {pcItem.orgaoProcon ? (
              <div>
                <dt>Órgão Procon</dt>
                <dd>{pcItem.orgaoProcon}</dd>
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
              <dd>{formatComplaintDate(pcItem.dataDemanda)}</dd>
            </div>
            {pcItem.workflowAtivo ? (
              <div>
                <dt>Workflow</dt>
                <dd>{pcItem.workflow || 'Tratativa Procon'}</dd>
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
            onClick={() => navigate('/especiais/procon')}
          >
            <i className="ti ti-device-floppy" aria-hidden="true" />
            Salvar ticket
          </button>
        </div>
      </div>
    </aside>
  );
}
