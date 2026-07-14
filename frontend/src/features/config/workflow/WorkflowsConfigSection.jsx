/**
 * WorkflowsConfigSection v2.0.0 — lista + editor interno de workflow
 * VERSION: v2.0.0 | DATE: 2026-07-14
 */
import React, { useCallback, useMemo, useState } from 'react';
import { cloneWorkflowConfigList, createEmptyWorkflow } from './workflowConfigData';
import WorkflowConfigEditor from './WorkflowConfigEditor';
import WorkflowsList from './WorkflowsList';

export default function WorkflowsConfigSection() {
  const [workflows, setWorkflows] = useState(() => cloneWorkflowConfigList());
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);

  const existingIds = useMemo(() => workflows.map((item) => item.id), [workflows]);

  const handleEdit = useCallback((workflowId) => {
    setCreating(false);
    setEditingId(workflowId);
  }, []);

  const handleCreate = useCallback(() => {
    setEditingId(null);
    setCreating(true);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setCreating(false);
    setEditingId(null);
  }, []);

  const handleSave = useCallback((updatedWorkflow) => {
    setWorkflows((prev) => {
      const index = prev.findIndex((item) => item.id === updatedWorkflow.id);
      if (index >= 0) {
        return prev.map((item) => (item.id === updatedWorkflow.id ? updatedWorkflow : item));
      }
      if (creating) {
        return [...prev, updatedWorkflow];
      }
      return prev;
    });
    setCreating(false);
    setEditingId(null);
  }, [creating]);

  const handleToggleActive = useCallback(async (workflowId, nextActive) => {
    setWorkflows((prev) => prev.map((item) => (
      item.id === workflowId ? { ...item, active: nextActive } : item
    )));
  }, []);

  const handleDelete = useCallback(async (workflowId) => {
    setWorkflows((prev) => prev.filter((item) => item.id !== workflowId));
  }, []);

  if (creating || editingId) {
    const workflow = creating
      ? createEmptyWorkflow()
      : workflows.find((item) => item.id === editingId);

    return (
      <WorkflowConfigEditor
        workflow={workflow}
        isNew={creating}
        existingIds={existingIds}
        onClose={handleCloseEditor}
        onSave={handleSave}
      />
    );
  }

  return (
    <WorkflowsList
      id="workflowsTab"
      workflows={workflows}
      onEdit={handleEdit}
      onCreate={handleCreate}
      onToggleActive={handleToggleActive}
      onDelete={handleDelete}
    />
  );
}
