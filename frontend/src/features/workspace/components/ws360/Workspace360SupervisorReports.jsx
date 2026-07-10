/**
 * Relatórios operacionais — painel supervisor
 * VERSION: v2.0.0 | DATE: 2026-07-06
 */
import React, { useState } from 'react';
import { useNotifications } from '../../../../context/NotificationContext';
import { fetchWorkspace360Report } from '../../../../services/workspace/workspace360Api';
import {
  CHANNEL_OPTIONS,
  downloadReportCsv,
  normalizeReportPayload,
  PERIOD_OPTIONS,
  REPORT_CARDS,
  TEAM_OPTIONS,
} from '../../../../services/workspace/supervisorReportsData';
import Workspace360ReportModal from './Workspace360ReportModal';

export default function Workspace360SupervisorReports() {
  const { showNotification } = useNotifications();
  const [period, setPeriod] = useState('7d');
  const [channel, setChannel] = useState('all');
  const [team, setTeam] = useState('all');
  const [activeReport, setActiveReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const handleOpenReport = async (card) => {
    setLoadingReport(true);
    try {
      const raw = await fetchWorkspace360Report(card.id, { period, channel, team });
      const report = normalizeReportPayload(raw, { period, channel, team });
      if (!report) return;
      setActiveReport(report);
    } catch {
      showNotification('Não foi possível carregar o relatório.', 'error');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleCloseReport = () => {
    setActiveReport(null);
  };

  const handleDownloadReport = (report) => {
    downloadReportCsv(report);
    showNotification(`Relatório "${report.title}" baixado.`, 'success');
  };

  return (
    <>
      <section className="ws-panel ws360-reports">
        <header className="ws360-reports__head">
          <h4 className="ws360-reports__title">
            <span className="ws360-reports__title-icon" aria-hidden="true">
              <i className="ti ti-chart-dots" />
            </span>
            Relatórios operacionais
          </h4>
          <div className="ws360-reports__filters">
            <select
              className="ws360-reports__select"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              aria-label="Filtrar por período"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className="ws360-reports__select"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              aria-label="Filtrar por canal"
            >
              {CHANNEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className="ws360-reports__select"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              aria-label="Filtrar por equipe"
            >
              {TEAM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="ws360-reports__grid">
          {REPORT_CARDS.map((card) => (
            <article key={card.id} className="ws360-reports-card">
              <span className="ws360-reports-card__icon" aria-hidden="true">
                <i className={'ti ' + card.icon} />
              </span>
              <h5 className="ws360-reports-card__title">{card.title}</h5>
              <p className="ws360-reports-card__desc">{card.desc}</p>
              <button
                type="button"
                className="btn-primary ws360-reports-card__btn"
                disabled={loadingReport}
                onClick={() => handleOpenReport(card)}
              >
                {card.action}
              </button>
            </article>
          ))}
        </div>
      </section>

      <Workspace360ReportModal
        open={Boolean(activeReport)}
        report={activeReport}
        onClose={handleCloseReport}
        onDownload={handleDownloadReport}
      />
    </>
  );
}
