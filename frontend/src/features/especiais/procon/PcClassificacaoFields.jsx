/**
 * PcClassificacaoFields — reclassifica rapidamente Produto e Motivo do ticket Procon
 */
import React, { useState } from 'react';
import { reclamacoesApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import { PC_CLASSIFICACAO_PRODUTOS, PC_MOTIVOS } from '../../../services/especiais/proconData';

export default function PcClassificacaoFields({ pcItem, onSaved }) {
  const { showNotification } = useNotifications();
  const [saving, setSaving] = useState(false);

  if (!pcItem) return null;

  const handleFieldChange = async (field, value) => {
    if (!pcItem?.id || saving) return;
    setSaving(true);
    try {
      const updated = await reclamacoesApi.patch('procon', pcItem.id, { [field]: value });
      onSaved?.({ ...pcItem, ...updated });
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
      <label htmlFor="pc-classificacao-produto">Produto</label>
      <select
        id="pc-classificacao-produto"
        className="ra-registro__select"
        value={pcItem.produto || ''}
        onChange={(e) => handleFieldChange('produto', e.target.value)}
        disabled={saving}
      >
        <option value="">Selecionar</option>
        {PC_CLASSIFICACAO_PRODUTOS.map((produto) => (
          <option key={produto} value={produto}>{produto}</option>
        ))}
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
        {PC_MOTIVOS.map((motivo) => (
          <option key={motivo} value={motivo}>{motivo}</option>
        ))}
      </select>
    </section>
  );
}
