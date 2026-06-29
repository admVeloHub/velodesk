/**
 * Formulário lateral de ticket
 * VERSION: v2.1.0 | DATE: 2026-06-18
 */
import React, { useState } from 'react';
import { updateTicketInKanban } from '../../services/kanbanStorage';
import { useNotifications } from '../../context/NotificationContext';
import { usersApi } from '../../api/client';

export default function TicketLateralForm({ ticket, onClose }) {
  const { showNotification } = useNotifications();
  const lf = ticket?.lateralForm || {};
  const [form, setForm] = useState({
    canal: lf.canal || ticket?.channel || 'WhatsApp',
    classificacaoTipo: lf.classificacaoTipo || 'Solicitação',
    produto: lf.produto || 'Internet Fibra',
    motivo: lf.motivo || 'Em análise',
    responsavel: lf.responsavel || ticket?.responsibleAgent || 'Ana Silva',
  });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    usersApi.list().catch(() => {});
  }, []);

  if (!ticket) return null;

  const save = async () => {
    setSaving(true);
    try {
      await updateTicketInKanban(ticket.id, (t) => {
        t.lateralForm = { ...t.lateralForm, ...form };
        t.updatedAt = new Date().toISOString();
        return t;
      });
      showNotification('Ticket atualizado.', 'success');
      onClose();
    } catch {
      showNotification('Erro ao atualizar ticket.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="ticket-lateral-form" style={{ position: 'fixed', right: 0, top: 64, width: 360, height: 'calc(100vh - 64px)', background: '#fff', boxShadow: '-4px 0 12px rgba(0,0,0,.1)', padding: 16, zIndex: 800, overflow: 'auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3>Ticket #{ticket.id}</h3>
        <button type="button" onClick={onClose}>×</button>
      </header>
      <p><strong>{ticket.clientName}</strong></p>
      <p style={{ fontSize: 13, color: '#64748b' }}>{ticket.title}</p>
      {[
        ['canal', 'Canal'],
        ['classificacaoTipo', 'Tipo'],
        ['produto', 'Produto'],
        ['motivo', 'Motivo'],
        ['responsavel', 'Responsável']
      ].map(([key, label]) => (
        <div key={key} className="form-group" style={{ marginTop: 12 }}>
          <label>{label}</label>
          <input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
        </div>
      ))}
      <button type="button" className="btn-primary" style={{ marginTop: 16 }} onClick={save} disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </aside>
  );
}
