/**
 * Configurações do cockpit
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import React, { useState } from 'react';
import { resetVelodeskLabData } from '../../config/cockpitConfig';

const SECTIONS = [
  { id: 'ticket-form', label: 'Formulário do ticket', desc: 'CPF, canal, produto, motivo…' },
  { id: 'forms', label: 'Formulários', desc: 'Campos e árvores de tabulação' },
  { id: 'workflows', label: 'Workflows', desc: 'Regras e fluxos automáticos' },
  { id: 'backup', label: 'Backup / Restore', desc: 'Exportar e restaurar dados' },
  { id: 'api', label: 'API Externa', desc: 'Chaves e endpoints' },
  { id: 'automations', label: 'Automações', desc: 'Gatilhos e ações' }
];

export default function ConfigView() {
  const [section, setSection] = useState(null);

  return (
    <div id="config" className="page config-page active">
      <div className="page-header"><h2>Configurações</h2></div>
      <div className="config-container" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: 480 }}>
        <nav className="config-sidebar">
          <h3>Configurações</h3>
          <p>Personalize tickets, fluxos e integrações</p>
          <ul className="config-nav">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button type="button" className={'config-nav-item' + (section === s.id ? ' active' : '')} onClick={() => setSection(s.id)}>
                  <strong>{s.label}</strong>
                  <span>{s.desc}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main className="config-main-content" style={{ padding: 24 }}>
          {!section && (
            <>
              <h3>Central de configurações</h3>
              <p>Escolha uma área no menu para começar.</p>
              <div className="config-shortcuts" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24 }}>
                {SECTIONS.slice(0, 3).map((s) => (
                  <button key={s.id} type="button" className="eco-card" onClick={() => setSection(s.id)}>
                    <h4>{s.label}</h4>
                    <p>{s.desc}</p>
                  </button>
                ))}
              </div>
            </>
          )}
          {section === 'backup' && (
            <section>
              <h3>Backup e restauração</h3>
              <p>Exporte snapshots completos ou incrementais.</p>
              <button type="button" className="btn-secondary" onClick={resetVelodeskLabData} style={{ marginTop: 16 }}>
                Resetar dados demo
              </button>
            </section>
          )}
          {section && section !== 'backup' && (
            <section>
              <h3>{SECTIONS.find((s) => s.id === section)?.label}</h3>
              <p>Editor de {section} — protótipo operacional em localStorage.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
