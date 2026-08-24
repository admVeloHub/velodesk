/**
 * EmailOutboundEditor v1.2.0 — simulação do CSAT mostra bloco de estrelas
 * VERSION: v1.2.0 | DATE: 2026-08-24
 */
import React, { useEffect, useMemo, useState } from 'react';
import { emailOutboundApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import { useTabulation } from '../../../context/TabulationContext';
import { buildOutboundPreviewHtml } from './emailPreviewHtml';

const CRITERIO_TIPOS = [
  { id: 'canal', label: 'Canal' },
  { id: 'status', label: 'Status' },
  { id: 'sla', label: 'SLA' },
  { id: 'gatilho_interno', label: 'Gatilho interno' },
];

function emptyDraft() {
  return {
    nome: '',
    ativo: true,
    saudacao: '',
    corpo: '',
    gatilho: { criterios: [] },
  };
}

function expandFiltros(criterios) {
  if (!Array.isArray(criterios) || !criterios.length) return [];
  const rows = [];
  for (const item of criterios) {
    if (item.tipo === 'gatilho_interno') {
      return [{ tipo: 'gatilho_interno', valor: '' }];
    }
    const valores = item.valores || [];
    if (!valores.length) {
      rows.push({ tipo: item.tipo, valor: '' });
    } else {
      valores.forEach((valor) => rows.push({ tipo: item.tipo, valor }));
    }
  }
  return rows;
}

function collapseFiltros(filtros) {
  if ((filtros || []).some((item) => item.tipo === 'gatilho_interno')) {
    return [{ tipo: 'gatilho_interno', valores: [] }];
  }
  const byTipo = new Map();
  for (const item of filtros || []) {
    if (!item.tipo) continue;
    const current = byTipo.get(item.tipo) || [];
    const valor = String(item.valor || '').trim();
    if (valor && !current.includes(valor)) current.push(valor);
    byTipo.set(item.tipo, current);
  }
  return Array.from(byTipo.entries()).map(([tipo, valores]) => ({ tipo, valores }));
}

function summarizeCriterios(criterios, opcoes) {
  if (!criterios?.length) return 'Sem gatilho';
  if (criterios.some((item) => item.tipo === 'gatilho_interno')) return 'Gatilho interno';
  return criterios.map((item) => {
    const label = CRITERIO_TIPOS.find((tipo) => tipo.id === item.tipo)?.label || item.tipo;
    const values = item.tipo === 'status'
      ? (item.valores || []).map((value) => opcoes.status.find((opt) => opt.value === value)?.label || value)
      : item.tipo === 'sla'
        ? (item.valores || []).map((value) => opcoes.sla.find((opt) => opt.value === value)?.label || value)
        : (item.valores || []);
    return `${label}: ${values.join(', ') || '—'}`;
  }).join(' · ');
}

function overlapWarning(current, allItems) {
  const mine = current.gatilho?.criterios || [];
  if (mine.some((item) => item.tipo === 'gatilho_interno') || !mine.length) return '';
  const key = JSON.stringify(mine.map((item) => ({ tipo: item.tipo, valores: [...(item.valores || [])].sort() })).sort((a, b) => a.tipo.localeCompare(b.tipo)));
  const others = allItems.filter((item) => item.id !== current.id && item.ativo);
  const clash = others.find((item) => {
    const theirs = item.gatilho?.criterios || [];
    if (theirs.some((row) => row.tipo === 'gatilho_interno')) return false;
    const otherKey = JSON.stringify(theirs.map((row) => ({ tipo: row.tipo, valores: [...(row.valores || [])].sort() })).sort((a, b) => a.tipo.localeCompare(b.tipo)));
    return otherKey === key && key !== '[]';
  });
  return clash ? `Este gatilho coincide com “${clash.nome}”. Os dois podem disparar no mesmo evento.` : '';
}

export default function EmailOutboundEditor({ itemId, items, onClose, onSaved }) {
  const { showNotification } = useNotifications();
  const { getCanalContatoOptions } = useTabulation();
  const [draft, setDraft] = useState(emptyDraft());
  const [filtros, setFiltros] = useState([]);
  const [opcoes, setOpcoes] = useState({ canais: [], status: [], sla: [], farewell: '' });
  const [layout, setLayout] = useState({ headerHtml: '', signatureHtml: '', farewellHtml: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const isInternal = filtros.some((item) => item.tipo === 'gatilho_interno');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      emailOutboundApi.opcoes(),
      emailOutboundApi.layout(),
      itemId ? emailOutboundApi.getConteudo(itemId) : Promise.resolve(null),
    ]).then(([nextOpcoes, nextLayout, item]) => {
      if (cancelled) return;
      setOpcoes(nextOpcoes);
      setLayout(nextLayout);
      const nextDraft = item ? {
        id: item.id,
        nome: item.nome,
        ativo: item.ativo,
        saudacao: item.saudacao,
        corpo: item.corpo,
        gatilho: item.gatilho || { criterios: [] },
      } : emptyDraft();
      setDraft(nextDraft);
      setFiltros(expandFiltros(nextDraft.gatilho?.criterios));
    }).catch((err) => {
      showNotification(err?.response?.data?.message || 'Erro ao carregar o e-mail.', 'error');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [itemId, showNotification]);

  const canalOptions = useMemo(() => {
    const fromApi = opcoes.canais || [];
    const fromTab = getCanalContatoOptions?.() || [];
    return Array.from(new Set([...fromApi, ...fromTab])).map((value) => ({ value, label: value }));
  }, [opcoes.canais, getCanalContatoOptions]);

  // "Encerramento mais satisfação" e "Repescagem da satisfação" recebem, no envio
  // real, um bloco de 5 estrelas gerado pelo backend (csatEmail.service.ts) — ele
  // não faz parte do campo Corpo. Mostramos aqui uma versão estática só para a
  // simulação refletir como o e-mail final chega ao cliente.
  const isCsatTemplate = draft.nome === 'Encerramento mais satisfação' || draft.nome === 'Repescagem da satisfação';

  const previewHtml = useMemo(() => buildOutboundPreviewHtml({
    headerHtml: layout.headerHtml,
    saudacao: draft.saudacao,
    corpo: draft.corpo,
    farewellHtml: layout.farewellHtml,
    signatureHtml: layout.signatureHtml,
    protocolo: '0100000001',
    titulo: draft.nome || 'Exemplo de assunto do atendimento',
    showCsatStars: isCsatTemplate,
  }), [draft.saudacao, draft.corpo, draft.nome, layout, isCsatTemplate]);

  const warning = overlapWarning(draft, items || []);

  const applyFiltros = (next) => {
    setFiltros(next);
    setDraft((prev) => ({ ...prev, gatilho: { criterios: collapseFiltros(next) } }));
  };

  const valoresDoTipo = (tipo) => {
    if (tipo === 'canal') return canalOptions;
    if (tipo === 'status') return opcoes.status || [];
    if (tipo === 'sla') return opcoes.sla || [];
    return [];
  };

  const valoresDisponiveis = (tipo, index, valorAtual) => {
    const usados = new Set(
      filtros
        .filter((item, i) => i !== index && item.tipo === tipo && item.valor)
        .map((item) => item.valor),
    );
    const opts = valoresDoTipo(tipo).filter((opt) => !usados.has(opt.value));
    if (valorAtual && !opts.some((opt) => opt.value === valorAtual)) {
      opts.unshift({ value: valorAtual, label: valorAtual });
    }
    return opts;
  };

  const updateFiltro = (index, patch) => {
    const current = filtros[index] || { tipo: '', valor: '' };
    const merged = { ...current, ...patch };
    if (merged.tipo === 'gatilho_interno') {
      applyFiltros([{ tipo: 'gatilho_interno', valor: '' }]);
      return;
    }
    applyFiltros(filtros.map((item, i) => (i === index ? merged : item)));
  };

  const removeFiltro = (index) => {
    applyFiltros(filtros.filter((_, i) => i !== index));
  };

  const addFiltro = () => {
    if (isInternal) return;
    applyFiltros([...filtros, { tipo: '', valor: '' }]);
  };

  const handleSave = async () => {
    if (!draft.nome.trim()) {
      showNotification('Informe o nome do e-mail.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome: draft.nome,
        ativo: draft.ativo,
        saudacao: draft.saudacao,
        corpo: draft.corpo,
        gatilho: { criterios: collapseFiltros(filtros) },
      };
      const saved = draft.id
        ? await emailOutboundApi.updateConteudo(draft.id, payload)
        : await emailOutboundApi.createConteudo(payload);
      showNotification('E-mail de saída salvo.', 'success');
      onSaved?.(saved);
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Não foi possível salvar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="config-placeholder-msg">Carregando editor…</p>;

  return (
    <div className="config-email-outbound-editor">
      <div className="config-email-outbound-editor__form">
        <div className="config-email-outbound-editor__toolbar">
          <button type="button" className="config-action-btn config-action-btn--edit" onClick={onClose}>
            <i className="ti ti-arrow-left" aria-hidden="true" /> Voltar
          </button>
          <label className="config-email-ativo">
            <input
              type="checkbox"
              checked={Boolean(draft.ativo)}
              onChange={(e) => setDraft((prev) => ({ ...prev, ativo: e.target.checked }))}
            />
            Ativo
          </label>
          <button type="button" className="config-action-btn config-action-btn--create" disabled={saving} onClick={handleSave}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>

        <label className="config-email-field">
          <span>Nome</span>
          <input
            type="text"
            value={draft.nome}
            onChange={(e) => setDraft((prev) => ({ ...prev, nome: e.target.value }))}
            placeholder="Ex.: Abertura de ticket"
          />
        </label>
        <label className="config-email-field">
          <span>Saudação</span>
          <textarea
            rows={3}
            value={draft.saudacao}
            onChange={(e) => setDraft((prev) => ({ ...prev, saudacao: e.target.value }))}
            placeholder="Olá,"
          />
        </label>
        <label className="config-email-field">
          <span>Corpo do e-mail</span>
          <textarea
            rows={8}
            value={draft.corpo}
            onChange={(e) => setDraft((prev) => ({ ...prev, corpo: e.target.value }))}
          />
        </label>

        <section className="config-email-gatilho">
          <div className="config-email-gatilho__head">
            <div>
              <h4>Gatilho de envio</h4>
              <p className="config-placeholder-msg">Vários critérios entram com E. Vários valores do mesmo critério entram com OU.</p>
            </div>
            <button
              type="button"
              className="config-action-btn config-action-btn--create"
              onClick={addFiltro}
              disabled={isInternal}
              title={isInternal ? 'Gatilho interno não combina com outros filtros' : 'Adicionar filtro'}
            >
              <i className="ti ti-plus" aria-hidden="true" /> Adicionar filtro
            </button>
          </div>
          {warning ? <p className="config-email-warning">{warning}</p> : null}

          {filtros.length === 0 ? (
            <p className="config-placeholder-msg">Nenhum filtro. Adicione um critério para disparar este e-mail.</p>
          ) : (
            <ul className="config-email-filtro-list">
              {filtros.map((filtro, index) => {
                const interno = filtro.tipo === 'gatilho_interno';
                const valorOpts = valoresDisponiveis(filtro.tipo, index, filtro.valor);
                return (
                  <li
                    key={`filtro-${index}`}
                    className={
                      'config-email-filtro-row'
                      + (interno ? ' is-internal' : '')
                      + (!filtro.tipo ? ' is-pending' : '')
                    }
                  >
                    <label className="config-email-field">
                      <span>Critério</span>
                      <select
                        value={filtro.tipo}
                        onChange={(e) => updateFiltro(index, { tipo: e.target.value, valor: '' })}
                      >
                        <option value="">Selecione…</option>
                        {CRITERIO_TIPOS.map((tipo) => (
                          <option key={tipo.id} value={tipo.id}>{tipo.label}</option>
                        ))}
                      </select>
                    </label>
                    {interno ? (
                      <p className="config-placeholder-msg">Sem valor. Este e-mail não dispara sozinho — fica pronto para outra ação chamar depois.</p>
                    ) : filtro.tipo ? (
                      <label className="config-email-field">
                        <span>Valor</span>
                        <select
                          value={filtro.valor}
                          onChange={(e) => updateFiltro(index, { valor: e.target.value })}
                        >
                          <option value="">Selecione…</option>
                          {valorOpts.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <button
                      type="button"
                      className="config-action-btn config-action-btn--delete"
                      onClick={() => removeFiltro(index)}
                      aria-label="Remover filtro"
                    >
                      <i className="ti ti-trash" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <p className="config-placeholder-msg">{summarizeCriterios(draft.gatilho?.criterios, opcoes)}</p>
      </div>

      <div className="config-email-outbound-editor__preview">
        <h4>Simulação do e-mail</h4>
        <iframe
          title="Simulação do e-mail de saída"
          className="config-email-preview-frame"
          sandbox=""
          srcDoc={previewHtml}
        />
      </div>
    </div>
  );
}
