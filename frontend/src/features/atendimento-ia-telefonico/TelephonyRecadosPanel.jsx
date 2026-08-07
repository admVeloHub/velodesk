/**
 * TelephonyRecadosPanel v2.0.0 — CRUD de recados operacionais v2
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { telephonyApi } from '../../api/client';
import { useNotifications } from '../../context/NotificationContext';
import {
  EMPTY_RECADO_FORM,
  RECADO_AREAS,
  RECADO_POLITICAS,
  RECADO_PRIORIDADES,
  RECADO_TIPOS,
  areaLabel,
  politicaLabel,
  tipoLabel,
} from './telephonyRecadoConstants';

function phonesToText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join('\n');
  return String(value);
}

function phonesFromText(text) {
  const lines = String(text ?? '')
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines : null;
}

function itemToForm(item) {
  return {
    titulo: item.titulo || '',
    areas: item.areas || [],
    tipo: item.tipo || 'instabilidade',
    mensagemCliente: item.mensagemCliente || item.mensagem || '',
    orientacaoAtendimento: item.orientacaoAtendimento || '',
    politicaChamado: item.politicaChamado || 'fluxo_normal',
    criterioChamado: item.criterioChamado || '',
    prioridade: item.prioridade || 'media',
    telefonesOrigemLiberados: phonesToText(item.telefonesOrigemLiberados),
  };
}

function formToPayload(form, ativo = true) {
  return {
    titulo: form.titulo.trim(),
    areas: form.areas,
    tipo: form.tipo,
    mensagemCliente: form.mensagemCliente.trim(),
    orientacaoAtendimento: form.orientacaoAtendimento.trim(),
    politicaChamado: form.politicaChamado,
    criterioChamado: form.politicaChamado === 'abrir_se_persistir'
      ? form.criterioChamado.trim()
      : null,
    prioridade: form.prioridade,
    telefonesOrigemLiberados: phonesFromText(form.telefonesOrigemLiberados),
    ativo,
  };
}

export default function TelephonyRecadosPanel() {
  const { showNotification } = useNotifications();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_RECADO_FORM);
  const [editingId, setEditingId] = useState(null);

  const previewPayload = useMemo(() => {
    try {
      const payload = formToPayload(form);
      return JSON.stringify({
        schemaVersion: '2.0',
        items: [{
          id: 'exemplo-id',
          ...payload,
          criterioChamado: payload.criterioChamado,
          updatedAt: new Date().toISOString(),
        }],
      }, null, 2);
    } catch {
      return '';
    }
  }, [form]);

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

  const toggleArea = (areaId) => {
    setForm((prev) => {
      const exists = prev.areas.includes(areaId);
      if (exists) return { ...prev, areas: prev.areas.filter((id) => id !== areaId) };
      if (prev.areas.length >= 5) {
        showNotification('Selecione no máximo 5 áreas.', 'warning');
        return prev;
      }
      return { ...prev, areas: [...prev.areas, areaId] };
    });
  };

  const resetForm = () => {
    setForm(EMPTY_RECADO_FORM);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.areas.length) {
      showNotification('Informe título e ao menos uma área.', 'warning');
      return;
    }
    if (!form.mensagemCliente.trim() || !form.orientacaoAtendimento.trim()) {
      showNotification('Informe mensagem ao cliente e orientação de atendimento.', 'warning');
      return;
    }
    if (form.politicaChamado === 'abrir_se_persistir' && !form.criterioChamado.trim()) {
      showNotification('Informe o critério para abertura de chamado.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = formToPayload(form, true);
      if (editingId) {
        await telephonyApi.patchRecado(editingId, payload);
        showNotification('Recado atualizado.', 'success');
      } else {
        await telephonyApi.createRecado(payload);
        showNotification('Recado criado.', 'success');
      }
      resetForm();
      await load();
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Não foi possível salvar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm(itemToForm(item));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleAtivo = async (item) => {
    try {
      await telephonyApi.patchRecado(item.id, formToPayload(itemToForm(item), !item.ativo));
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
      if (editingId === item.id) resetForm();
      await load();
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Erro ao remover recado.', 'error');
    }
  };

  return (
    <div className="telephony-recados">
      <p className="telephony-recados__hint">
        A LetícIA consulta recados <strong>ativos</strong> antes de cada ligação via
        {' '}<code>GET /api/inbound/telephony/recados</code> no contrato
        {' '}<strong>schemaVersion 2.0</strong>. A filtragem por telefone de origem é feita pela Contact-Tel.
      </p>

      <form className="telephony-recados__form telephony-recados__form--v2" onSubmit={handleSubmit}>
        <div className="telephony-recados__form-head">
          <h3>{editingId ? 'Editar recado' : 'Novo recado operacional'}</h3>
          {editingId ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetForm}>
              Cancelar edição
            </button>
          ) : null}
        </div>

        <label className="telephony-recados__field--wide">
          <span>Título administrativo</span>
          <input
            type="text"
            maxLength={120}
            value={form.titulo}
            onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
            placeholder="Ex.: Instabilidade no Pix recebido"
          />
        </label>

        <fieldset className="telephony-recados__areas telephony-recados__field--wide">
          <legend>Áreas afetadas (até 5)</legend>
          <div className="telephony-recados__area-grid">
            {RECADO_AREAS.map((area) => (
              <label key={area.id} className="telephony-recados__area-chip">
                <input
                  type="checkbox"
                  checked={form.areas.includes(area.id)}
                  onChange={() => toggleArea(area.id)}
                />
                <span>{area.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label>
          <span>Tipo da ocorrência</span>
          <select value={form.tipo} onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value }))}>
            {RECADO_TIPOS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Prioridade</span>
          <select
            value={form.prioridade}
            onChange={(e) => setForm((prev) => ({ ...prev, prioridade: e.target.value }))}
          >
            {RECADO_PRIORIDADES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Política de chamado</span>
          <select
            value={form.politicaChamado}
            onChange={(e) => setForm((prev) => ({ ...prev, politicaChamado: e.target.value }))}
          >
            {RECADO_POLITICAS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>

        <label className="telephony-recados__field--wide">
          <span>Mensagem ao cliente (fala aprovada, até 500 caracteres)</span>
          <textarea
            rows={3}
            maxLength={500}
            value={form.mensagemCliente}
            onChange={(e) => setForm((prev) => ({ ...prev, mensagemCliente: e.target.value }))}
            placeholder="Texto que a LetícIA pode falar ao cliente..."
          />
        </label>

        <label className="telephony-recados__field--wide">
          <span>Orientação de atendimento (até 500 caracteres)</span>
          <textarea
            rows={3}
            maxLength={500}
            value={form.orientacaoAtendimento}
            onChange={(e) => setForm((prev) => ({ ...prev, orientacaoAtendimento: e.target.value }))}
            placeholder="Quando aplicar este recado e o que a agente deve fazer..."
          />
        </label>

        {form.politicaChamado === 'abrir_se_persistir' ? (
          <label className="telephony-recados__field--wide">
            <span>Critério para abertura de chamado</span>
            <textarea
              rows={2}
              maxLength={500}
              value={form.criterioChamado}
              onChange={(e) => setForm((prev) => ({ ...prev, criterioChamado: e.target.value }))}
              placeholder="Ex.: Abra chamado somente se o cliente confirmar que..."
            />
          </label>
        ) : null}

        <label className="telephony-recados__field--wide">
          <span>Telefones de homologação (opcional — um por linha; vazio = publicação geral)</span>
          <textarea
            rows={2}
            value={form.telefonesOrigemLiberados}
            onChange={(e) => setForm((prev) => ({ ...prev, telefonesOrigemLiberados: e.target.value }))}
            placeholder="+5511999999999"
          />
        </label>

        <div className="telephony-recados__form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Publicar recado'}
          </button>
        </div>

        {previewPayload ? (
          <details className="telephony-recados__preview telephony-recados__field--wide">
            <summary>Pré-visualizar JSON publicado</summary>
            <pre>{previewPayload}</pre>
          </details>
        ) : null}
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
                <span className="telephony-recados__badge">{tipoLabel(item.tipo)}</span>
                <span className={'telephony-recados__status' + (item.ativo ? ' is-on' : '')}>
                  {item.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p className="telephony-recados__meta">
                <code>{item.recadoId || item.id}</code>
                {' · '}
                {politicaLabel(item.politicaChamado)}
                {item.telefonesOrigemLiberados?.length
                  ? ` · Homologação: ${item.telefonesOrigemLiberados.length} telefone(s)`
                  : ' · Publicação geral'}
              </p>
              <p className="telephony-recados__areas-list">
                {(item.areas || []).map((area) => areaLabel(area)).join(' · ')}
              </p>
              <p><strong>Cliente:</strong> {item.mensagemCliente || item.mensagem || '—'}</p>
              <p><strong>Orientação:</strong> {item.orientacaoAtendimento || '—'}</p>
            </div>
            <div className="telephony-recados__actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(item)}>
                Editar
              </button>
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
