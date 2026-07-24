/**
 * WorkflowTeamPicker — seleção Financeiro / Produtos
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getWorkflowTeamActionCounts } from '../../../services/workflow/workflowApprovalData';
import { WORKFLOW_TEAM_QUEUES } from '../../../services/workflow/workflowTeamQueues';

function TeamOptions({ counts, onSelect }) {
  return (
    <div className="wf-team-picker__options" role="listbox" aria-label="Times de workflow">
      {WORKFLOW_TEAM_QUEUES.map((team) => {
        const count = counts[team.id] ?? 0;
        return (
          <button
            key={team.id}
            type="button"
            className="wf-team-picker__option"
            role="option"
            onClick={() => onSelect(team.id)}
          >
            <span className="wf-team-picker__dot" style={{ background: team.dot }} aria-hidden="true" />
            <span className="wf-team-picker__option-body">
              <strong>{team.name}</strong>
              <span>{count} ticket{count === 1 ? '' : 's'} aguardando atuação</span>
            </span>
            <i className="ti ti-chevron-right wf-team-picker__chevron" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

export default function WorkflowTeamPicker({
  variant = 'gate',
  anchorRef,
  open = true,
  onSelect,
  onClose,
}) {
  const [counts, setCounts] = useState(() => getWorkflowTeamActionCounts());
  const [menuStyle, setMenuStyle] = useState(null);

  const refreshCounts = useCallback(() => {
    setCounts(getWorkflowTeamActionCounts());
  }, []);

  useEffect(() => {
    refreshCounts();
    const onRefresh = () => refreshCounts();
    window.addEventListener('velodesk:refresh-tickets', onRefresh);
    window.addEventListener('velodesk:workflow-demo-changed', onRefresh);
    return () => {
      window.removeEventListener('velodesk:refresh-tickets', onRefresh);
      window.removeEventListener('velodesk:workflow-demo-changed', onRefresh);
    };
  }, [refreshCounts]);

  const updateMenuPosition = useCallback(() => {
    const el = anchorRef?.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 10,
      left: rect.left,
      minWidth: Math.max(rect.width, 280),
      zIndex: 10050,
    });
  }, [anchorRef]);

  useEffect(() => {
    if (variant !== 'popover' || !open) return undefined;
    updateMenuPosition();
    const onReflow = () => updateMenuPosition();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [variant, open, updateMenuPosition]);

  const handleSelect = useCallback((teamId) => {
    onSelect?.(teamId);
    onClose?.();
  }, [onClose, onSelect]);

  const content = useMemo(() => (
    <>
      <div className="wf-team-picker__head">
        <h2>Selecione o time</h2>
        <p>Escolha qual fila de workflow deseja atuar agora.</p>
      </div>
      <TeamOptions counts={counts} onSelect={handleSelect} />
    </>
  ), [counts, handleSelect]);

  if (variant === 'gate') {
    return (
      <section className="wf-team-picker wf-team-picker--gate">
        <div className="wf-team-picker__card">
          {content}
        </div>
      </section>
    );
  }

  if (!open || !menuStyle) return null;

  return createPortal(
    <>
      <div
        className="wf-team-picker wf-team-picker--popover open"
        style={menuStyle}
        role="dialog"
        aria-label="Selecionar time de workflow"
      >
        <div className="wf-team-picker__card wf-team-picker__card--compact">
          {content}
        </div>
      </div>
      <button
        type="button"
        className="eco-dropdown-backdrop"
        onClick={onClose}
        aria-label="Fechar seleção de time"
      />
    </>,
    document.body,
  );
}
