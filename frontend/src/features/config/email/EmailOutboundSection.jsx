/**
 * EmailOutboundSection v1.1.0 — avisa o hub quando o editor está aberto
 * VERSION: v1.1.0 | DATE: 2026-08-20
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { emailOutboundApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import EmailOutboundEditor from './EmailOutboundEditor';

/** Layout dedicado (estrelas de CSAT) — sempre segregados ao final da lista, nunca
 * misturados com os e-mails de template genérico. Ver EmailOutboundEditor.jsx. */
const CSAT_TEMPLATE_NAMES = ['Encerramento mais satisfação', 'Repescagem da satisfação'];

function gatilhoLabel(item) {
  const criterios = item?.gatilho?.criterios || [];
  if (!criterios.length) return 'Sem gatilho';
  if (criterios.some((row) => row.tipo === 'gatilho_interno')) return 'Gatilho interno';
  return criterios.map((row) => {
    const valores = (row.valores || []).join(', ');
    return `${row.tipo}${valores ? `: ${valores}` : ''}`;
  }).join(' · ');
}

export default function EmailOutboundSection({ onNestedViewChange }) {
  const { showNotification } = useNotifications();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const nestedOpen = Boolean(creating || editingId);

  useEffect(() => {
    onNestedViewChange?.(nestedOpen);
    return () => onNestedViewChange?.(false);
  }, [nestedOpen, onNestedViewChange]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await emailOutboundApi.listConteudos();
      setItems(data?.items || []);
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Erro ao carregar e-mails de saída.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (item) => {
    if (!window.confirm(`Excluir o e-mail “${item.nome}”?`)) return;
    try {
      await emailOutboundApi.removeConteudo(item.id);
      showNotification('E-mail excluído.', 'success');
      await load();
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Não foi possível excluir.', 'error');
    }
  };

  const regularItems = useMemo(
    () => items.filter((item) => !CSAT_TEMPLATE_NAMES.includes(item.nome)),
    [items],
  );
  const csatItems = useMemo(
    () => items.filter((item) => CSAT_TEMPLATE_NAMES.includes(item.nome)),
    [items],
  );

  const handleToggle = async (item) => {
    try {
      await emailOutboundApi.updateConteudo(item.id, { ativo: !item.ativo });
      await load();
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Erro ao atualizar.', 'error');
    }
  };

  if (creating || editingId) {
    return (
      <EmailOutboundEditor
        itemId={creating ? null : editingId}
        items={items}
        onClose={() => {
          setCreating(false);
          setEditingId(null);
        }}
        onSaved={async () => {
          setCreating(false);
          setEditingId(null);
          await load();
        }}
      />
    );
  }

  return (
    <div className="config-email-outbound">
      <div className="config-email-outbound__head">
        <p className="config-placeholder-msg">Textos e gatilhos dos e-mails enviados ao cliente. Crie, edite ou desative sem alterar o código.</p>
        <button type="button" className="config-action-btn config-action-btn--create" onClick={() => setCreating(true)}>
          Novo e-mail de saída
        </button>
      </div>

      {loading ? (
        <p className="config-placeholder-msg">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="config-placeholder-msg">Nenhum e-mail cadastrado.</p>
      ) : (
        <table className="config-email-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Gatilho</th>
              <th>Ativo</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {regularItems.map((item) => (
              <tr key={item.id}>
                <td>{item.nome}</td>
                <td>{gatilhoLabel(item)}</td>
                <td>
                  <button
                    type="button"
                    className={'config-email-toggle' + (item.ativo ? ' is-on' : '')}
                    onClick={() => handleToggle(item)}
                  >
                    {item.ativo ? 'Sim' : 'Não'}
                  </button>
                </td>
                <td>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(item.id)}>
                    Editar
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(item)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {csatItems.length ? (
              <tr className="config-email-table__divider">
                <td colSpan={4}>Pesquisa de satisfação (CSAT) — layout dedicado, com estrelas</td>
              </tr>
            ) : null}
            {csatItems.map((item) => (
              <tr key={item.id}>
                <td>{item.nome}</td>
                <td>{gatilhoLabel(item)}</td>
                <td>
                  <button
                    type="button"
                    className={'config-email-toggle' + (item.ativo ? ' is-on' : '')}
                    onClick={() => handleToggle(item)}
                  >
                    {item.ativo ? 'Sim' : 'Não'}
                  </button>
                </td>
                <td>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(item.id)}>
                    Editar
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(item)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
