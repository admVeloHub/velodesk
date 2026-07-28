/**
 * PcTicketMain — coluna central do ticket RA (header + thread + compose)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DeskConsultasPanel from '../../desk/components/DeskConsultasPanel';
import DeskWhatsAppChat from '../../desk/components/DeskWhatsAppChat';
import ClientTicketHistoryModal from '../../desk/components/ClientTicketHistoryModal';
import { useNotifications } from '../../../context/NotificationContext';
import { useTicketAiSuggestions } from '../../../hooks/useTicketAiSuggestions';
import { lookupClient } from '../../../services/clientDb';
import { buildRegistroThread } from '../../../services/desk/utils';
import { mergeTicketInto } from '../../../services/desk/ticketMergeService';
import { isDraftTicket } from '../../../services/ticketsCache';
import { getStatusLabel } from '../../../services/especiais/proconData';
import {
  formatPcDeadlineLabel,
  getPcThreadMessages,
  publishPcPublicResponse,
  savePcInternalNote,
  sendPcWaMessage,
} from '../../../services/especiais/proconTicketService';
import { formatComplaintDate, formatMessageTime } from './pcTicketFormatters';

export default function PcTicketMain({
  pcItem,
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
  const [mergeInProgress, setMergeInProgress] = useState(false);
  const [consultasOpen, setConsultasOpen] = useState(false);

  const rightFields = useMemo(() => ({
    canal: ticket?.lateralForm?.canal || 'Procon',
    produto: ticket?.lateralForm?.produto || pcItem?.produto || '',
    tipo: ticket?.lateralForm?.classificacaoTipo || pcItem?.tipo || '',
    motivo: ticket?.lateralForm?.motivo || pcItem?.motivo || '',
  }), [ticket, pcItem]);

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
    if (!text || !pcItem?.ticketId) {
      showNotification('Escreva uma mensagem antes de enviar.', 'warning');
      return;
    }
    try {
      const updated = await sendPcWaMessage(pcItem.ticketId, text);
      onWaComposeTextChange?.('');
      onTicketUpdated?.(updated);
      showNotification('Mensagem enviada.', 'success');
    } catch {
      showNotification('Não foi possível enviar a mensagem.', 'error');
    }
  }, [waComposeText, pcItem?.ticketId, onWaComposeTextChange, onTicketUpdated, showNotification]);

  const handleSelectHistoryTicket = useCallback((ticketId) => {
    if (typeof window.openTicket === 'function') {
      window.openTicket(ticketId);
      return;
    }
    showNotification('Abra o Desk para visualizar o ticket selecionado.', 'info');
  }, [showNotification]);

  const handleMergeTickets = useCallback(async (targetId) => {
    if (!ticket?.id || mergeInProgress) return;
    if (isDraftTicket(ticket)) {
      showNotification('Salve o ticket antes de mesclar.', 'warning');
      return;
    }
    setMergeInProgress(true);
    try {
      const result = await mergeTicketInto(ticket.id, targetId);
      setHistoryOpen(false);
      onTicketUpdated?.(result.target);
      if (typeof window.openTicket === 'function') {
        window.openTicket(targetId);
      }
      showNotification('Tickets mesclados com sucesso.', 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Não foi possível mesclar os tickets.';
      showNotification(msg, 'error');
    } finally {
      setMergeInProgress(false);
    }
  }, [ticket, mergeInProgress, onTicketUpdated, showNotification]);

  useEffect(() => {
    setConsultasOpen(false);
  }, [pcItem?.ticketId]);

  if (loading) {
    return (
      <div className="ra-crm-main ra-crm-main--loading">
        <p>Carregando ticket...</p>
      </div>
    );
  }

  if (!pcItem) {
    return (
      <div className="ra-crm-main">
        <div className="ra-crm-empty-state ra-crm-empty-state--main">
          Selecione uma demanda na lista ao lado
        </div>
      </div>
    );
  }

  const protocoloDisplay = pcItem.protocoloProcon ? `#${pcItem.protocoloProcon}` : '—';
  const threadMessages = getPcThreadMessages(ticket, pcItem);
  const deadlineLabel = formatPcDeadlineLabel(pcItem.prazoLegal);

  const handlePublish = async () => {
    const text = composeText.trim();
    if (!text) {
      showNotification('Escreva uma resposta antes de publicar.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const updated = composeMode === 'public'
        ? await publishPcPublicResponse(pcItem.ticketId, text)
        : await savePcInternalNote(pcItem.ticketId, text);
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
      <div className="ra-ticket ra-ticket--in-shell" id="proconTicket">
        <header className="ra-ticket__header">
          <div className="ra-ticket__header-left">
            <span className="ra-ticket__brand">
              <i className="ti ti-messages" aria-hidden="true" />
              Procon
            </span>
            <span className="ra-ticket__protocol">{protocoloDisplay}</span>
          </div>
          <div className="ra-ticket__header-right">
            <span className={`ra-badge ra-badge--${pcItem.statusPc}`}>
              {getStatusLabel(pcItem.statusPc)}
            </span>
            {pcItem.orgaoProcon ? (
              <span className="ra-ticket__external">
                {pcItem.orgaoProcon}
                {pcItem.cidade ? ` · ${pcItem.cidade}` : ''}
                {pcItem.uf ? `/${pcItem.uf}` : ''}
              </span>
            ) : (
              <span className="ra-ticket__external ra-ticket__external--muted">
                Órgão não informado
              </span>
            )}
          </div>
        </header>

        <div className={`ra-ticket__main${waChatOpen ? ' ra-ticket__main--wa' : ''}`}>
          {waChatOpen ? (
            <div className="ra-crm-wa-wrap">
              <DeskWhatsAppChat
                key={ticket?.id || pcItem.ticketId}
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
                  <span className="ra-ticket__avatar">{pcItem.iniciais || '—'}</span>
                  <div className="ra-ticket__profile-text">
                    <h1>{pcItem.consumidor || 'Consumidor'}</h1>
                    <p>
                      {pcItem.cpf ? `CPF ${pcItem.cpf}` : 'CPF não informado'}
                      {pcItem.clienteDesde ? ` · cliente há ${pcItem.clienteDesde}` : ''}
                    </p>
                  </div>
                  <div className="ra-ticket__profile-actions">
                    <button
                      type="button"
                      className={'tab-btn' + (consultasOpen ? ' is-active' : '')}
                      onClick={() => setConsultasOpen((open) => !open)}
                      disabled={!ticket}
                    >
                      <i className="ti ti-search" aria-hidden="true" />
                      Consultas
                    </button>
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
                  </div>
                </section>

                {consultasOpen ? (
                  <div className="ra-ticket__consultas-panel">
                    <DeskConsultasPanel ticket={ticket} client={client} />
                  </div>
                ) : (
                  <>
                <section className="ra-ticket__complaint">
                  <i className="ti ti-quote ra-ticket__complaint-icon" aria-hidden="true" />
                  <p>{pcItem.descricao || 'Sem descrição da demanda.'}</p>
                  <footer>
                    <span>{formatComplaintDate(pcItem.dataDemanda)}</span>
                    <span>{pcItem.assunto}</span>
                  </footer>
                </section>

                <div className="ra-ticket__deadline">
                  <i className="ti ti-clock" aria-hidden="true" />
                  Prazo de resposta no Procon:
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
                            <span className="ra-ticket__msg-avatar">{pcItem.iniciais || '—'}</span>
                          ) : null}
                          <div className="ra-ticket__msg-body">
                            <p>{msg.text}</p>
                            <footer>
                              {isAgent ? 'Resposta pública' : 'Réplica no RA'}
                              {' — '}
                              {msg.author || (isAgent ? pcItem.atendente : pcItem.consumidor)}
                              {' — '}
                              {formatMessageTime(msg.timestamp || msg.time)}
                            </footer>
                          </div>
                        </article>
                      );
                    })
                  )}
                </section>
                  </>
                )}
              </div>

              {!consultasOpen ? (
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
                      ? 'Escreva a resposta que será publicada no Procon...'
                      : 'Escreva uma nota interna para a equipe...'
                  }
                />
                <div className="ra-ticket__compose-footer">
                  <span className="ra-ticket__compose-hint">
                    {composeMode === 'public' ? (
                      <>
                        <i className="ti ti-world" aria-hidden="true" />
                        Pública — visível no Procon
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
              ) : null}
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
        sourceTicketId={ticket?.id || ticket?._id}
        onMergeTickets={handleMergeTickets}
        merging={mergeInProgress}
      />
    </div>
  );
}
