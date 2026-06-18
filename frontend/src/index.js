/**
 * Velodesk Cockpit — entry React 18
 * VERSION: v2.1.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import Chart from 'chart.js/auto';
import * as XLSX from 'xlsx';
import App from './app/App';
import './styles/cockpit/index.css';
import './styles/app.css';

window.Chart = Chart;
window.XLSX = XLSX;

if (location.protocol === 'file:') {
  document.documentElement.innerHTML =
    '<head><meta charset="UTF-8"><title>Velodesk</title>' +
    '<style>body{font-family:Inter,Segoe UI,sans-serif;background:#0f172a;color:#e2e8f0;' +
    'display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:2rem}' +
    '.box{max-width:520px;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:1.5rem}' +
    'h1{margin:0 0 .75rem;font-size:1.25rem}p{line-height:1.5;color:#94a3b8}' +
    'code{background:#0f172a;padding:.15rem .4rem;border-radius:4px;color:#38bdf8}' +
    'a{color:#38bdf8}</style></head>' +
    '<body><div class="box"><h1>Velodesk precisa do servidor local</h1>' +
    '<p>Nao abra o app direto pelo Explorer.</p>' +
    '<p>Execute <code>npm run dev</code> em frontend/<br>' +
    'Acesse <a href="http://localhost:8000">http://localhost:8000</a></p></div></body>';
} else {
  window.VELODESK_COCKPIT = true;

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(
        BrowserRouter,
        null,
        React.createElement(App)
      )
    )
  );
}
