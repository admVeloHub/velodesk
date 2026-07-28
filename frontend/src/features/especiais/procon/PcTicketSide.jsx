/**
 * PcTicketSide — sidebar direita do ticket RA
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../../context/NotificationContext';
import { getStatusLabel } from '../../../services/especiais/proconData';
import { formatPcDeadlineLabel } from '../../../services/especiais/proconTicketService';
import { formatComplaintDate } from './pcTicketFormatters';

export default function PcTicketSide({
  pcItem,
  ticket,
  waChatOpen = false,
  onOpenChat,
  onCloseChat,
}) {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();

  const handleModeracao = () => {
    showNotification('Módulo de moderação em breve.', 'info');
  };

  if (!pcItem) return null;

  const protocoloDisplay = pcItem.protocoloProcon ? `#${pcItem.protocoloProcon}` : '—';
  const deadlineLabel = formatPcDeadlineLabel(pcItem.prazoLegal);
  const emails = ticket?.lateralForm?.clienteEmail || (pcItem.email ? [pcItem.email] : []);
  const phones = ticket?.lateralForm?.clienteTelefone || (pcItem.telefoneWhatsapp ? [pcItem.telefoneWhatsapp] : []);

  return (
    <aside className="ra-crm-side">
      <div className="ra-ticket__side">
        <section className="ra-ticket__side-card">
          <h2>RECLAME AQUI — DADOS</h2>
          <span className={`ra-badge ra-badge--${pcItem.statusPc}`}>
            {getStatusLabel(pcItem.statusPc)}
          </span>
          <dl>
            <div>
              <dt>Protocolo RA</dt>
              <dd>{protocoloDisplay}</dd>
            </div>
            <div>
              <dt>Assunto</dt>
              <dd>{pcItem.assunto || '—'}</dd>
            </div>
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
                <dd>{pcItem.workflow || 'Tratativa RA'}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="ra-ticket__side-card">
          <h2>CONTATO DO CONSUMIDOR</h2>
          <dl>
            <div>
              <dt>CPF</dt>
              <dd>{pcItem.cpf || '—'}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{emails[0] || '—'}</dd>
            </div>
            <div>
              <dt>Telefone principal</dt>
              <dd>{phones[0] || '—'}</dd>
            </div>
            <div>
              <dt>Telefone secundário</dt>
              <dd>{phones[1] || '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="ra-registro__moderacao ra-ticket__moderacao">
          <div className="ra-registro__moderacao-icon">
            <i className="ti ti-shield" aria-hidden="true" />
          </div>
          <div className="ra-registro__moderacao-content">
            <h3>Solicitar moderação</h3>
            <button type="button" className="ra-registro__moderacao-btn" onClick={handleModeracao}>
              Abrir módulo de moderação
            </button>
          </div>
        </section>

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
