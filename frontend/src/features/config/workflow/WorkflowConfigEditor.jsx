/**
 * WorkflowConfigEditor v2.5.1 — gatilho sem descricao
 * VERSION: v2.5.1 | DATE: 2026-07-15
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNotifications } from '../../../context/NotificationContext';
import { useWorkflowConfig } from '../../../context/WorkflowConfigContext';
import WorkflowConfigHeader from './WorkflowConfigHeader';
import WorkflowConfigSidebar from './WorkflowConfigSidebar';
import WorkflowConfigStepsTimeline from './WorkflowConfigStepsTimeline';
import WorkflowCriteriaEditor from './WorkflowCriteriaEditor';
import {
  createEmptyGatilhoCriterio,
  createEmptyPassoEnvelope,
  normalizeGatilho,
  normalizePassosOrdem,
} from './workflowConfigData';

const PLACEHOLDER_TABS = {
  slas: 'Editor de SLAs e prazos — em breve.',
  notifications: 'Editor de notificações — em breve.',
  automations: 'Editor de automações — em breve.',
};

function cloneDoc(doc) {
  if (!doc) return null;
  return JSON.parse(JSON.stringify(doc));
}

export default function WorkflowConfigEditor({
  workflow: initialWorkflow,
  isNew = false,
  onClose,
  onSave,
}) {
  const { showNotification } = useNotifications();
  const { grupos } = useWorkflowConfig();
  const [draft, setDraft] = useState(() => cloneDoc(initialWorkflow));
  const [activeTab, setActiveTab] = useState('steps');
  const [expandStepId, setExpandStepId] = useState(null);

  useEffect(() => {
    setDraft(cloneDoc(initialWorkflow));
    setActiveTab('steps');
    setExpandStepId(null);
  }, [initialWorkflow]);

  const handleGatilhoCriteriosChange = useCallback((criterios) => {
    setDraft((prev) => ({
      ...prev,
      gatilho: {
        tipo: 'tabulacao',
        criterios,
      },
    }));
  }, []);

  const handleAddGatilhoCriterio = useCallback(() => {
    const criterios = draft?.gatilho?.criterios || [];
    handleGatilhoCriteriosChange([...criterios, createEmptyGatilhoCriterio()]);
  }, [draft?.gatilho?.criterios, handleGatilhoCriteriosChange]);

  const handleSave = useCallback(async () => {
    const titulo = String(draft?.titulo || '').trim();
    if (!titulo) {
      showNotification('Informe o nome do workflow.', 'error');
      return;
    }
    const criterios = draft?.gatilho?.criterios || [];
    if (criterios.some((c) => !String(c.campo || '').trim() || !String(c.valor || '').trim())) {
      showNotification('Complete os critérios do gatilho antes de salvar.', 'error');
      return;
    }
    try {
      await onSave?.({
        ...draft,
        titulo,
        gatilho: normalizeGatilho(draft.gatilho),
        passos: normalizePassosOrdem(draft.passos || []),
      });
      showNotification(isNew ? 'Workflow criado.' : 'Workflow salvo.', 'success');
    } catch {
      showNotification('Erro ao salvar workflow.', 'error');
    }
  }, [draft, isNew, onSave, showNotification]);

  const handleAddStep = useCallback(() => {
    const newStep = createEmptyPassoEnvelope(draft?.passos?.length || 0);
    setDraft((prev) => ({
      ...prev,
      passos: normalizePassosOrdem([...(prev.passos || []), newStep]),
    }));
    setExpandStepId(String(newStep._id));
    showNotification('Nova etapa adicionada.', 'success');
  }, [draft?.passos?.length, showNotification]);

  const handlePassosChange = useCallback((passos) => {
    setDraft((prev) => ({ ...prev, passos: normalizePassosOrdem(passos) }));
  }, []);

  const handleExpandHandled = useCallback(() => {
    setExpandStepId(null);
  }, []);

  if (!draft) return null;

  return (
    <div className="config-section-body config-editor config-workflow-editor">
      <button type="button" className="config-action-btn config-action-btn--edit forms-editor-back" onClick={onClose}>
        <i className="ti ti-arrow-left" aria-hidden="true" /> Voltar à lista
      </button>

      <div className="wf-config-shell">
        <WorkflowConfigSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="wf-config-main">
          <WorkflowConfigHeader
            title={draft.titulo || 'Workflow'}
            titleEditable
            onTitleChange={(value) => setDraft((prev) => ({ ...prev, titulo: value }))}
            description={draft.descricao || ''}
            descriptionEditable
            onDescriptionChange={(value) => setDraft((prev) => ({ ...prev, descricao: value }))}
            active={draft.ativo !== false}
            onToggleActive={(value) => setDraft((prev) => ({ ...prev, ativo: value }))}
            onHistory={() => showNotification('Histórico de versões — em breve.', 'info')}
            onDuplicate={() => showNotification('Duplicar workflow — em breve.', 'info')}
            onSave={handleSave}
          />

          <div className="wf-config-panel">
            {activeTab === 'steps' ? (
              <>
                <section className="wf-config-trigger">
                  <div className="wf-config-trigger__quadro">
                    <div className="wf-config-trigger__head">
                      <h3 className="wf-config-trigger__title">Gatilho de ativação</h3>
                      <button
                        type="button"
                        className="wf-config-trigger__add"
                        onClick={handleAddGatilhoCriterio}
                        aria-label="Adicionar critério"
                        title="Adicionar critério"
                      >
                        <i className="ti ti-plus" aria-hidden="true" />
                      </button>
                    </div>
                    <WorkflowCriteriaEditor
                      mode="gatilho"
                      hideAddButton
                      criterios={draft.gatilho?.criterios || []}
                      onChange={handleGatilhoCriteriosChange}
                    />
                  </div>
                </section>
                <WorkflowConfigStepsTimeline
                  passos={draft.passos || []}
                  grupos={grupos}
                  onPassosChange={handlePassosChange}
                  onAddStep={handleAddStep}
                  expandStepId={expandStepId}
                  onExpandHandled={handleExpandHandled}
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
