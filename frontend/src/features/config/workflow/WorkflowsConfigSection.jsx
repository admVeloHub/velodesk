/**
 * WorkflowsConfigSection v3.0.0 — lista + editor via API
 * VERSION: v3.0.0 | DATE: 2026-07-14
 */
import React, { useCallback, useState } from 'react';
import { workflowApi } from '../../../api/client';
import { useWorkflowConfig } from '../../../context/WorkflowConfigContext';
import { createEmptyWorkflowDocument, createWorkflowSlug } from './workflowConfigData';
import WorkflowConfigEditor from './WorkflowConfigEditor';
import WorkflowsList from './WorkflowsList';

export default function WorkflowsConfigSection() {
  const { reload } = useWorkflowConfig();
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  const loadDoc = useCallback(async (id) => {
    setLoadingDoc(true);
    try {
      const doc = await workflowApi.get(id);
      setEditingDoc(doc);
    } finally {
      setLoadingDoc(false);
    }
  }, []);

  const handleEdit = useCallback(async (workflowId) => {
    setCreating(false);
    setEditingId(workflowId);
    await loadDoc(workflowId);
  }, [loadDoc]);

  const handleCreate = useCallback(() => {
    setEditingId(null);
    setCreating(true);
    setEditingDoc(createEmptyWorkflowDocument());
  }, []);

  const handleCloseEditor = useCallback(() => {
    setCreating(false);
    setEditingId(null);
    setEditingDoc(null);
  }, []);

  const handleSave = useCallback(async (updatedWorkflow) => {
    if (creating) {
      const slug = createWorkflowSlug(updatedWorkflow.titulo);
      await workflowApi.create({ ...updatedWorkflow, slug });
    } else {
      await workflowApi.update(editingId, updatedWorkflow);
    }
    await reload();
    handleCloseEditor();
  }, [creating, editingId, reload, handleCloseEditor]);

  const handleToggleActive = useCallback(async (workflowId, nextActive) => {
    await workflowApi.patch(workflowId, { ativo: nextActive });
    await reload();
  }, [reload]);

  const handleDelete = useCallback(async (workflowId) => {
    await workflowApi.delete(workflowId);
    await reload();
  }, [reload]);

  if (creating || editingId) {
    if (loadingDoc && !editingDoc) {
      return (
        <div className="config-section-body">
          <div className="config-loading" role="status">
            <i className="ti ti-loader-2 config-loading__icon" aria-hidden="true" />
            <span>Carregando workflow…</span>
          </div>
        </div>
      );
    }

    return (
      <WorkflowConfigEditor
        workflow={editingDoc}
        isNew={creating}
        onClose={handleCloseEditor}
        onSave={handleSave}
      />
    );
  }

  return (
    <WorkflowsList
      id="workflowsTab"
      onEdit={handleEdit}
      onCreate={handleCreate}
      onToggleActive={handleToggleActive}
      onDelete={handleDelete}
    />
  );
}
