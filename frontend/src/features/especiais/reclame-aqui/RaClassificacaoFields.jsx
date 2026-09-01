/**
 * RaClassificacaoFields v2.0.0 — produto + motivo (local state, salva no click do botão Salvar)
 * VERSION: v2.0.0 | DATE: 2026-09-01
 */
import React, { useEffect, useState } from 'react';
import { tabulationApi } from '../../../api/client';
import { useTabulation } from '../../../context/TabulationContext';
import { TABULACAO_OPCOES_CATEGORIAS } from '../../../services/tabulationConfig';
import { RA_MOTIVOS } from '../../../services/especiais/reclameAquiData';

export default function RaClassificacaoFields({ raItem, onClassificacaoDraftChange }) {
  const { getProdutoNames } = useTabulation();
  const [motivos, setMotivos] = useState(RA_MOTIVOS);
  const [produtoDraft, setProdutoDraft] = useState(raItem?.produto || '');
  const [motivoDraft, setMotivoDraft] = useState(raItem?.motivo || '');
  const produtoOptions = getProdutoNames();

  useEffect(() => {
    setProdutoDraft(raItem?.produto || '');
    setMotivoDraft(raItem?.motivo || '');
  }, [raItem?.id]);

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

  const handleFieldChange = (field, value) => {
    if (field === 'produto') {
      setProdutoDraft(value);
      onClassificacaoDraftChange?.({ produto: value, motivo: motivoDraft });
    } else if (field === 'motivo') {
      setMotivoDraft(value);
      onClassificacaoDraftChange?.({ produto: produtoDraft, motivo: value });
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
        value={produtoDraft}
        onChange={(e) => handleFieldChange('produto', e.target.value)}
      >
        <option value="">Selecionar</option>
        {produtos.map((produto) => (
          <option key={produto} value={produto}>{produto}</option>
        ))}
        {produtoDraft && !produtos.includes(produtoDraft) ? (
          <option value={produtoDraft}>{produtoDraft}</option>
        ) : null}
      </select>

      <label htmlFor="ra-classificacao-motivo">Motivo</label>
      <select
        id="ra-classificacao-motivo"
        className="ra-registro__select"
        value={motivoDraft}
        onChange={(e) => handleFieldChange('motivo', e.target.value)}
      >
        <option value="">Selecionar</option>
        {motivoList.map((motivo) => (
          <option key={motivo} value={motivo}>{motivo}</option>
        ))}
        {motivoDraft && !motivoList.includes(motivoDraft) ? (
          <option value={motivoDraft}>{motivoDraft}</option>
        ) : null}
      </select>
    </section>
  );
}
