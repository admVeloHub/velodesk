import React from 'react';
import { WORKFLOW_CONFIG_TABS } from './workflowConfigData';

export default function WorkflowConfigSidebar({
  activeTab,
  onTabChange,
}) {
  return (
    <aside className="wf-config-sidebar" aria-label="Configuração do workflow">
      <div className="wf-config-sidebar__section">
        <h3 className="wf-config-sidebar__heading">Configuração</h3>
        <nav className="wf-config-sidebar__nav">
          {WORKFLOW_CONFIG_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={'wf-config-sidebar__item' + (activeTab === tab.id ? ' is-active' : '')}
              onClick={() => onTabChange(tab.id)}
            >
              <i className={tab.icon} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
