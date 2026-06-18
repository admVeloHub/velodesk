/**
 * Desk CRM — raiz 5 colunas
 * VERSION: v2.2.0 | DATE: 2026-06-18
 */
import React, { useState, useEffect, useCallback } from 'react';
import { QUEUE_STATUSES, ESCALONAR_OPTIONS, SLA_LABELS } from '../../services/desk/constants';
import {
  filterTickets, countByQueue, pickDefaultTicket, buildConversationMessages,
  normalizeTicketForDeskV2, getSlaClass, formatCpf, getAgentName
} from '../../services/desk/utils';
import { findTicketEntry, updateTicketInKanban, sendTicketMessage } from '../../services/kanbanStorage';
import { lookupClient } from '../../services/clientDb';
import { useTickets } from '../../context/TicketsContext';
import { useNotifications } from '../../context/NotificationContext';
import CreateTicketWorkspace from './CreateTicketWorkspace';

function formatTicketDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getTicketTitle(t) {
  return t.title || t.description || 'Sem título';
}

export default function DeskV2Root() {
  const { refreshKey, refreshTickets } = useTickets();
  const { showNotification } = useNotifications();

  const [activeQueue, setActiveQueue] = useState('em-andamento');
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [activeSort, setActiveSort] = useState('data');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [mainTab, setMainTab] = useState('conversa');
  const [composeText, setComposeText] = useState('');
  const [rightFields, setRightFields] = useState({});
  const [escalonar, setEscalonar] = useState(null);
  const [cascadeCategory, setCascadeCategory] = useState(null);
  const [cascadeAction, setCascadeAction] = useState(null);

  const reload = useCallback(() => {
    refreshTickets();
  }, [refreshTickets]);

  useEffect(() => {
    if (!activeTicketId) {
      const def = pickDefaultTicket(activeQueue);
      if (def) setActiveTicketId(def);
    }
  }, [activeQueue, activeTicketId, refreshKey]);

  const entries = filterTickets(activeQueue, searchQuery, activeSort);
  const entry = activeTicketId ? findTicketEntry(activeTicketId) : null;
  const ticket = entry?.ticket;
  const client = ticket ? lookupClient(ticket.lateralForm?.cpf || ticket.clientCPF) : null;

  useEffect(() => {
    if (ticket) {
      normalizeTicketForDeskV2(ticket);
      const lf = ticket.lateralForm || {};
      setRightFields({
        responsavel: lf.responsavel || ticket.responsibleAgent || getAgentName(),
        canal: lf.canal || ticket.channel || 'WhatsApp',
        tipo: lf.classificacaoTipo || 'Solicitação',
        produto: lf.produto || 'Internet Fibra',
        motivo: lf.motivo || 'Lentidão'
      });
      setEscalonar(lf.escalonar || null);
      setCascadeCategory(lf.automacaoCategoria || null);
      setCascadeAction(lf.automacaoAcao || null);
    }
  }, [ticket?.id, refreshKey]);

  const selectTicket = (id) => {
    if (createOpen) return;
    setActiveTicketId(id);
    setComposeText('');
    setMainTab('conversa');
  };

  const selectQueue = (queueId) => {
    if (createOpen) return;
    setActiveQueue(queueId);
    setActiveTicketId(pickDefaultTicket(queueId));
  };

  const openCreateTicket = () => setCreateOpen(true);

  const handleSaveTicket = async () => {
    if (!ticket) return;
    try {
      await updateTicketInKanban(ticket.id, (t) => {
        t.lateralForm = { ...t.lateralForm, ...rightFields, escalonar, automacaoCategoria: cascadeCategory, automacaoAcao: cascadeAction };
        t.updatedAt = new Date().toISOString();
        return t;
      });
      showNotification('Ticket salvo.', 'success');
      reload();
    } catch {
      showNotification('Erro ao salvar ticket.', 'error');
    }
  };

  const handleSendReply = async () => {
    if (!ticket || !composeText.trim()) return;
    const text = composeText.trim();
    try {
      await sendTicketMessage(ticket.id, text, getAgentName());
      setComposeText('');
      showNotification('Resposta registrada.', 'success');
      reload();
    } catch {
      showNotification('Erro ao enviar mensagem.', 'error');
    }
  };

  const thermo = client?.termometro ?? 38;
  const thermoLabel = client?.termometroLabel || (thermo >= 55 ? 'Atenção' : 'Estável');
  const thermoColor = thermo >= 55 ? '#FCC200' : '#15A237';
  const convMsgs = ticket ? buildConversationMessages(ticket) : [];
  const iaReply = 'Prezado(a) cliente, analisamos sua solicitação e estamos trabalhando na melhor solução.';

  return (
    <div className={'app-shell' + (createOpen ? ' is-create-ticket has-preview' : '')} id="deskAppShell">
      <aside className={'queue-panel' + (queueCollapsed ? ' is-collapsed' : '') + (createOpen ? ' is-create-strip' : '')} id="crmQueuePanel">
        <div className="queue-panel__inner">
          <div className="queue-panel__header">
            <div className="queue-panel__header-top">
              <h2 className="queue-panel__title">Fila de atendimento</h2>
              <button type="button" className="crm-panel-retract" id="btnCollapseQueue" onClick={() => setQueueCollapsed(true)} title="Recolher fila">
                <i className="ti ti-chevron-left" />
              </button>
            </div>
            <label className="queue-search">
              <i className="ti ti-search" />
              <input type="search" id="crmQueueSearch" placeholder="Buscar tickets…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </label>
          </div>
          <ul className="queue-status-list" id="queueStatusList">
            {QUEUE_STATUSES.map((s) => (
              <li
                key={s.id}
                className={'queue-status-item' + (activeQueue === s.id ? ' is-active' : '')}
                data-queue={s.id}
                onClick={() => selectQueue(s.id)}
                role="button"
                tabIndex={0}
              >
                <span className="queue-status-item__dot" style={{ background: s.dot }} />
                <span className="queue-status-item__name">{s.name}</span>
                <span className="queue-status-item__count">{countByQueue(s.id)}</span>
              </li>
            ))}
          </ul>
          <div className="queue-panel__footer">
            <button type="button" className="queue-btn queue-btn--secondary" id="crmNewBox"><i className="ti ti-plus" /> Nova caixa</button>
            <button type="button" className="queue-btn queue-btn--primary" id="crmNewTicket" onClick={openCreateTicket}>
              <i className="ti ti-plus" /> Criar ticket
            </button>
          </div>
        </div>
        {queueCollapsed && (
          <button type="button" className="crm-panel-expand-tab crm-panel-expand-tab--queue" onClick={() => setQueueCollapsed(false)}>
            <i className="ti ti-chevron-right" /><span>FILA</span>
          </button>
        )}
      </aside>

      <aside className={'ticket-list-panel' + (listCollapsed ? ' is-collapsed' : '')} id="crmTicketListPanel">
        <div className="ticket-list-panel__inner">
          <div className="ticket-list-header">
            <div className="ticket-list-header__row">
              <h2 className="ticket-list-header__title" id="ticketListTitle">
                {(QUEUE_STATUSES.find((s) => s.id === activeQueue)?.name || '') + ' · ' + entries.length}
              </h2>
              <div className="ticket-list-header__actions">
                <button type="button" className="crm-panel-retract" onClick={() => setListCollapsed(true)}><i className="ti ti-chevron-left" /></button>
                <button type="button" className="crm-icon-btn" onClick={reload} title="Atualizar"><i className="ti ti-refresh" /></button>
              </div>
            </div>
            <div className="sort-chips">
              {['data', 'prioridade', 'sla'].map((sort) => (
                <button key={sort} type="button" className={'sort-chip' + (activeSort === sort ? ' is-active' : '')} data-sort={sort} onClick={() => setActiveSort(sort)}>
                  {sort === 'data' ? 'Data' : sort === 'prioridade' ? 'Prioridade' : 'SLA'}
                </button>
              ))}
            </div>
          </div>
          <ul className="ticket-cards" id="ticketCards">
            {entries.length === 0 ? (
              <li className="crm-empty-state" style={{ padding: 16, fontSize: 14 }}>Nenhum ticket nesta fila</li>
            ) : entries.map(({ ticket: t, queueId }) => {
              const sla = getSlaClass(t);
              return (
                <li
                  key={t.id}
                  className={'crm-ticket-card' + (String(t.id) === String(activeTicketId) ? ' is-active' : '')}
                  data-ticket-id={t.id}
                  onClick={() => selectTicket(t.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="crm-ticket-card__top">
                    <span className="crm-ticket-card__name">{t.clientName || t.solicitante || 'Cliente'}</span>
                    <span className="status-badge status-badge--open">{queueId}</span>
                  </div>
                  <div className="crm-ticket-card__subject">{getTicketTitle(t)}</div>
                  <div className="crm-ticket-card__meta"><span>{formatTicketDate(t.updatedAt || t.createdAt)}</span></div>
                  <span className={'crm-ticket-card__sla crm-ticket-card__sla--' + sla} title={SLA_LABELS[sla]} />
                </li>
              );
            })}
          </ul>
        </div>
        {listCollapsed && (
          <button type="button" className="crm-panel-expand-tab crm-panel-expand-tab--tickets" onClick={() => setListCollapsed(false)}>
            <i className="ti ti-chevron-right" /><span>LISTA</span>
          </button>
        )}
      </aside>

      <main className="crm-main-content" id="crmMainContent">
        {!ticket ? (
          <div className="crm-empty-state" id="crmEmptyMain">Selecione um ticket na lista ao lado</div>
        ) : (
          <div className="crm-ticket-view">
            <header className="crm-ticket-header">
              <div className="crm-ticket-header__left">
                <span className="crm-ticket-id">#{ticket.id}</span>
                <h1 className="crm-ticket-title">{getTicketTitle(ticket)}</h1>
              </div>
              <div className="crm-ticket-header__client" id={'ticket-client-profile-' + ticket.id}>
                <span id="profileName">{ticket.clientName}</span>
                <span id="profileCpf">{formatCpf(ticket.lateralForm?.cpf || ticket.clientCPF)}</span>
              </div>
            </header>
            <div className="octa-tabs">
              <button type="button" className={'tab-btn' + (mainTab === 'conversa' ? ' is-active' : '')} onClick={() => setMainTab('conversa')}>Conversa</button>
              <button type="button" className={'tab-btn' + (mainTab === 'notas' ? ' is-active' : '')} onClick={() => setMainTab('notas')}>Notas</button>
            </div>
            {mainTab === 'conversa' ? (
              <>
                <div className="conversation" id="conversation">
                  {convMsgs.map((msg, i) => (
                    <div key={i} className={'msg-row' + (msg.type === 'agent' ? ' msg-row--agent' : '')}>
                      {msg.type !== 'system' && (
                        <div className={'msg-avatar msg-avatar--' + msg.type}>{msg.initials || '?'}</div>
                      )}
                      {msg.type === 'system' && <div className="msg-avatar msg-avatar--system"><i className="ti ti-terminal" /></div>}
                      <div className="msg-body">
                        <div className={'msg-bubble msg-bubble--' + msg.type}>{msg.text}</div>
                        <div className="msg-meta">{msg.meta}</div>
                      </div>
                    </div>
                  ))}
                  <div className="ia-suggestion-bar" id="iaSuggestionBar">
                    <span className="ia-suggestion-bar__label">IA</span>
                    <span className="ia-suggestion-bar__text" id="iaReplyText">{iaReply}</span>
                    <div className="ia-suggestion-bar__actions">
                      <button type="button" className="ia-suggestion-bar__btn" onClick={() => setComposeText(iaReply)}>Usar resposta</button>
                    </div>
                  </div>
                </div>
                <div className="octa-compose-panel">
                  <textarea
                    id={'publicResponse-' + ticket.id}
                    className="octa-compose-textarea"
                    placeholder="Digite sua resposta ao cliente…"
                    value={composeText}
                    onChange={(e) => setComposeText(e.target.value)}
                  />
                  <div className="octa-compose-actions">
                    <button type="button" className="crm-send-btn" onClick={handleSendReply}>Enviar</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="tab-panel tab-panel--placeholder is-active"><p>Nenhuma nota interna registrada.</p></div>
            )}
          </div>
        )}
      </main>

      {ticket && (
        <aside className="crm-right-panel" id="crmRightPanel">
          <div className="crm-right-panel__scroll">
            <section className="rp-section">
              <div className="rp-section__label">Termômetro do cliente</div>
              <div className="thermo-score" id="thermoScore" style={{ color: thermoColor }}>{thermo}</div>
              <div className="thermo-bar"><div className="thermo-fill" id="thermoFill" style={{ width: thermo + '%', background: thermoColor }} /></div>
              <div className="thermo-label" id="thermoLabel" style={{ color: thermoColor }}>{thermoLabel}</div>
            </section>
            <section className="rp-section">
              <div className="rp-section__label">Classificação</div>
              {[
                ['selResponsavel', 'Responsável', 'responsavel', true],
                ['selCanal', 'Canal', 'canal', false],
                ['selTipo', 'Tipo', 'tipo', false],
                ['selProduto', 'Produto', 'produto', false],
                ['selMotivo', 'Motivo', 'motivo', false]
              ].map(([id, label, key, readonly]) => (
                <div className="rp-field" key={id}>
                  <label htmlFor={id}>{label}</label>
                  {readonly ? (
                    <input type="text" id={id} readOnly value={rightFields[key] || ''} />
                  ) : (
                    <select id={id} value={rightFields[key] || ''} onChange={(e) => setRightFields((f) => ({ ...f, [key]: e.target.value }))}>
                      {key === 'canal' && ['WhatsApp', 'Telefone', 'E-mail', 'Portal'].map((o) => <option key={o}>{o}</option>)}
                      {key === 'tipo' && ['Reclamação', 'Solicitação', 'Dúvida', 'Informação'].map((o) => <option key={o}>{o}</option>)}
                      {key === 'produto' && ['Internet Fibra', 'TV', 'Telefone', 'Combo'].map((o) => <option key={o}>{o}</option>)}
                      {key === 'motivo' && ['Lentidão', 'Queda de sinal', 'Sem conexão', 'Cancelamento', 'Cobrança'].map((o) => <option key={o}>{o}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </section>
            <section className="rp-section">
              <div className="rp-section__label">Escalonar</div>
              <div className="cascade-flow">
                {ESCALONAR_OPTIONS.map((opt) => (
                  <button key={opt.id} type="button" className={'cascade-flow__option' + (escalonar === opt.id ? ' is-selected' : '')} onClick={() => setEscalonar(opt.id)}>{opt.label}</button>
                ))}
              </div>
            </section>
            <section className="rp-section">
              <div className="ia-tabulation">
                <div className="ia-tabulation__label">SUGESTÃO IA</div>
                <div className="ia-tabulation__text" id="iaTabulationText">{rightFields.tipo} → {rightFields.produto} → {rightFields.motivo}</div>
              </div>
            </section>
          </div>
          <div className="crm-right-panel__footer">
            <button type="button" className="rp-footer-btn rp-footer-btn--primary" id="btnSaveTicket" onClick={handleSaveTicket}>
              <i className="ti ti-device-floppy" /> Salvar no ticket
            </button>
          </div>
        </aside>
      )}

      <CreateTicketWorkspace
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={(id) => { setActiveTicketId(id); setActiveQueue('novos'); reload(); showNotification('Ticket criado.', 'success'); }}
      />
    </div>
  );
}
