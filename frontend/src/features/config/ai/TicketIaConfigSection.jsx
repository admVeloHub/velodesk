/**
 * TicketIaConfigSection v1.0.0 — contexto, taxonomia e exemplos da IA de tickets
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ticketIaAnalysisApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';

function lines(value) {
  return String(value ?? '').split('\n').map((item) => item.trim()).filter(Boolean);
}

function aliasesFromText(value) {
  return lines(value).map((line) => {
    const [de, ...rest] = line.split('=>');
    return { de: de?.trim(), para: rest.join('=>').trim() };
  }).filter((item) => item.de && item.para);
}

export default function TicketIaConfigSection() {
  const { showNotification } = useNotifications();
  const [settings, setSettings] = useState(null);
  const [examples, setExamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ticketIaAnalysisApi.getSettings()
      .then((data) => {
        setSettings(data.settings);
        setExamples(data.examples || []);
      })
      .catch((err) => showNotification(
        err?.response?.data?.message || 'Erro ao carregar a configuração da IA.',
        'error',
      ))
      .finally(() => setLoading(false));
  }, [showNotification]);

  const taxonomyText = useMemo(
    () => (settings?.taxonomiaMotivos || []).join('\n'),
    [settings?.taxonomiaMotivos],
  );
  const aliasesText = useMemo(
    () => (settings?.motivoAliases || []).map((item) => `${item.de} => ${item.para}`).join('\n'),
    [settings?.motivoAliases],
  );

  const save = async () => {
    setSaving(true);
    try {
      const saved = await ticketIaAnalysisApi.updateSettings(settings);
      setSettings(saved);
      showNotification(`Configuração salva. Versão ${saved.contextoVersao}.`, 'success');
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Não foi possível salvar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="config-placeholder-msg">Carregando conhecimento da IA…</p>;
  if (!settings) return <p className="config-placeholder-msg">Configuração indisponível.</p>;

  return (
    <div className="config-ai-section">
      <div className="config-ai-version">
        <strong>Versão do contexto {settings.contextoVersao}</strong>
        <span>Origem: {settings.sourceProject || 'Velodesk'}</span>
      </div>

      <label className="config-ai-field">
        <span>Contexto da empresa</span>
        <textarea
          rows={8}
          value={settings.contextoEmpresa || ''}
          onChange={(event) => setSettings((prev) => ({ ...prev, contextoEmpresa: event.target.value }))}
        />
      </label>

      <label className="config-ai-field">
        <span>Instruções para desambiguação e “Outros”</span>
        <textarea
          rows={10}
          value={settings.instrucoesOutros || ''}
          onChange={(event) => setSettings((prev) => ({ ...prev, instrucoesOutros: event.target.value }))}
        />
      </label>

      <div className="config-ai-grid">
        <label className="config-ai-field">
          <span>Taxonomia — um motivo por linha</span>
          <textarea
            rows={16}
            value={taxonomyText}
            onChange={(event) => setSettings((prev) => ({
              ...prev,
              taxonomiaMotivos: lines(event.target.value),
            }))}
          />
        </label>
        <label className="config-ai-field">
          <span>Aliases — formato “sinônimo =&gt; motivo oficial”</span>
          <textarea
            rows={16}
            value={aliasesText}
            onChange={(event) => setSettings((prev) => ({
              ...prev,
              motivoAliases: aliasesFromText(event.target.value),
            }))}
          />
        </label>
      </div>

      <div className="config-ai-limits">
        {[
          ['maxTicketsPorCiclo', 'Tickets por ciclo'],
          ['maxExemplosPorMotivo', 'Exemplos por motivo'],
          ['maxExemplosTotal', 'Exemplos no prompt'],
        ].map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <input
              type="number"
              min="1"
              value={settings[key]}
              onChange={(event) => setSettings((prev) => ({
                ...prev,
                [key]: Number(event.target.value),
              }))}
            />
          </label>
        ))}
      </div>

      <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
        {saving ? 'Salvando…' : 'Salvar e publicar nova versão'}
      </button>

      <section className="config-ai-examples">
        <h4>Exemplos confirmados ({examples.filter((item) => item.ativo).length})</h4>
        <p>Correções feitas por gestores entram automaticamente aqui como few-shot.</p>
        {examples.slice(0, 60).map((example) => (
          <article key={example._id} className={!example.ativo ? 'is-disabled' : ''}>
            <div>
              <strong>{example.motivo}</strong>
              <span>{example.titulo || example.protocolo || 'Ticket sem título'}</span>
              <p>{example.trecho}</p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                const saved = await ticketIaAnalysisApi.updateExample(example._id, {
                  ativo: !example.ativo,
                });
                setExamples((prev) => prev.map((item) => (
                  item._id === saved._id ? saved : item
                )));
              }}
            >
              {example.ativo ? 'Desativar' : 'Ativar'}
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
