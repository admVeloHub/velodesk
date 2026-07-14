import React, { useCallback, useMemo, useState } from 'react';
import { useNotifications } from '../../../context/NotificationContext';
import { getWorkflowConfigById } from './workflowConfigData';
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

export default function WorkflowsConfigSection() {
  const { showNotification } = useNotifications();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('reembolso-7dias');
  const [activeTab, setActiveTab] = useState('steps');
  const [isEditingTrigger, setIsEditingTrigger] = useState(false);
  const [triggerOverrides, setTriggerOverrides] = useState({});
  const [activeStates, setActiveStates] = useState(() => ({
    'reembolso-7dias': true,
    cancelamento: false,
    'troca-produto': false,
    'escalada-n2': false,
  }));

  const workflow = useMemo(
    () => getWorkflowConfigById(selectedWorkflowId),
    [selectedWorkflowId],
  );

  const trigger = useMemo(() => {
    const override = triggerOverrides[selectedWorkflowId];
    if (!override) return workflow.trigger;
    return { ...workflow.trigger, ...override };
  }, [selectedWorkflowId, triggerOverrides, workflow.trigger]);

  const isActive = activeStates[selectedWorkflowId] ?? workflow?.active ?? false;

  const handleWorkflowChange = useCallback((workflowId) => {
    setSelectedWorkflowId(workflowId);
    setIsEditingTrigger(false);
  }, []);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    setIsEditingTrigger(false);
  }, []);

  const handleToggleActive = useCallback((value) => {
    setActiveStates((prev) => ({ ...prev, [selectedWorkflowId]: value }));
  }, [selectedWorkflowId]);

  const handleSave = useCallback(() => {
    showNotification('Alterações salvas (modo demonstração).', 'success');
  }, [showNotification]);

  const handleHistory = useCallback(() => {
    showNotification('Histórico de versões — em breve.', 'info');
  }, [showNotification]);

  const handleDuplicate = useCallback(() => {
    showNotification('Duplicar workflow — em breve.', 'info');
  }, [showNotification]);

  const handleEditTrigger = useCallback(() => {
    setIsEditingTrigger(true);
  }, []);

  const handleCancelEditTrigger = useCallback(() => {
    setIsEditingTrigger(false);
  }, []);

  const handleSaveTrigger = useCallback((nextTrigger) => {
    setTriggerOverrides((prev) => ({
      ...prev,
      [selectedWorkflowId]: nextTrigger,
    }));
    setIsEditingTrigger(false);
    showNotification('Gatilho de ativação atualizado.', 'success');
  }, [selectedWorkflowId, showNotification]);

  const handleAddStep = useCallback(() => {
    showNotification('Adicionar etapa — em breve.', 'info');
  }, [showNotification]);

  const handleNewWorkflow = useCallback(() => {
    showNotification('Criar novo workflow — em breve.', 'info');
  }, [showNotification]);

  return (
    <div className="wf-config-shell">
      <WorkflowConfigSidebar
        activeTab={activeTab}
        selectedWorkflowId={selectedWorkflowId}
        onTabChange={handleTabChange}
        onWorkflowChange={handleWorkflowChange}
        onNewWorkflow={handleNewWorkflow}
      />

      <div className="wf-config-main">
        <WorkflowConfigHeader
          title={workflow.title}
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
                    onCancel={handleCancelEditTrigger}
                  />
                ) : (
                  <WorkflowConfigTriggerCard
                    trigger={trigger}
                    onEdit={handleEditTrigger}
                  />
                )}
              </section>
              <WorkflowConfigStepsTimeline
                steps={workflow.steps}
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
  );
}
