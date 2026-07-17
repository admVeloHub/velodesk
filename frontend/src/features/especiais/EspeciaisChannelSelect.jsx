/**
 * EspeciaisChannelSelect — grid de canais do perfil Especiais
 */
import React from 'react';
import { ESPECIAIS_CHANNELS } from '../../config/especiaisChannels';

export default function EspeciaisChannelSelect({ onSelect, inWorkspace = false }) {
  const rootClass = [
    'especiais-channel-select',
    inWorkspace ? 'especiais-channel-select--in-workspace' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      <header className="especiais-page__header">
        <span className="especiais-page__eyebrow">Perfil Especiais</span>
        <h2 className="especiais-page__title">Selecione o canal</h2>
        <p className="especiais-page__subtitle">
          Escolha a visão operacional para atendimentos de canais especiais.
        </p>
      </header>

      <div className="especiais-channel-grid">
        {ESPECIAIS_CHANNELS.map((channel) => (
          <button
            key={channel.id}
            type="button"
            className="especiais-channel-card"
            onClick={() => onSelect?.(channel.id)}
          >
            <span
              className="especiais-channel-card__icon"
              style={{ '--especiais-accent': channel.color }}
            >
              <i className={`ti ${channel.icon}`} aria-hidden="true" />
            </span>
            <span className="especiais-channel-card__label">{channel.label}</span>
            <span className="especiais-channel-card__desc">{channel.desc}</span>
            <span className="especiais-channel-card__cta">
              Entrar
              <i className="ti ti-arrow-right" aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
