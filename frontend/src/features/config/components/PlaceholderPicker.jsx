/**
 * PlaceholderPicker v1.0.0 — seletor de placeholders padronizados (nome do cliente,
 * agente, número/produto do ticket, datas) para inserir em e-mails de saída e prompts
 * de devolutiva do workflow. Espelha backend/src/services/placeholders.util.ts —
 * manter os tokens em sincronia com o catálogo de lá.
 */
import React from 'react';

export const PLACEHOLDER_OPTIONS = [
  { token: '{nomeCliente}', label: 'Nome do cliente' },
  { token: '{nomeAgente}', label: 'Nome do agente responsável' },
  { token: '{numeroTicket}', label: 'Número do ticket' },
  { token: '{produtoTicket}', label: 'Produto do ticket' },
  { token: '{dataAbertura}', label: 'Data de abertura do ticket' },
  { token: '{dataAtual}', label: 'Data atual' },
];

/** Insere `token` na posição do cursor do textarea referenciado e devolve o novo valor via `onChange`. */
export function insertPlaceholderAtCursor(textareaRef, currentValue, token, onChange) {
  const value = currentValue || '';
  const el = textareaRef?.current;
  if (!el) {
    onChange(`${value}${token}`);
    return;
  }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    const cursor = start + token.length;
    el.setSelectionRange(cursor, cursor);
  });
}

export default function PlaceholderPicker({ onInsert, className = '' }) {
  return (
    <select
      className={`config-placeholder-picker${className ? ` ${className}` : ''}`}
      value=""
      onChange={(e) => {
        const token = e.target.value;
        if (token) onInsert(token);
        e.target.value = '';
      }}
      aria-label="Inserir placeholder"
      title="Inserir placeholder"
    >
      <option value="">+ Inserir placeholder…</option>
      {PLACEHOLDER_OPTIONS.map((opt) => (
        <option key={opt.token} value={opt.token}>{opt.label} — {opt.token}</option>
      ))}
    </select>
  );
}
