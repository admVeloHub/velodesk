/**
 * CgClassificacaoFields — reclassifica rapidamente Produto e Motivo do ticket Consumidor.Gov
 */
import React, { useState } from 'react';
import { reclamacoesApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import { CG_CLASSIFICACAO_PRODUTOS, CG_MOTIVOS } from '../../../services/especiais/consumidorGovData';

export default function CgClassificacaoFields({ cgItem, onSaved }) {
  const { showNotification } = useNotifications();
  const [saving, setSaving] = useState(false);

  if (!cgItem) return null;

  const handleFieldChange = async (field, value) => {
    if (!cgItem?.id || saving) return;
    setSaving(true);
    try {
      const updated = await reclamacoesApi.patch('consumidor-gov', cgItem.id, { [field]: value });
      onSaved?.({ ...cgItem, ...updated });
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
      <label htmlFor="cg-classificacao-produto">Produto</label>
      <select
        id="cg-classificacao-produto"
        className="ra-registro__select"
        value={cgItem.produto || ''}
        onChange={(e) => handleFieldChange('produto', e.target.value)}
        disabled={saving}
      >
        <option value="">Selecionar</option>
        {CG_CLASSIFICACAO_PRODUTOS.map((produto) => (
          <option key={produto} value={produto}>{produto}</option>
        ))}
      </select>

      <label htmlFor="cg-classificacao-motivo">Motivo</label>
      <select
        id="cg-classificacao-motivo"
        className="ra-registro__select"
        value={cgItem.motivo || ''}
        onChange={(e) => handleFieldChange('motivo', e.target.value)}
        disabled={saving}
      >
        <option value="">Selecionar</option>
        {CG_MOTIVOS.map((motivo) => (
          <option key={motivo} value={motivo}>{motivo}</option>
        ))}
      </select>
    </section>
  );
}
