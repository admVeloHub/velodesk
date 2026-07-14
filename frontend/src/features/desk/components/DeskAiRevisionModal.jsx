/**
 * DeskAiRevisionModal v1.0.0 — revisão de sugestão IA com input do operador
 * VERSION: v1.0.0 | DATE: 2026-07-13
 */
import React, { useState } from 'react';

export default function DeskAiRevisionModal({
  open,
  auditScore,
  onClose,
  onSubmit,
  submitting = false,
}) {
  const [input, setInput] = useState('');

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    const result = await onSubmit(trimmed);
    if (result?.success) {
      setInput('');
      onClose();
    }
  };

  return (
    <div className="desk-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="desk-modal desk-ai-revision-modal"
        role="dialog"
        aria-labelledby="deskAiRevisionTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="deskAiRevisionTitle">Solicitar revisão da IA</h3>
        {typeof auditScore === 'number' && (
          <p className="desk-ai-revision-modal__score">
            Conformidade atual: <strong>{auditScore}%</strong>
          </p>
        )}
        <p className="desk-ai-revision-modal__hint">
          Descreva o que deve ser ajustado na resposta sugerida. Seu feedback será usado no treinamento do agente.
        </p>
        <form onSubmit={handleSubmit}>
          <textarea
            className="desk-ai-revision-modal__input"
            rows={5}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex.: O cliente perguntou sobre prazo de 5 dias, não 3."
            disabled={submitting}
          />
          <div className="desk-ai-revision-modal__actions">
            <button type="button" className="desk-modal-btn desk-modal-btn--secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="desk-modal-btn desk-modal-btn--primary" disabled={submitting || !input.trim()}>
              {submitting ? 'Revisando…' : 'Solicitar revisão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
