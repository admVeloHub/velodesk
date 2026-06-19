/**
 * Modal de relatório operacional — supervisor
 * VERSION: v1.0.0 | DATE: 2026-06-19
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { downloadReportCsv } from '../../../../services/workspace/supervisorReportsData';

export default function Workspace360ReportModal({ open, report, onClose, onDownload }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !report) return null;

  const handleDownload = () => {
    downloadReportCsv(report);
    onDownload?.(report);
  };

  return createPortal(
    <>
      <button
        type="button"
        className="ws360-report-modal__backdrop"
        aria-label="Fechar relatório"
        onClick={onClose}
      />
      <div
        className="ws360-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws360ReportModalTitle"
      >
        <header className="ws360-report-modal__header">
          <div className="ws360-report-modal__head-main">
            <span className="ws360-report-modal__icon" aria-hidden="true">
              <i className={'ti ' + report.icon} />
            </span>
            <div>
              <p className="ws360-report-modal__meta">
                {report.filters.period} · {report.filters.channel} · {report.filters.team}
              </p>
              <h2 className="ws360-report-modal__title" id="ws360ReportModalTitle">
                {report.title}
              </h2>
              <p className="ws360-report-modal__generated">Gerado em {report.generatedAt}</p>
            </div>
          </div>
          <button
            type="button"
            className="ws360-report-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>

        <div className="ws360-report-modal__body">
          <div className="ws360-report-modal__summary">
            {report.summary.map((item) => (
              <div key={item.label} className="ws360-report-modal__summary-item">
                <span className="ws360-report-modal__summary-label">{item.label}</span>
                <strong className="ws360-report-modal__summary-value">{item.value}</strong>
              </div>
            ))}
          </div>

          <div className="ws360-report-modal__table-wrap">
            <table className="ws360-report-modal__table">
              <thead>
                <tr>
                  {report.columns.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="ws360-report-modal__footer">
          <button type="button" className="btn-secondary ws360-report-modal__btn" onClick={onClose}>
            Fechar
          </button>
          <button
            type="button"
            className="ws360-btn ws360-btn--primary ws360-report-modal__btn"
            onClick={handleDownload}
          >
            <i className="ti ti-download" aria-hidden="true" />
            Baixar
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
