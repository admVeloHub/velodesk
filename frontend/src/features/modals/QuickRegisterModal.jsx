/**
 * Modal registro rápido
 * VERSION: v1.1.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team
 */
import React, { useState } from 'react';
import { createTicketViaApi } from '../../services/ticketsCache';
import { buildCreatePayload } from '../../api/adapters/ticketAdapter';
import { useNotifications } from '../../context/NotificationContext';
import { useTickets } from '../../context/TicketsContext';

export default function QuickRegisterModal({ open, onClose }) {
  const { showNotification } = useNotifications();
  const { refreshTickets } = useTickets();
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = buildCreatePayload({
        assunto: title,
        descricao: title,
        channel: 'WhatsApp',
        clientName: client || 'Cliente',
      });
      await createTicketViaApi(payload);
      await refreshTickets();
      showNotification('Ticket criado via registro rápido.', 'success');
      setTitle('');
      setClient('');
      onClose();
    } catch {
      showNotification('Erro ao criar ticket.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal" style={{ display: 'flex' }}>
      <div className="modal-content">
        <div className="modal-header">
          <h3><i className="fas fa-bolt" /> Registro rápido</h3>
          <button type="button" className="close-btn" onClick={onClose}><i className="fas fa-times" /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Cliente</label>
            <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nome do cliente" />
          </div>
          <div className="form-group">
            <label>Assunto</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resumo do atendimento" />
          </div>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Criando...' : 'Criar ticket com IA'}
          </button>
        </div>
      </div>
    </div>
  );
}
