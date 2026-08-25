/**
 * RaClassificacaoFields v1.1.0 — produto da árvore + motivo do órgão (API)
 * VERSION: v1.1.0 | DATE: 2026-08-21
 */
import React, { useEffect, useState } from 'react';
import { reclamacoesApi, tabulationApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import { useTabulation } from '../../../context/TabulationContext';
import { TABULACAO_OPCOES_CATEGORIAS } from '../../../services/tabulationConfig';
import { RA_MOTIVOS } from '../../../services/especiais/reclameAquiData';
import { patchReclamacao } from '../../../services/especiais/reclameAquiStore';

export default function RaClassificacaoFields({ raItem, onSaved }) {
  const { showNotification } = useNotifications();
  const { getProdutoNames } = useTabulation();
  const [saving, setSaving] = useState(false);
  const [motivos, setMotivos] = useState(RA_MOTIVOS);
  const produtoOptions = getProdutoNames();

  useEffect(() => {
    let cancelled = false;
    tabulationApi.getOpcoes(TABULACAO_OPCOES_CATEGORIAS.MOTIVO_RECLAME_AQUI, false)
      .then((doc) => {
        if (cancelled) return;
        const list = (doc?.opcoes || [])
          .filter((item) => item.ativo !== false)
          .map((item) => item.valor)
          .filter(Boolean);
        if (list.length) setMotivos(list);
      })
      .catch(() => { /* fallback RA_MOTIVOS */ });
    return () => { cancelled = true; };
  }, []);

  if (!raItem) return null;

  const handleFieldChange = async (field, value) => {
    if (!raItem?.id || saving) return;
    setSaving(true);
    try {
      const updated = await reclamacoesApi.patch('reclame-aqui', raItem.id, { [field]: value });
      const merged = { ...raItem, ...updated };
      // Grava no store local antes do reload disparado por onSaved — sem isso, o reload
      // relê o item obsoleto do cache e zera o produto/motivo recém-selecionado.
      patchReclamacao(merged);
      onSaved?.(merged);
      showNotification('Classificação atualizada.', 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Não foi possível atualizar a classificação.';
      showNotification(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const produtos = produtoOptions.length ? produtoOptions : [];
  const motivoList = motivos.length ? motivos : RA_MOTIVOS;

  return (
    <section className="ra-ticket__side-card">
      <label htmlFor="ra-classificacao-produto">Produto</label>
      <select
        id="ra-classificacao-produto"
        className="ra-registro__select"
        value={raItem.produto || ''}
        onChange={(e) => handleFieldChange('produto', e.target.value)}
        disabled={saving}
      >
        <option value="">Selecionar</option>
        {produtos.map((produto) => (
          <option key={produto} value={produto}>{produto}</option>
        ))}
        {raItem.produto && !produtos.includes(raItem.produto) ? (
          <option value={raItem.produto}>{raItem.produto}</option>
        ) : null}
      </select>

      <label htmlFor="ra-classificacao-motivo">Motivo</label>
      <select
        id="ra-classificacao-motivo"
        className="ra-registro__select"
        value={raItem.motivo || ''}
        onChange={(e) => handleFieldChange('motivo', e.target.value)}
        disabled={saving}
      >
        <option value="">Selecionar</option>
        {motivoList.map((motivo) => (
          <option key={motivo} value={motivo}>{motivo}</option>
        ))}
        {raItem.motivo && !motivoList.includes(raItem.motivo) ? (
          <option value={raItem.motivo}>{raItem.motivo}</option>
        ) : null}
      </select>
    </section>
  );
}
