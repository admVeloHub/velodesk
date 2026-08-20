/**
 * BcClassificacaoFields — reclassifica rapidamente Produto e Motivo do ticket Bacen
 */
import React, { useState } from 'react';
import { reclamacoesApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import { BC_CLASSIFICACAO_PRODUTOS, BC_MOTIVOS } from '../../../services/especiais/bacenData';

export default function BcClassificacaoFields({ bcItem, onSaved }) {
  const { showNotification } = useNotifications();
  const [saving, setSaving] = useState(false);

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
        {BC_CLASSIFICACAO_PRODUTOS.map((produto) => (
          <option key={produto} value={produto}>{produto}</option>
        ))}
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
        {BC_MOTIVOS.map((motivo) => (
          <option key={motivo} value={motivo}>{motivo}</option>
        ))}
      </select>
    </section>
  );
}
