/**
 * TelephonyCallsPanel v1.2.0 — lista de ligações Contact Tel + KPIs + aba recados
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { telephonyApi } from '../../api/client';
import GestaoPeriodFilter from '../workspace/components/gestaoInsights/GestaoPeriodFilter';
import TelephonyRecadosPanel from './TelephonyRecadosPanel';
import {
  DESFECHO_FILTER_OPTIONS,
  ROTA_FILTER_OPTIONS,
  desfechoLabel,
} from './telephonyDataCollected';
import { formatDateTimeBr } from '../../utils/dateTimeBr';

function formatDate(value) {
  return formatDateTimeBr(value);
}

function formatDuration(seconds) {
  if (seconds == null) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatCpf(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 11) return value || '—';
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
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

export default function TelephonyCallsPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('calls');
  const [period, setPeriod] = useState({ period: 'mes' });
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [direction, setDirection] = useState('');
  const [desfecho, setDesfecho] = useState('');
  const [rotaAtendida, setRotaAtendida] = useState('');
  const [stats, setStats] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const queryParams = useCallback(() => ({
    period: period.period,
    from: period.from,
    to: period.to,
    phone: phone.trim() || undefined,
    cpf: cpf.replace(/\D/g, '') || undefined,
    q: q.trim() || undefined,
    status: status.trim() || undefined,
    direction: direction || undefined,
    desfecho: desfecho || undefined,
    rotaAtendida: rotaAtendida || undefined,
  }), [period, phone, cpf, q, status, direction, desfecho, rotaAtendida]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = queryParams();
      const [statsResult, listResult] = await Promise.all([
        telephonyApi.stats(params),
        telephonyApi.listCalls({ ...params, page: 1, limit: 50 }),
      ]);
      setStats(statsResult);
      setData(listResult);
    } catch (err) {
      setError(err?.response?.data?.message || 'Não foi possível carregar as ligações.');
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    if (tab === 'calls') void load();
  }, [tab, load]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError('');
    try {
      const { items } = await telephonyApi.exportCalls(queryParams());
      if (!items?.length) {
        setExportError('Nenhuma ligação encontrada no período selecionado.');
        return;
      }
      const rows = items.map((item) => ({
        'Data/hora': formatDate(item.endedAt || item.startedAt),
        Telefone: item.clientPhone || '—',
        Cliente: item.clientName || '—',
        Agente: item.agentName || '—',
        Duração: formatDuration(item.durationSeconds),
        Resumo: item.summary || '',
        'Transcrição completa': item.transcript || '',
        'Nota CSAT': item.csatNota != null ? item.csatNota : '',
        'Comentário CSAT': item.csatComentario || '',
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 18 }, { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 10 }, { wch: 60 }, { wch: 90 }, { wch: 10 }, { wch: 60 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Ligações Letícia IA');
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `leticia-ia-transcricoes-${stamp}.xlsx`);
    } catch (err) {
      setExportError(err?.response?.data?.message || 'Não foi possível gerar o arquivo XLSX.');
    } finally {
      setExporting(false);
    }
  }, [queryParams]);

  return (
    <div className="telephony-shell">
      <header className="telephony-shell__header">
        <div>
          <span className="telephony-shell__eyebrow">Atendimento IA</span>
          <h2>Atendimento IA Telefônico</h2>
          <p>Ligações recebidas da Contact Tel (Letícia) e recados emergenciais para orientar a IA antes de cada atendimento.</p>
        </div>
      </header>

      <div className="telephony-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'calls'}
          className={'telephony-tabs__btn' + (tab === 'calls' ? ' is-active' : '')}
          onClick={() => setTab('calls')}
        >
          Ligações
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'recados'}
          className={'telephony-tabs__btn' + (tab === 'recados' ? ' is-active' : '')}
          onClick={() => setTab('recados')}
        >
          Recados emergenciais
        </button>
      </div>

      {tab === 'recados' ? (
        <TelephonyRecadosPanel />
      ) : (
        <>
          <div className="telephony-filters">
            <GestaoPeriodFilter value={period} onChange={setPeriod} idPrefix="telephony" />
            <input
              type="text"
              placeholder="Telefone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              type="text"
              placeholder="CPF"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
            />
            <select value={direction} onChange={(e) => setDirection(e.target.value)} aria-label="Direção">
              <option value="">Todas direções</option>
              <option value="inbound">Entrada</option>
              <option value="outbound">Saída</option>
            </select>
            <select value={desfecho} onChange={(e) => setDesfecho(e.target.value)} aria-label="Desfecho">
              <option value="">Todos desfechos</option>
              {DESFECHO_FILTER_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <select value={rotaAtendida} onChange={(e) => setRotaAtendida(e.target.value)} aria-label="Rota">
              <option value="">Todas rotas</option>
              {ROTA_FILTER_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Status (ex.: completed)"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
            <input
              type="search"
              placeholder="Buscar no resumo ou transcrição"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={load}>
              Filtrar
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExport}
              disabled={exporting}
              title="Baixa horário, resumo e transcrição completa das ligações do período filtrado"
            >
              <i className="ti ti-file-spreadsheet" aria-hidden="true" />
              {exporting ? 'Gerando XLSX…' : 'Baixar XLSX'}
            </button>
          </div>

          {exportError ? <p className="telephony-error">{exportError}</p> : null}

          {stats ? (
            <div className="telephony-kpis">
              <article><span>No período</span><strong>{stats.total}</strong></article>
              <article><span>Hoje</span><strong>{stats.today}</strong></article>
              <article><span>Com CPF</span><strong>{stats.withCpf}</strong></article>
              <article><span>Convertidas</span><strong>{stats.converted ?? 0}</strong></article>
              <article>
                <span>Nota CSAT (méd.)</span>
                <strong>{stats.csatAvgNota != null ? stats.csatAvgNota.toFixed(1) : '—'}</strong>
                {stats.csatCount ? <small>{stats.csatCount} avaliações</small> : null}
              </article>
            </div>
          ) : null}

          {error ? <p className="telephony-error">{error}</p> : null}
          {loading ? <p className="telephony-loading">Carregando ligações…</p> : null}

          {!loading && data?.items?.length === 0 ? (
            <p className="telephony-empty">Nenhuma ligação recebida neste recorte.</p>
          ) : null}

          {!loading && data?.items?.length > 0 ? (
            <div className="telephony-table-wrap">
              <table className="telephony-table">
                <thead>
                  <tr>
                    <th>Data/hora</th>
                    <th>Telefone</th>
                    <th>Cliente</th>
                    <th>Status</th>
                    <th>Desfecho</th>
                    <th>Agente</th>
                    <th>Resumo</th>
                    <th>Duração</th>
                    <th>Nota CSAT</th>
                    <th>Comentário CSAT</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr
                      key={item.id}
                      className="telephony-table__row"
                      onClick={() => navigate(`/atendimento-ia-telefonico/calls/${item.id}`)}
                    >
                      <td>{formatDate(item.endedAt || item.startedAt)}</td>
                      <td>{item.clientPhone || '—'}</td>
                      <td>
                        <div>{item.clientName || '—'}</div>
                        {item.clientCpf ? <small>{formatCpf(item.clientCpf)}</small> : null}
                      </td>
                      <td>
                        <span className={'telephony-status is-' + (item.status || 'unknown')}>
                          {formatStatus(item.status)}
                        </span>
                        <small>{formatDirection(item.direction)}</small>
                      </td>
                      <td>{item.desfecho ? desfechoLabel(item.desfecho) : '—'}</td>
                      <td>{item.agentName || '—'}</td>
                      <td>{item.summary || '—'}</td>
                      <td>{formatDuration(item.durationSeconds)}</td>
                      <td>{item.csatNota != null ? `${item.csatNota} / 5` : '—'}</td>
                      <td>
                        {item.csatComentario ? (
                          <span className="telephony-table__csat-comment" title={item.csatComentario}>
                            {item.csatComentario}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

