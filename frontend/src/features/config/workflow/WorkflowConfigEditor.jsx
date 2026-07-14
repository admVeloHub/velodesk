/**
 * WorkflowConfigEditor v1.0.0 — editor interno de um workflow selecionado
 * VERSION: v1.0.0 | DATE: 2026-07-14
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotifications } from '../../../context/NotificationContext';
import { createWorkflowSlug } from './workflowConfigData';
import WorkflowConfigHeader from './WorkflowConfigHeader';
import WorkflowConfigSidebar from './WorkflowConfigSidebar';
import WorkflowConfigTriggerCard from './WorkflowConfigTriggerCard';
import WorkflowConfigTriggerEditor from './WorkflowConfigTriggerEditor';
import WorkflowConfigStepsTimeline from './WorkflowConfigStepsTimeline';

const PLACEHOLDER_TABS = {
  slas: 'Editor de SLAs e prazos — em breve.',
  notifications: 'Editor de notificações — em breve.',
  automations: 'Editor de automações — em breve.',
};

function cloneWorkflow(workflow) {
  if (!workflow) return null;
  return {
    ...workflow,
    trigger: workflow.trigger ? { ...workflow.trigger, path: [...(workflow.trigger.path || [])] } : null,
    steps: (workflow.steps || []).map((step) => ({
      ...step,
      badges: (step.badges || []).map((badge) => ({ ...badge })),
    })),
  };
}

export default function WorkflowConfigEditor({
  workflow: initialWorkflow,
  isNew = false,
  existingIds = [],
  onClose,
  onSave,
}) {
  const { showNotification } = useNotifications();
  const [draft, setDraft] = useState(() => cloneWorkflow(initialWorkflow));
  const [activeTab, setActiveTab] = useState('steps');
  const [isEditingTrigger, setIsEditingTrigger] = useState(false);

  useEffect(() => {
    setDraft(cloneWorkflow(initialWorkflow));
    setActiveTab('steps');
    setIsEditingTrigger(false);
  }, [initialWorkflow]);

  const trigger = draft?.trigger;

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    setIsEditingTrigger(false);
  }, []);

  const handleToggleActive = useCallback((value) => {
    setDraft((prev) => ({ ...prev, active: value }));
  }, []);

  const handleTitleChange = useCallback((value) => {
    setDraft((prev) => ({ ...prev, title: value }));
  }, []);

  const handleSave = useCallback(() => {
    const title = String(draft?.title || '').trim();
    if (!title) {
      showNotification('Informe o nome do workflow.', 'error');
      return;
    }

    const path = (draft?.trigger?.path || []).map((value) => String(value || '').trim());
    if (path.some((value) => !value)) {
      showNotification('Complete o gatilho de tabulação antes de salvar.', 'error');
      setActiveTab('steps');
      setIsEditingTrigger(true);
      return;
    }

    let nextId = draft.id;
    if (isNew) {
      nextId = createWorkflowSlug(title);
      if (existingIds.includes(nextId)) {
        nextId = `${nextId}-${Date.now()}`;
      }
    }

    onSave?.({
      ...draft,
      id: nextId,
      title,
      trigger: {
        ...draft.trigger,
        path,
      },
    });
    showNotification(isNew ? 'Workflow criado.' : 'Workflow salvo.', 'success');
  }, [draft, existingIds, isNew, onSave, showNotification]);

  const handleHistory = useCallback(() => {
    showNotification('Histórico de versões — em breve.', 'info');
  }, [showNotification]);

  const handleDuplicate = useCallback(() => {
    showNotification('Duplicar workflow — em breve.', 'info');
  }, [showNotification]);

  const handleSaveTrigger = useCallback((nextTrigger) => {
    setDraft((prev) => ({ ...prev, trigger: nextTrigger }));
    setIsEditingTrigger(false);
    showNotification('Gatilho de ativação atualizado.', 'success');
  }, [showNotification]);

  const handleAddStep = useCallback(() => {
    showNotification('Adicionar etapa — em breve.', 'info');
  }, [showNotification]);

  const isActive = draft?.active !== false;
  const title = useMemo(() => draft?.title || 'Workflow', [draft?.title]);

  if (!draft) return null;

  return (
    <div className="config-section-body config-editor config-workflow-editor">
      <button type="button" className="config-action-btn config-action-btn--edit forms-editor-back" onClick={onClose}>
        <i className="ti ti-arrow-left" aria-hidden="true" /> Voltar à lista
      </button>

      <div className="wf-config-shell">
        <WorkflowConfigSidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        <div className="wf-config-main">
          <WorkflowConfigHeader
            title={title}
            titleEditable
            onTitleChange={handleTitleChange}
            active={isActive}
            onToggleActive={handleToggleActive}
            onHistory={handleHistory}
            onDuplicate={handleDuplicate}
            onSave={handleSave}
          />

          <div className="wf-config-panel">
            {activeTab === 'steps' ? (
              <>
                <section className="wf-config-trigger">
                  <h3 className="wf-config-trigger__title">Gatilho de ativação</h3>
                  {isEditingTrigger ? (
                    <WorkflowConfigTriggerEditor
                      trigger={trigger}
                      onSave={handleSaveTrigger}
                      onCancel={() => setIsEditingTrigger(false)}
                    />
                  ) : (
                    <WorkflowConfigTriggerCard
                      trigger={trigger}
                      onEdit={() => setIsEditingTrigger(true)}
                    />
                  )}
                </section>
                <WorkflowConfigStepsTimeline
                  steps={draft.steps}
                  onAddStep={handleAddStep}
                />
              </>
            ) : (
              <div className="wf-config-placeholder">
                <i className="ti ti-tool" aria-hidden="true" />
                <p>{PLACEHOLDER_TABS[activeTab] || 'Em breve.'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
