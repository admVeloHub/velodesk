/**
 * Painel slide-in Criar ticket
 * VERSION: v2.2.0 | DATE: 2026-06-18
 */
import React, { useState, useEffect } from 'react';
import { searchClients, getAgentName } from '../../services/clientDb';
import { createTicketViaApi } from '../../services/ticketsCache';
import { buildCreatePayload } from '../../api/adapters/ticketAdapter';
import { useNotifications } from '../../context/NotificationContext';

const CHANNELS = ['WhatsApp', 'Telefone', 'E-mail'];

export default function CreateTicketWorkspace({ open, onClose, onSaved }) {
  const agent = getAgentName();
  const { showNotification } = useNotifications();
  const [clientSearch, setClientSearch] = useState('');
  const [client, setClient] = useState(null);
  const [channel, setChannel] = useState('Telefone');
  const [assunto, setAssunto] = useState('');
  const [assuntoError, setAssuntoError] = useState(false);
  const [tipo, setTipo] = useState('Reclamação');
  const [produto, setProduto] = useState('Internet Fibra');
  const [motivo, setMotivo] = useState('Lentidão');
  const [atribuir, setAtribuir] = useState(agent + ' (eu)');
  const [descricao, setDescricao] = useState('');

  useEffect(() => {
    if (!open) return;
    setClientSearch('');
    setClient(null);
    setAssunto('');
    setDescricao('');
    setChannel('Telefone');
    setAssuntoError(false);
  }, [open]);

  if (!open) return null;

  const handleSearch = () => {
    const results = searchClients(clientSearch);
    setClient(results[0] || null);
  };

  const handleSave = async () => {
    if (!assunto.trim()) {
      setAssuntoError(true);
      showNotification('Informe o assunto do ticket.', 'error');
      return;
    }
    setAssuntoError(false);
    const payload = buildCreatePayload({
      assunto,
      descricao,
      channel,
      tipo,
      produto,
      motivo,
      atribuir,
      clientName: client?.name || clientSearch || 'Cliente',
      clientCPF: client?.cpf || '',
    });
    try {
      const created = await createTicketViaApi(payload);
      if (!created) {
        showNotification('Não foi possível criar o ticket. Verifique sua conexão ou autenticação.', 'error');
        return;
      }
      if (onSaved) onSaved(created.id || created._id);
      onClose();
    } catch {
      showNotification('Erro ao criar ticket.', 'error');
    }
  };

  return (
    <div className="ct-workspace is-visible" id="createTicketWorkspace" aria-hidden={false}>
      <div className="ct-form-panel" id="createTicketFormPanel">
        <header className="ct-header">
          <button type="button" className="ct-back-btn" id="btnCreateTicketBack" title="Voltar" onClick={onClose}>
            <i className="ti ti-arrow-left" />
          </button>
          <h2 className="ct-header__title">Criar ticket</h2>
          <span className="ct-header__badge">Novo</span>
        </header>
        <div className="ct-body">
          <div className="ct-sec-lbl">Cliente</div>
          <div className="ct-field">
            <label className="ct-flbl" htmlFor="ctClientSearch">Buscar por CPF, nome ou e-mail <span className="ct-req">*</span></label>
            <div className="cpf-wrap">
              <input
                type="text"
                className="cpf-inp"
                id="ctClientSearch"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="123.456.789-01 ou nome do cliente"
                autoComplete="off"
              />
              <button type="button" className="cpf-btn" id="btnCtClientSearch" onClick={handleSearch}>
                <i className="ti ti-search" /> Buscar
              </button>
            </div>
          </div>
          <div className="ct-field">
            <label className="ct-flbl">Canal de entrada <span className="ct-req">*</span></label>
            <div className="ch-grid" id="ctChannelGrid">
              {CHANNELS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  className={'ch-opt' + (channel === ch ? ' on' : '')}
                  data-channel={ch}
                  onClick={() => setChannel(ch)}
                >
                  <i className={'ti ti-' + (ch === 'WhatsApp' ? 'brand-whatsapp' : ch === 'Telefone' ? 'phone' : 'mail')} />
                  <span>{ch}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="ct-field">
            <label className="ct-flbl" htmlFor="ctAssunto">Assunto <span className="ct-req">*</span></label>
            <input
              type="text"
              className="ct-input"
              id="ctAssunto"
              value={assunto}
              onChange={(e) => { setAssunto(e.target.value); if (assuntoError) setAssuntoError(false); }}
              placeholder="Resumo breve do problema ou solicitação"
              style={assuntoError ? { borderColor: '#E24B4A' } : undefined}
            />
          </div>
          <div className="ct-sec-lbl">Classificação</div>
          <div className="f-row2">
            <div className="ct-field">
              <label className="ct-flbl" htmlFor="ctTipo">Tipo</label>
              <select className="ct-select" id="ctTipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option>Reclamação</option><option>Solicitação</option><option>Dúvida</option><option>Elogio</option>
              </select>
            </div>
            <div className="ct-field">
              <label className="ct-flbl" htmlFor="ctProduto">Produto</label>
              <select className="ct-select" id="ctProduto" value={produto} onChange={(e) => setProduto(e.target.value)}>
                <option>Internet Fibra</option><option>TV</option><option>Telefone</option><option>Combo</option>
              </select>
            </div>
          </div>
          <div className="f-row2">
            <div className="ct-field">
              <label className="ct-flbl" htmlFor="ctMotivo">Motivo</label>
              <select className="ct-select" id="ctMotivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                <option>Lentidão</option><option>Queda de sinal</option><option>Sem conexão</option><option>Intermitência</option>
              </select>
            </div>
            <div className="ct-field">
              <label className="ct-flbl" htmlFor="ctAtribuir">Atribuir a</label>
              <select className="ct-select" id="ctAtribuir" value={atribuir} onChange={(e) => setAtribuir(e.target.value)}>
                <option>{agent} (eu)</option><option>Fila geral</option><option>Nível 2</option>
              </select>
            </div>
          </div>
          <div className="ct-field">
            <label className="ct-flbl" htmlFor="ctDescricao">Descrição</label>
            <textarea className="ct-textarea" id="ctDescricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o problema ou solicitação com detalhes…" />
          </div>
        </div>
        <footer className="ct-footer">
          <button type="button" className="ct-btn-cancel" id="btnCreateTicketCancel" onClick={onClose}>Cancelar</button>
          <button type="button" className="ct-btn-save" id="btnCreateTicketSave" onClick={handleSave}>
            <i className="ti ti-device-floppy" /> Salvar
          </button>
        </footer>
      </div>
      <aside className="preview-panel visible" id="createTicketPreview">
        <header className="preview-header">
          <span className="preview-header__title">Prévia do Ticket</span>
          <span className="preview-header__live"><span className="preview-header__dot" />Atualiza em tempo real</span>
        </header>
        <div className="prev-card">
          <div className="prev-card__top">
            <div className="prev-card__id">#AUTO · criado agora por {agent}</div>
            <div className="prev-card-title" id="prevCardTitle">{assunto || 'Sem título'}</div>
            <div className="prev-card__sub" id="prevCardSub">{client?.name || clientSearch || '—'}</div>
          </div>
          <div className="prev-card__body">
            <div className="prev-line"><i className="ti ti-phone" /><span className="prev-tag ch" id="prevTagChannel">{channel}</span></div>
            <div className="prev-line"><i className="ti ti-tag" />
              <span className="prev-tag type" id="prevTagTipo">{tipo}</span>
              <span className="prev-tag prod" id="prevTagProduto">{produto}</span>
              <span className="prev-tag mot" id="prevTagMotivo">{motivo}</span>
            </div>
            <div className="prev-line"><i className="ti ti-user" />Atribuído a <span className="prev-atribuido" id="prevAtribuido">{atribuir}</span></div>
          </div>
          <div className="prev-desc" id="prevDesc">{descricao ? `"${descricao}"` : '""'}</div>
        </div>
      </aside>
    </div>
  );
}
