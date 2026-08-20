/**
 * RaClassificacaoFields — reclassifica rapidamente Produto e Motivo do ticket RA
 */
import React, { useState } from 'react';
import { reclamacoesApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import { RA_CLASSIFICACAO_PRODUTOS, RA_MOTIVOS } from '../../../services/especiais/reclameAquiData';

export default function RaClassificacaoFields({ raItem, onSaved }) {
  const { showNotification } = useNotifications();
  const [saving, setSaving] = useState(false);

  if (!raItem) return null;

  const handleFieldChange = async (field, value) => {
    if (!raItem?.id || saving) return;
    setSaving(true);
    try {
      const updated = await reclamacoesApi.patch('reclame-aqui', raItem.id, { [field]: value });
      onSaved?.({ ...raItem, ...updated });
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
      <label htmlFor="ra-classificacao-produto">Produto</label>
      <select
        id="ra-classificacao-produto"
        className="ra-registro__select"
        value={raItem.produto || ''}
        onChange={(e) => handleFieldChange('produto', e.target.value)}
        disabled={saving}
      >
        <option value="">Selecionar</option>
        {RA_CLASSIFICACAO_PRODUTOS.map((produto) => (
          <option key={produto} value={produto}>{produto}</option>
        ))}
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
        {RA_MOTIVOS.map((motivo) => (
          <option key={motivo} value={motivo}>{motivo}</option>
        ))}
      </select>
    </section>
  );
}
