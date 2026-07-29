/**
 * TelephonyCallDetail v1.1.0 — detalhe da ligação Contact Tel
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { telephonyApi } from '../../api/client';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function formatStatus(value) {
  if (!value) return '—';
  return String(value).replace(/_/g, ' ');
}

function formatDirection(value) {
  if (value === 'inbound') return 'Entrada';
  if (value === 'outbound') return 'Saída';
  return value || '—';
}

function formatBool(value) {
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  return '—';
}

function formatDataCollected(dataCollected) {
  if (!dataCollected || typeof dataCollected !== 'object') return [];
  return Object.entries(dataCollected).map(([key, raw]) => {
    const value = raw && typeof raw === 'object' && 'value' in raw ? raw.value : raw;
    return { key, value: value == null ? '—' : String(value) };
  });
}

export default function TelephonyCallDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    telephonyApi.getCall(id)
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setError('Ligação não encontrada.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <p className="telephony-loading">Carregando detalhe…</p>;
  if (error || !data) return <p className="telephony-error">{error || 'Ligação não encontrada.'}</p>;

  const collectedItems = formatDataCollected(data.dataCollected);

  return (
    <div className="telephony-detail">
      <header className="telephony-detail__header">
        <button type="button" className="telephony-detail__back" onClick={() => navigate('/atendimento-ia-telefonico')}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> Voltar
        </button>
        <div>
          <span className="telephony-shell__eyebrow">Ligação IA telefônica · Contact Tel</span>
          <h2>{data.clientName || data.clientPhone || data.externalCallId}</h2>
          <p>
            {formatDate(data.endedAt || data.startedAt)}
            {' · '}
            <span className={'telephony-status is-' + (data.status || 'unknown')}>{formatStatus(data.status)}</span>
            {' · '}
            ID {data.externalCallId}
          </p>
        </div>
      </header>

      <div className="telephony-detail__grid">
        <section className="telephony-detail__card">
          <h3>Resumo</h3>
          <p>{data.summary || 'Sem resumo informado.'}</p>
        </section>

        <section className="telephony-detail__card">
          <h3>Chamada</h3>
          <dl>
            <div><dt>Direção</dt><dd>{formatDirection(data.direction)}</dd></div>
            <div><dt>Tipo</dt><dd>{data.callType || '—'}</dd></div>
            <div><dt>Status</dt><dd>{formatStatus(data.status)}</dd></div>
            <div><dt>Agente IA</dt><dd>{data.agentName || '—'}</dd></div>
            <div><dt>Campanha</dt><dd>{data.campaignName || '—'}</dd></div>
            <div><dt>Convertida</dt><dd>{formatBool(data.isConverted)}</dd></div>
            <div><dt>Opt-out</dt><dd>{formatBool(data.isOptout)}</dd></div>
            <div><dt>Duração</dt><dd>{data.durationSeconds != null ? `${data.durationSeconds}s` : '—'}</dd></div>
            <div><dt>Ring</dt><dd>{data.ringDuration != null ? `${data.ringDuration}s` : '—'}</dd></div>
          </dl>
        </section>

        <section className="telephony-detail__card">
          <h3>Identificação</h3>
          <dl>
            <div><dt>Telefone</dt><dd>{data.clientPhone || '—'}</dd></div>
            <div><dt>CPF</dt><dd>{data.clientCpf || '—'}</dd></div>
            <div><dt>Cliente cadastrado</dt><dd>{data.cliente?.nome || 'Não identificado'}</dd></div>
            <div><dt>Início</dt><dd>{formatDate(data.initiatedAt || data.startedAt)}</dd></div>
            <div><dt>Atendimento</dt><dd>{formatDate(data.answeredAt)}</dd></div>
            <div><dt>Término</dt><dd>{formatDate(data.endedAt)}</dd></div>
          </dl>
        </section>

        {data.transfer ? (
          <section className="telephony-detail__card">
            <h3>Transferência humana</h3>
            <dl>
              <div><dt>Destino</dt><dd>{data.transfer.destinationType || '—'} {data.transfer.destinationValue ? `(${data.transfer.destinationValue})` : ''}</dd></div>
              <div><dt>Atendente</dt><dd>{data.transfer.answeredByName || data.transfer.targetUserName || '—'}</dd></div>
              <div><dt>Ramal</dt><dd>{data.transfer.targetUserExtension || '—'}</dd></div>
              <div><dt>Espera</dt><dd>{data.transfer.waitMs != null ? `${Math.round(data.transfer.waitMs / 1000)}s` : '—'}</dd></div>
              <div><dt>Conectado em</dt><dd>{formatDate(data.transfer.answeredAt)}</dd></div>
            </dl>
          </section>
        ) : null}

        {collectedItems.length > 0 ? (
          <section className="telephony-detail__card">
            <h3>Dados coletados</h3>
            <dl>
              {collectedItems.map((item) => (
                <div key={item.key}><dt>{item.key}</dt><dd>{item.value}</dd></div>
              ))}
            </dl>
          </section>
        ) : null}

        <section className="telephony-detail__card telephony-detail__card--wide">
          <h3>Transcrição</h3>
          <pre className="telephony-detail__transcript">{data.transcript || 'Sem transcrição informada.'}</pre>
          {data.transcriptFull?.length > 0 ? (
            <div className="telephony-detail__turns">
              {data.transcriptFull.map((turn, index) => (
                <article key={index} className={'telephony-turn is-' + turn.role}>
                  <strong>{turn.role === 'user' ? 'Cliente' : turn.role === 'agent' ? 'Agente' : turn.role}</strong>
                  <p>{turn.message}</p>
                  {turn.timeInCallSecs != null ? <small>{turn.timeInCallSecs}s</small> : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section className="telephony-detail__card">
          <h3>Ações</h3>
          <button type="button" className="btn btn-secondary" disabled title="Em breve">
            Abrir ticket (em breve)
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRaw((v) => !v)}>
            {showRaw ? 'Ocultar payload bruto' : 'Ver payload bruto'}
          </button>
          {showRaw ? (
            <pre className="telephony-detail__raw">{JSON.stringify(data.rawPayload, null, 2)}</pre>
          ) : null}
        </section>
      </div>
    </div>
  );
}
