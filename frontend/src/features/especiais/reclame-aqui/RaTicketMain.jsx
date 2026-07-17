/**
 * RaTicketMain — coluna central do ticket RA (header + thread + compose)
 */
import React, { useCallback, useMemo, useState } from 'react';
import DeskWhatsAppChat from '../../desk/components/DeskWhatsAppChat';
import ClientTicketHistoryModal from '../../desk/components/ClientTicketHistoryModal';
import { useNotifications } from '../../../context/NotificationContext';
import { useTicketAiSuggestions } from '../../../hooks/useTicketAiSuggestions';
import { lookupClient } from '../../../services/clientDb';
import { buildRegistroThread } from '../../../services/desk/utils';
import { getStatusLabel } from '../../../services/especiais/reclameAquiData';
import {
  formatRaDeadlineLabel,
  getRaThreadMessages,
  publishRaPublicResponse,
  saveRaInternalNote,
  sendRaWaMessage,
} from '../../../services/especiais/reclameAquiTicketService';
import { formatComplaintDate, formatMessageTime } from './raTicketFormatters';

export default function RaTicketMain({
  raItem,
  ticket,
  loading,
  waChatOpen = false,
  waComposeText = '',
  onWaComposeTextChange,
  onTicketUpdated,
}) {
  const { showNotification } = useNotifications();
  const [composeMode, setComposeMode] = useState('public');
  const [composeText, setComposeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const rightFields = useMemo(() => ({
    canal: ticket?.lateralForm?.canal || 'Reclame Aqui',
    produto: ticket?.lateralForm?.produto || raItem?.produto || '',
    tipo: ticket?.lateralForm?.classificacaoTipo || raItem?.tipo || '',
    motivo: ticket?.lateralForm?.motivo || raItem?.motivo || '',
  }), [ticket, raItem]);

  const convMsgs = useMemo(
    () => (ticket ? buildRegistroThread(ticket) : []),
    [ticket],
  );

  const client = useMemo(() => {
    if (!ticket) return null;
    const cpf = ticket.lateralForm?.cpf || ticket.lateralForm?.clienteCpf || ticket.clientCPF;
    return lookupClient(cpf);
  }, [ticket]);

  const ticketAi = useTicketAiSuggestions(ticket, rightFields, convMsgs, '');

  const handleWaSend = useCallback(async () => {
    const text = waComposeText.trim();
    if (!text || !raItem?.ticketId) {
      showNotification('Escreva uma mensagem antes de enviar.', 'warning');
      return;
    }
    try {
      const updated = await sendRaWaMessage(raItem.ticketId, text);
      onWaComposeTextChange?.('');
      onTicketUpdated?.(updated);
      showNotification('Mensagem enviada.', 'success');
    } catch {
      showNotification('Não foi possível enviar a mensagem.', 'error');
    }
  }, [waComposeText, raItem?.ticketId, onWaComposeTextChange, onTicketUpdated, showNotification]);

  const handleSelectHistoryTicket = useCallback((ticketId) => {
    if (typeof window.openTicket === 'function') {
      window.openTicket(ticketId);
      return;
    }
    showNotification('Abra o Desk para visualizar o ticket selecionado.', 'info');
  }, [showNotification]);

  if (loading) {
    return (
      <div className="ra-crm-main ra-crm-main--loading">
        <p>Carregando ticket...</p>
      </div>
    );
  }

  if (!raItem) {
    return (
      <div className="ra-crm-main">
        <div className="ra-crm-empty-state ra-crm-empty-state--main">
          Selecione uma reclamação na lista ao lado
        </div>
      </div>
    );
  }

  const protocoloDisplay = raItem.protocoloRa ? `#${raItem.protocoloRa}` : '—';
  const threadMessages = getRaThreadMessages(ticket, raItem);
  const deadlineLabel = formatRaDeadlineLabel(raItem.prazoRa);

  const handlePublish = async () => {
    const text = composeText.trim();
    if (!text) {
      showNotification('Escreva uma resposta antes de publicar.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const updated = composeMode === 'public'
        ? await publishRaPublicResponse(raItem.ticketId, text)
        : await saveRaInternalNote(raItem.ticketId, text);
      setComposeText('');
      showNotification(
        composeMode === 'public' ? 'Resposta publicada no ticket.' : 'Nota interna salva.',
        'success',
      );
      onTicketUpdated?.(updated);
    } catch {
      showNotification('Não foi possível enviar a mensagem.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ra-crm-main">
      <div className="ra-ticket ra-ticket--in-shell" id="reclameAquiTicket">
        <header className="ra-ticket__header">
          <div className="ra-ticket__header-left">
            <span className="ra-ticket__brand">
              <i className="ti ti-messages" aria-hidden="true" />
              Reclame Aqui
            </span>
            <span className="ra-ticket__protocol">{protocoloDisplay}</span>
          </div>
          <div className="ra-ticket__header-right">
            <span className={`ra-badge ra-badge--${raItem.statusRa}`}>
              {getStatusLabel(raItem.statusRa)}
            </span>
            {raItem.urlRa ? (
              <a
                className="ra-ticket__external"
                href={raItem.urlRa}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver no RA
                <i className="ti ti-external-link" aria-hidden="true" />
              </a>
            ) : (
              <span className="ra-ticket__external ra-ticket__external--muted">
                Ver no RA
                <i className="ti ti-external-link" aria-hidden="true" />
              </span>
            )}
          </div>
        </header>

        <div className={`ra-ticket__main${waChatOpen ? ' ra-ticket__main--wa' : ''}`}>
          {waChatOpen ? (
            <div className="ra-crm-wa-wrap">
              <DeskWhatsAppChat
                key={ticket?.id || raItem.ticketId}
                ticket={ticket}
                client={client}
                messages={convMsgs}
                composeText={waComposeText}
                onComposeTextChange={onWaComposeTextChange}
                onUseIaReply={onWaComposeTextChange}
                onSend={handleWaSend}
                iaReply={ticketAi.respostaSugerida}
                iaReplyLoading={ticketAi.loading}
                iaWaitingMessage={ticketAi.waitingMessage}
                iaShowBar={ticketAi.showIaBar}
                iaHasSuggestion={ticketAi.hasSuggestion}
                iaError={ticketAi.error}
              />
            </div>
          ) : (
            <>
              <div className="ra-ticket__main-scroll">
                <section className="ra-ticket__profile">
                  <span className="ra-ticket__avatar">{raItem.iniciais || '—'}</span>
                  <div className="ra-ticket__profile-text">
                    <h1>{raItem.consumidor || 'Consumidor'}</h1>
                    <p>
                      {raItem.cpf ? `CPF ${raItem.cpf}` : 'CPF não informado'}
                      {raItem.clienteDesde ? ` · cliente há ${raItem.clienteDesde}` : ''}
                    </p>
                  </div>
                  <div className="ra-ticket__profile-actions">
                    <button
                      type="button"
                      className="btn-secondary btn-sm ticket-client-history-btn"
                      id="btnClientHistory"
                      onClick={() => setHistoryOpen(true)}
                      disabled={!ticket}
                    >
                      <i className="fas fa-history" aria-hidden="true" />
                      Histórico
                    </button>
                    <span className="ra-ticket__channel-badge">
                      <i className="ti ti-star" aria-hidden="true" />
                      Reclame Aqui
                    </span>
                  </div>
                </section>

                <section className="ra-ticket__complaint">
                  <i className="ti ti-quote ra-ticket__complaint-icon" aria-hidden="true" />
                  <p>{raItem.descricao || 'Sem descrição da reclamação.'}</p>
                  <footer>
                    <span>{formatComplaintDate(raItem.dataReclamacao)}</span>
                    <span>{raItem.assunto}</span>
                  </footer>
                </section>

                <div className="ra-ticket__deadline">
                  <i className="ti ti-clock" aria-hidden="true" />
                  Prazo de resposta no Reclame Aqui:
                  {' '}
                  <strong>{deadlineLabel}</strong>
                </div>

                <section className="ra-ticket__thread" aria-label="Histórico de mensagens">
                  {threadMessages.length === 0 ? (
                    <p className="ra-ticket__thread-empty">Nenhuma resposta publicada ainda.</p>
                  ) : (
                    threadMessages.map((msg) => {
                      const isAgent = !msg.fromClient && msg.origin !== 'cliente';
                      return (
                        <article
                          key={msg.id}
                          className={`ra-ticket__msg${isAgent ? ' ra-ticket__msg--agent' : ' ra-ticket__msg--client'}`}
                        >
                          {!isAgent ? (
                            <span className="ra-ticket__msg-avatar">{raItem.iniciais || '—'}</span>
                          ) : null}
                          <div className="ra-ticket__msg-body">
                            <p>{msg.text}</p>
                            <footer>
                              {isAgent ? 'Resposta pública' : 'Réplica no RA'}
                              {' — '}
                              {msg.author || (isAgent ? raItem.atendente : raItem.consumidor)}
                              {' — '}
                              {formatMessageTime(msg.timestamp || msg.time)}
                            </footer>
                          </div>
                        </article>
                      );
                    })
                  )}
                </section>
              </div>

              <section className="ra-ticket__compose" aria-label="Compositor de resposta">
                <div className="ra-ticket__compose-tabs">
                  <button
                    type="button"
                    className={composeMode === 'public' ? 'is-active' : ''}
                    onClick={() => setComposeMode('public')}
                  >
                    Resposta pública (RA)
                  </button>
                  <button
                    type="button"
                    className={composeMode === 'internal' ? 'is-active' : ''}
                    onClick={() => setComposeMode('internal')}
                  >
                    Nota interna
                  </button>
                </div>
                <textarea
                  className="ra-ticket__compose-input"
                  rows={4}
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                  placeholder={
                    composeMode === 'public'
                      ? 'Escreva a resposta que será publicada no Reclame Aqui...'
                      : 'Escreva uma nota interna para a equipe...'
                  }
                />
                <div className="ra-ticket__compose-footer">
                  <span className="ra-ticket__compose-hint">
                    {composeMode === 'public' ? (
                      <>
                        <i className="ti ti-world" aria-hidden="true" />
                        Pública — visível no Reclame Aqui
                      </>
                    ) : (
                      <>
                        <i className="ti ti-lock" aria-hidden="true" />
                        Interna — só equipe Velodesk
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    className="ra-ticket__publish-btn"
                    onClick={handlePublish}
                    disabled={submitting}
                  >
                    <i className="ti ti-send" aria-hidden="true" />
                    {composeMode === 'public' ? 'Publicar resposta' : 'Salvar nota'}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
      <ClientTicketHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        ticket={ticket}
        client={client}
        onSelectTicket={handleSelectHistoryTicket}
      />
    </div>
  );
}
