/**
 * TelephonyCallDetail v2.0.0 — detalhe da ligação Contact Tel com dicionário LetícIA
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { telephonyApi } from '../../api/client';
import {
  areaLabel,
  politicaLabel,
  tipoLabel,
} from './telephonyRecadoConstants';
import { buildCsatSummary, buildDataCollectedSections } from './telephonyDataCollected';
import { formatDateTimeBr } from '../../utils/dateTimeBr';

function formatDate(value) {
  return formatDateTimeBr(value);
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

function RecadosAtivosCards({ recados }) {
  if (!recados.length) return <p className="telephony-empty-inline">Nenhum recado ativo na ligação.</p>;
  return (
    <div className="telephony-recados-inline">
      {recados.map((recado) => (
        <article key={recado.id || recado.titulo} className="telephony-recados-inline__item">
          <strong>{recado.titulo}</strong>
          <p>{recado.mensagemCliente}</p>
          <small>
            {(recado.areas || []).map((area) => areaLabel(area)).join(' · ')}
            {' · '}
            {tipoLabel(recado.tipo)}
            {' · '}
            {politicaLabel(recado.politicaChamado)}
          </small>
        </article>
      ))}
    </div>
  );
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

  const dataSections = useMemo(
    () => buildDataCollectedSections(data?.dataCollected).filter((section) => section.id !== 'csat'),
    [data?.dataCollected],
  );

  const csat = useMemo(
    () => buildCsatSummary(data?.dataCollected),
    [data?.dataCollected],
  );

  if (loading) return <p className="telephony-loading">Carregando detalhe…</p>;
  if (error || !data) return <p className="telephony-error">{error || 'Ligação não encontrada.'}</p>;

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

        {dataSections.map((section) => (
          <section key={section.id} className="telephony-detail__card telephony-detail__card--wide">
            <h3>{section.title}</h3>
            <dl>
              {section.items.map((item) => (
                <div key={item.key}>
                  <dt>{item.label}</dt>
                  <dd>
                    {item.isRecadosJson ? (
                      <RecadosAtivosCards recados={item.recados} />
                    ) : (
                      item.displayValue
                    )}
                    {item.rationale ? (
                      <small className="telephony-detail__rationale">{item.rationale}</small>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

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

        <section className="telephony-detail__card telephony-detail__card--wide">
          <h3>Avaliação do cliente (CSAT)</h3>
          {csat ? (
            <div className="telephony-csat">
              <div className="telephony-csat__score">
                <span className="telephony-csat__score-label">Nota</span>
                <span className="telephony-csat__score-value">{csat.nota != null ? `${csat.nota} / 5` : '—'}</span>
                {csat.nota != null ? (
                  <span className="telephony-csat__stars" aria-hidden="true">
                    {'★'.repeat(csat.nota)}{'☆'.repeat(Math.max(0, 5 - csat.nota))}
                  </span>
                ) : null}
              </div>
              <p className="telephony-csat__comment">{csat.comentario || 'Sem comentário informado.'}</p>
              {csat.motivoNaoColetadoLabel ? (
                <small className="telephony-detail__rationale">Motivo: {csat.motivoNaoColetadoLabel}</small>
              ) : null}
            </div>
          ) : (
            <p className="telephony-empty-inline">Pesquisa de satisfação não respondida ou não realizada.</p>
          )}
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
