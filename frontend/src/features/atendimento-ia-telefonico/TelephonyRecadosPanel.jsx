/**
 * TelephonyRecadosPanel v1.0.0 — CRUD de recados emergenciais
 */
import React, { useCallback, useEffect, useState } from 'react';
import { telephonyApi } from '../../api/client';
import { useNotifications } from '../../context/NotificationContext';

const PRIORIDADES = [
  { id: 'alta', label: 'Alta' },
  { id: 'media', label: 'Média' },
  { id: 'baixa', label: 'Baixa' },
];

export default function TelephonyRecadosPanel() {
  const { showNotification } = useNotifications();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ titulo: '', mensagem: '', prioridade: 'alta' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await telephonyApi.listRecados();
      setItems(data?.items || []);
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Erro ao carregar recados.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.mensagem.trim()) {
      showNotification('Informe título e mensagem.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await telephonyApi.createRecado(form);
      setForm({ titulo: '', mensagem: '', prioridade: 'alta' });
      showNotification('Recado criado.', 'success');
      await load();
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Não foi possível salvar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (item) => {
    try {
      await telephonyApi.patchRecado(item.id, { ativo: !item.ativo });
      await load();
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Erro ao atualizar recado.', 'error');
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Remover o recado "${item.titulo}"?`)) return;
    try {
      await telephonyApi.removeRecado(item.id);
      showNotification('Recado removido.', 'success');
      await load();
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Erro ao remover recado.', 'error');
    }
  };

  return (
    <div className="telephony-recados">
      <p className="telephony-recados__hint">
        A IA telefônica consulta os recados <strong>ativos</strong> antes de cada ligação via
        {' '}<code>GET /api/inbound/telephony/recados</code>.
      </p>

      <form className="telephony-recados__form" onSubmit={handleCreate}>
        <label>
          <span>Título</span>
          <input
            type="text"
            value={form.titulo}
            onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
            placeholder="Ex.: Envio de PIX com intermitência"
          />
        </label>
        <label>
          <span>Mensagem para a IA</span>
          <textarea
            rows={3}
            value={form.mensagem}
            onChange={(e) => setForm((prev) => ({ ...prev, mensagem: e.target.value }))}
            placeholder="Orientação objetiva para o atendimento..."
          />
        </label>
        <label>
          <span>Prioridade</span>
          <select
            value={form.prioridade}
            onChange={(e) => setForm((prev) => ({ ...prev, prioridade: e.target.value }))}
          >
            {PRIORIDADES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Salvando…' : 'Adicionar recado'}
        </button>
      </form>

      {loading ? <p className="telephony-loading">Carregando recados…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="telephony-empty">Nenhum recado cadastrado.</p>
      ) : null}

      <div className="telephony-recados__list">
        {items.map((item) => (
          <article key={item.id} className={'telephony-recados__item' + (item.ativo ? ' is-active' : '')}>
            <div>
              <div className="telephony-recados__top">
                <strong>{item.titulo}</strong>
                <span className={'telephony-recados__badge is-' + item.prioridade}>{item.prioridade}</span>
                <span className={'telephony-recados__status' + (item.ativo ? ' is-on' : '')}>
                  {item.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p>{item.mensagem}</p>
            </div>
            <div className="telephony-recados__actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleAtivo(item)}>
                {item.ativo ? 'Desativar' : 'Ativar'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(item)}>
                Excluir
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
