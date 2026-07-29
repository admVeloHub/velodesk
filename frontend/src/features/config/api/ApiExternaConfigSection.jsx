/**
 * ApiExternaConfigSection v1.0.0 — URLs e health da integração telefonia IA
 */
import React, { useEffect, useState } from 'react';
import { telephonyApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';

export default function ApiExternaConfigSection() {
  const { showNotification } = useNotifications();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    telephonyApi.integrationInfo()
      .then(setInfo)
      .catch((err) => {
        showNotification(err?.response?.data?.message || 'Erro ao carregar integração.', 'error');
      })
      .finally(() => setLoading(false));
  }, [showNotification]);

  if (loading) return <p className="config-placeholder-msg">Carregando integração…</p>;
  if (!info) return <p className="config-placeholder-msg">Integração indisponível.</p>;

  return (
    <div className="config-api-section">
      <p className="config-placeholder-msg">
        Integração Contact Tel (Letícia): a parceira envia o payload completo ao fim de cada ligação.
        O Velodesk <strong>não</strong> consulta o GET <code>/public/v1/calls/&#123;id&#125;/</code> da Contact Tel.
        Autenticação via header <code>{info.authHeader}</code> (valor configurado no servidor).
      </p>

      <dl className="config-api-list">
        <div>
          <dt>Provedor</dt>
          <dd>{info.provider || 'contact-tel'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{info.enabled ? 'Ativo' : 'Desabilitado'}</dd>
        </div>
        <div>
          <dt>Secret configurado</dt>
          <dd>{info.secretConfigured ? 'Sim' : 'Não'}</dd>
        </div>
        <div>
          <dt>POST ligações</dt>
          <dd><code>{info.inboundCallsUrl}</code></dd>
        </div>
        <div>
          <dt>GET recados ativos</dt>
          <dd><code>{info.inboundRecadosUrl}</code></dd>
        </div>
        <div>
          <dt>Health check</dt>
          <dd><code>{info.inboundHealthUrl}</code></dd>
        </div>
        <div>
          <dt>Abrir ticket automaticamente</dt>
          <dd>{info.autoCreateTicket ? 'Sim' : 'Não (v1)'}</dd>
        </div>
      </dl>

      <section className="config-api-example">
        <h4>Exemplo de payload Contact Tel (sem gravação)</h4>
        <pre>{JSON.stringify(info.payloadExample, null, 2)}</pre>
      </section>
    </div>
  );
}
