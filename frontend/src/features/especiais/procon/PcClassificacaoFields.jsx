/**
 * PcClassificacaoFields v1.1.0 — produto da árvore + motivo do órgão (API)
 * VERSION: v1.1.0 | DATE: 2026-08-21
 */
import React, { useEffect, useState } from 'react';
import { reclamacoesApi, tabulationApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import { useTabulation } from '../../../context/TabulationContext';
import { TABULACAO_OPCOES_CATEGORIAS } from '../../../services/tabulationConfig';
import { PC_MOTIVOS } from '../../../services/especiais/proconData';
import { patchDemanda } from '../../../services/especiais/proconStore';

export default function PcClassificacaoFields({ pcItem, onSaved }) {
  const { showNotification } = useNotifications();
  const { getProdutoNames } = useTabulation();
  const [saving, setSaving] = useState(false);
  const [motivos, setMotivos] = useState(PC_MOTIVOS);
  const produtoOptions = getProdutoNames();

  useEffect(() => {
    let cancelled = false;
    tabulationApi.getOpcoes(TABULACAO_OPCOES_CATEGORIAS.MOTIVO_PROCON, false)
      .then((doc) => {
        if (cancelled) return;
        const list = (doc?.opcoes || [])
          .filter((item) => item.ativo !== false)
          .map((item) => item.valor)
          .filter(Boolean);
        if (list.length) setMotivos(list);
      })
      .catch(() => { /* fallback PC_MOTIVOS */ });
    return () => { cancelled = true; };
  }, []);

  if (!pcItem) return null;

  const handleFieldChange = async (field, value) => {
    if (!pcItem?.id || saving) return;
    setSaving(true);
    try {
      const updated = await reclamacoesApi.patch('procon', pcItem.id, { [field]: value });
      const merged = { ...pcItem, ...updated };
      // Grava no store local antes do reload disparado por onSaved — sem isso, o reload
      // relê o item obsoleto do cache e zera o produto/motivo recém-selecionado.
      patchDemanda(merged);
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
  const motivoList = motivos.length ? motivos : PC_MOTIVOS;

  return (
    <section className="ra-ticket__side-card">
      <label htmlFor="pc-classificacao-produto">Produto</label>
      <select
        id="pc-classificacao-produto"
        className="ra-registro__select"
        value={pcItem.produto || ''}
        onChange={(e) => handleFieldChange('produto', e.target.value)}
        disabled={saving}
      >
        <option value="">Selecionar</option>
        {produtos.map((produto) => (
          <option key={produto} value={produto}>{produto}</option>
        ))}
        {pcItem.produto && !produtos.includes(pcItem.produto) ? (
          <option value={pcItem.produto}>{pcItem.produto}</option>
        ) : null}
      </select>

      <label htmlFor="pc-classificacao-motivo">Motivo</label>
      <select
        id="pc-classificacao-motivo"
        className="ra-registro__select"
        value={pcItem.motivo || ''}
        onChange={(e) => handleFieldChange('motivo', e.target.value)}
        disabled={saving}
      >
        <option value="">Selecionar</option>
        {motivoList.map((motivo) => (
          <option key={motivo} value={motivo}>{motivo}</option>
        ))}
        {pcItem.motivo && !motivoList.includes(pcItem.motivo) ? (
          <option value={pcItem.motivo}>{pcItem.motivo}</option>
        ) : null}
      </select>
    </section>
  );
}
