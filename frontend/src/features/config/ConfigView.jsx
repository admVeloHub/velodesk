/**
 * Central de Configurações — layout V2
 * VERSION: v3.2.0 | DATE: 2026-06-25
 */
import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useProfile } from '../../context/ProfileContext';
import { resetVelodeskLabData } from '../../config/cockpitConfig';
import { CONFIG_SECTIONS, getConfigSection } from './configSections';
import TabulationFormsSection from './components/TabulationFormsSection';

export default function ConfigView() {
  const { isNavAllowed } = useProfile();
  const [section, setSection] = useState(null);
  const active = section ? getConfigSection(section) : null;

  if (!isNavAllowed('config')) {
    return <Navigate to="/workspace" replace />;
  }

  return (
    <div id="config" className="page config-page active">
      <div className="config-layout">
        <aside className="config-sidebar">
          <div className="config-sidebar-brand">
            <div className="config-sidebar-brand-icon" aria-hidden="true">
              <i className="ti ti-adjustments-horizontal" />
            </div>
            <div>
              <h3>Configurações</h3>
              <p>Personalize tickets, fluxos e integrações</p>
            </div>
          </div>

          <nav className="config-menu" aria-label="Áreas de configuração">
            {CONFIG_SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={'config-menu-item' + (section === item.id ? ' active' : '')}
                onClick={() => setSection(item.id)}
              >
                <span className="config-menu-icon" aria-hidden="true">
                  <i className={'ti ' + item.icon} />
                </span>
                <span className="config-menu-text">
                  <span className="config-menu-label">{item.label}</span>
                  <span className="config-menu-desc">{item.menuDesc}</span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="config-content">
          {!section ? (
            <>
              <header className="config-content-header">
                <span className="config-content-eyebrow">Central de configurações</span>
                <div className="config-content-title-row">
                  <h3>Bem-vindo</h3>
                  <p>Escolha uma área no menu ou nos atalhos abaixo para começar.</p>
                </div>
              </header>

              <div className="config-welcome-grid">
                {CONFIG_SECTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="config-welcome-card"
                    onClick={() => setSection(item.id)}
                  >
                    <span className="config-welcome-card-icon" aria-hidden="true">
                      <i className={'ti ' + item.icon} />
                    </span>
                    <strong>{item.cardTitle || item.label}</strong>
                    <span>{item.cardDesc}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <header className="config-content-header">
                <span className="config-content-eyebrow">Central de configurações</span>
                <div className="config-content-title-row">
                  <h3>{active?.label}</h3>
                  <p>{active?.menuDesc}</p>
                </div>
              </header>

              {section === 'backup' ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={resetVelodeskLabData}
                >
                  Resetar dados demo
                </button>
              ) : section === 'forms' ? (
                <TabulationFormsSection />
              ) : (
                <p className="config-placeholder-msg">
                  Editor de {active?.label?.toLowerCase()} — em desenvolvimento.
                </p>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
