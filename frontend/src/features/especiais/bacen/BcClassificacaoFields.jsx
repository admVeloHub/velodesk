/**
 * BcClassificacaoFields v1.1.0 — produto da árvore + motivo do órgão (API)
 * VERSION: v1.1.0 | DATE: 2026-08-21
 */
import React, { useEffect, useState } from 'react';
import { reclamacoesApi, tabulationApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import { useTabulation } from '../../../context/TabulationContext';
import { TABULACAO_OPCOES_CATEGORIAS } from '../../../services/tabulationConfig';
import { BC_MOTIVOS } from '../../../services/especiais/bacenData';

export default function BcClassificacaoFields({ bcItem, onSaved }) {
  const { showNotification } = useNotifications();
  const { getProdutoNames } = useTabulation();
  const [saving, setSaving] = useState(false);
  const [motivos, setMotivos] = useState(BC_MOTIVOS);
  const produtoOptions = getProdutoNames();

  useEffect(() => {
    let cancelled = false;
    tabulationApi.getOpcoes(TABULACAO_OPCOES_CATEGORIAS.MOTIVO_BACEN, false)
      .then((doc) => {
        if (cancelled) return;
        const list = (doc?.opcoes || [])
          .filter((item) => item.ativo !== false)
          .map((item) => item.valor)
          .filter(Boolean);
        if (list.length) setMotivos(list);
      })
      .catch(() => { /* fallback BC_MOTIVOS */ });
    return () => { cancelled = true; };
  }, []);

  if (!bcItem) return null;

  const handleFieldChange = async (field, value) => {
    if (!bcItem?.id || saving) return;
    setSaving(true);
    try {
      const updated = await reclamacoesApi.patch('bacen', bcItem.id, { [field]: value });
      onSaved?.({ ...bcItem, ...updated });
      showNotification('Classificação atualizada.', 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Não foi possível atualizar a classificação.';
      showNotification(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const produtos = produtoOptions.length ? produtoOptions : [];
  const motivoList = motivos.length ? motivos : BC_MOTIVOS;

  return (
    <section className="ra-ticket__side-card">
      <label htmlFor="bc-classificacao-produto">Produto</label>
      <select
        id="bc-classificacao-produto"
        className="ra-registro__select"
        value={bcItem.produto || ''}
        onChange={(e) => handleFieldChange('produto', e.target.value)}
        disabled={saving}
      >
        <option value="">Selecionar</option>
        {produtos.map((produto) => (
          <option key={produto} value={produto}>{produto}</option>
        ))}
        {bcItem.produto && !produtos.includes(bcItem.produto) ? (
          <option value={bcItem.produto}>{bcItem.produto}</option>
        ) : null}
      </select>

      <label htmlFor="bc-classificacao-motivo">Motivo</label>
      <select
        id="bc-classificacao-motivo"
        className="ra-registro__select"
        value={bcItem.motivo || ''}
        onChange={(e) => handleFieldChange('motivo', e.target.value)}
        disabled={saving}
      >
        <option value="">Selecionar</option>
        {motivoList.map((motivo) => (
          <option key={motivo} value={motivo}>{motivo}</option>
        ))}
        {bcItem.motivo && !motivoList.includes(bcItem.motivo) ? (
          <option value={bcItem.motivo}>{bcItem.motivo}</option>
        ) : null}
      </select>
    </section>
  );
}
