/**
 * TabulationProdutoEditor v1.2.1 — árvore motivo → detalhe por produto
 * VERSION: v1.2.1 | DATE: 2026-06-25
 */
import React, { useEffect, useState } from 'react';
import { tabulationApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';

function emptyMotivo() {
  return { motivo: '', ordem: 0, ativo: true, detalhes: [{ detalhe: '', ordem: 0, ativo: true }] };
}

export default function TabulationProdutoEditor({ produtoId, onClose, onSaved }) {
  const { showNotification } = useNotifications();
  const [produto, setProduto] = useState('');
  const [ordem, setOrdem] = useState(0);
  const [ativo, setAtivo] = useState(true);
  const [motivos, setMotivos] = useState([emptyMotivo()]);
  const [loading, setLoading] = useState(Boolean(produtoId));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!produtoId) return;
    setLoading(true);
    tabulationApi.getProduto(produtoId)
      .then((data) => {
        setProduto(data.produto || '');
        setOrdem(data.ordem || 0);
        setAtivo(data.ativo !== false);
        setMotivos((data.motivos && data.motivos.length) ? data.motivos : [emptyMotivo()]);
      })
      .catch(() => showNotification('Erro ao carregar produto.', 'error'))
      .finally(() => setLoading(false));
  }, [produtoId, showNotification]);

  const updateMotivo = (index, patch) => {
    setMotivos((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const updateDetalhe = (motivoIndex, detalheIndex, value) => {
    setMotivos((prev) => prev.map((m, mi) => {
      if (mi !== motivoIndex) return m;
      const detalhes = (m.detalhes || []).map((d, di) => (
        di === detalheIndex ? { ...d, detalhe: value } : d
      ));
      return { ...m, detalhes };
    }));
  };

  const addMotivo = () => setMotivos((prev) => [...prev, { ...emptyMotivo(), ordem: prev.length }]);
  const addDetalhe = (motivoIndex) => {
    setMotivos((prev) => prev.map((m, i) => {
      if (i !== motivoIndex) return m;
      const detalhes = [...(m.detalhes || []), { detalhe: '', ordem: (m.detalhes || []).length, ativo: true }];
      return { ...m, detalhes };
    }));
  };

  const save = async () => {
    const payload = {
      produto: produto.trim(),
      ordem: Number(ordem) || 0,
      ativo,
      motivos: motivos
        .filter((m) => m.motivo.trim())
        .map((m, mi) => ({
          ...m,
          ordem: m.ordem ?? mi,
          detalhes: (m.detalhes || []).filter((d) => d.detalhe.trim()).map((d, di) => ({
            ...d,
            ordem: d.ordem ?? di,
          })),
        })),
    };
    if (!payload.produto) {
      showNotification('Informe o nome do produto.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (produtoId) {
        await tabulationApi.updateProduto(produtoId, payload);
      } else {
        await tabulationApi.createProduto(payload);
      }
      showNotification('Produto salvo.', 'success');
      onSaved?.();
      onClose?.();
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Erro ao salvar produto.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="config-section-body">
        <div className="config-loading" role="status">
          <i className="ti ti-loader-2 config-loading__icon" aria-hidden="true" />
          <span>Carregando produto…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="config-section-body config-editor">
      <button type="button" className="forms-editor-back btn-link" onClick={onClose}>
        <i className="ti ti-arrow-left" aria-hidden="true" /> Voltar à lista
      </button>

      <div className="config-subsection config-subsection--product">
        <div className="config-form-grid config-form-grid--product">
          <label className="config-field">
            <span className="config-field__label">Produto</span>
            <input
              type="text"
              className="config-field__input"
              value={produto}
              onChange={(e) => setProduto(e.target.value)}
              placeholder="Ex.: Internet Fibra"
            />
          </label>
          <label className="config-field config-field--ordem">
            <span className="config-field__label">Ordem</span>
            <input
              type="number"
              className="config-field__input config-field__input--narrow"
              value={ordem}
              onChange={(e) => setOrdem(e.target.value)}
              min={0}
            />
          </label>
          <label className="config-field config-field--checkbox config-field--checkbox-inline">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            <span>Ativo no desk</span>
          </label>
        </div>
      </div>

      <div className="config-subsection">
        <div className="config-subsection__head">
          <h5>Motivos e detalhes</h5>
          <button type="button" className="config-action-btn config-action-btn--edit" onClick={addMotivo}>
            Adicionar motivo
          </button>
        </div>

        {motivos.map((motivo, mi) => (
          <div className="tree-config-container config-tree-block" key={mi}>
            <span className="tree-config-label">Motivo {mi + 1}</span>
            <label className="config-field">
              <span className="config-field__label">Nome do motivo</span>
              <input
                type="text"
                className="config-field__input"
                value={motivo.motivo}
                onChange={(e) => updateMotivo(mi, { motivo: e.target.value })}
                placeholder="Ex.: Lentidão"
              />
            </label>

            <div className="config-tree-block__children">
              {(motivo.detalhes || []).map((detalhe, di) => (
                <label key={di} className="config-field config-tree-block__child">
                  <span className="config-field__label">Detalhe {di + 1}</span>
                  <input
                    type="text"
                    className="config-field__input"
                    value={detalhe.detalhe}
                    onChange={(e) => updateDetalhe(mi, di, e.target.value)}
                    placeholder="Ex.: Horário de pico"
                  />
                </label>
              ))}
              <button type="button" className="config-action-btn config-action-btn--edit config-tree-block__add" onClick={() => addDetalhe(mi)}>
                Adicionar detalhe
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="config-panel-actions forms-editor-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn-primary btn-forms-primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar produto'}
        </button>
      </div>
    </div>
  );
}
