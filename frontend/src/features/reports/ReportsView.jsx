/**
 * Relatórios
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const TABS = ['import', 'reading', 'performance', 'agents', 'satisfaction'];

export default function ReportsView() {
  const [tab, setTab] = useState('reading');

  const data = {
    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
    datasets: [
      { label: 'Resolvidos', data: [120, 135, 128, 142, 156, 148], backgroundColor: '#15A237' },
      { label: 'Abertos', data: [45, 52, 48, 55, 61, 58], backgroundColor: '#1634FF' }
    ]
  };

  return (
    <div id="reports" className="page active">
      <div className="page-header">
        <h2>Relatórios</h2>
        <button type="button" className="btn-primary"><i className="fas fa-download" /> Exportar XLSX</button>
      </div>
      <div className="reports-tabs" style={{ display: 'flex', gap: 8, padding: '0 24px', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} type="button" className={'btn-secondary' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>
            {t === 'import' ? 'Importar' : t === 'reading' ? 'Leitura' : t === 'performance' ? 'Performance' : t === 'agents' ? 'Agentes' : 'Satisfação'}
          </button>
        ))}
      </div>
      <div className="reports-container" style={{ padding: 24 }}>
        {tab === 'import' && (
          <div className="import-section">
            <h3>Importar Planilha de Tickets</h3>
            <p>Faça upload de uma planilha Excel (.xlsx) ou CSV (.csv) com os dados dos tickets.</p>
            <div className="upload-area" style={{ border: '2px dashed #cbd5e1', padding: 32, textAlign: 'center', borderRadius: 8 }}>
              Clique aqui ou arraste o arquivo
            </div>
          </div>
        )}
        {tab === 'reading' && (
          <>
            <Bar data={data} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
            <table className="client360-table" style={{ marginTop: 24, width: '100%' }}>
              <thead><tr><th>Número</th><th>Assunto</th><th>Status</th><th>Responsável</th></tr></thead>
              <tbody><tr><td colSpan={4}>Nenhum ticket importado. Faça upload na aba Importar.</td></tr></tbody>
            </table>
          </>
        )}
        {tab !== 'import' && tab !== 'reading' && (
          <p>Relatório de {tab} — dados demo disponíveis após importação de planilha.</p>
        )}
      </div>
    </div>
  );
}
