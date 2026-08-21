/**
 * CgClassificacaoFields v1.1.0 — produto da árvore + motivo do órgão (API)
 * VERSION: v1.1.0 | DATE: 2026-08-21
 */
import React, { useEffect, useState } from 'react';
import { reclamacoesApi, tabulationApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import { useTabulation } from '../../../context/TabulationContext';
import { TABULACAO_OPCOES_CATEGORIAS } from '../../../services/tabulationConfig';
import { CG_MOTIVOS } from '../../../services/especiais/consumidorGovData';

export default function CgClassificacaoFields({ cgItem, onSaved }) {
  const { showNotification } = useNotifications();
  const { getProdutoNames } = useTabulation();
  const [saving, setSaving] = useState(false);
  const [motivos, setMotivos] = useState(CG_MOTIVOS);
  const produtoOptions = getProdutoNames();

  useEffect(() => {
    let cancelled = false;
    tabulationApi.getOpcoes(TABULACAO_OPCOES_CATEGORIAS.MOTIVO_CONSUMIDOR_GOV, false)
      .then((doc) => {
        if (cancelled) return;
        const list = (doc?.opcoes || [])
          .filter((item) => item.ativo !== false)
          .map((item) => item.valor)
          .filter(Boolean);
        if (list.length) setMotivos(list);
      })
      .catch(() => { /* fallback CG_MOTIVOS */ });
    return () => { cancelled = true; };
  }, []);

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

  const produtos = produtoOptions.length ? produtoOptions : [];
  const motivoList = motivos.length ? motivos : CG_MOTIVOS;

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
        {produtos.map((produto) => (
          <option key={produto} value={produto}>{produto}</option>
        ))}
        {cgItem.produto && !produtos.includes(cgItem.produto) ? (
          <option value={cgItem.produto}>{cgItem.produto}</option>
        ) : null}
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
        {motivoList.map((motivo) => (
          <option key={motivo} value={motivo}>{motivo}</option>
        ))}
        {cgItem.motivo && !motivoList.includes(cgItem.motivo) ? (
          <option value={cgItem.motivo}>{cgItem.motivo}</option>
        ) : null}
      </select>
    </section>
  );
}
