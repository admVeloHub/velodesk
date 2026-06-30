/**
 * ConfigAtivoToggle v1.0.1 — botão booleano Ativo/Inativo (config)
 * VERSION: v1.0.1 | DATE: 2026-06-30
 */
import React from 'react';

export default function ConfigAtivoToggle({ ativo, onChange, disabled = false, className = '' }) {
  const isActive = ativo !== false;

  return (
    <button
      type="button"
      className={
        'config-ativo-toggle'
        + (isActive ? ' config-ativo-toggle--on' : ' config-ativo-toggle--off')
        + (className ? ` ${className}` : '')
      }
      onClick={() => onChange(!isActive)}
      disabled={disabled}
      aria-pressed={isActive}
    >
      {isActive ? 'Ativo' : 'Inativo'}
    </button>
  );
}
