import React from 'react';
import { WORKFLOW_CONFIG_LIST, WORKFLOW_CONFIG_TABS } from './workflowConfigData';

export default function WorkflowConfigSidebar({
  activeTab,
  selectedWorkflowId,
  onTabChange,
  onWorkflowChange,
  onNewWorkflow,
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

      <div className="wf-config-sidebar__section">
        <h3 className="wf-config-sidebar__heading">Outros workflows</h3>
        <nav className="wf-config-sidebar__nav wf-config-sidebar__nav--workflows">
          {WORKFLOW_CONFIG_LIST.map((wf) => (
            <button
              key={wf.id}
              type="button"
              className={'wf-config-sidebar__item wf-config-sidebar__item--workflow'
                + (selectedWorkflowId === wf.id ? ' is-active' : '')}
              onClick={() => onWorkflowChange(wf.id)}
            >
              {wf.title}
            </button>
          ))}
          <button
            type="button"
            className="wf-config-sidebar__item wf-config-sidebar__item--new"
            onClick={onNewWorkflow}
          >
            <i className="ti ti-plus" aria-hidden="true" />
            Novo workflow
          </button>
        </nav>
      </div>
    </aside>
  );
}
