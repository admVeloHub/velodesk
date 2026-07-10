/**
 * Visão por canal — painel supervisor
 * VERSION: v2.1.0 | DATE: 2026-07-06
 */
import React from 'react';

export default function Workspace360ChannelVision({ channels = [] }) {
  return (
    <div className="ws360-channel-vision">
      <header className="ws360-channel-vision__head">
        <span className="ws360-channel-vision__icon" aria-hidden="true">
          <i className="ti ti-stack-2" />
        </span>
        <h4 className="ws360-channel-vision__title">Visão por canal</h4>
      </header>

      <div className="ws360-channel-vision__cards">
        {channels.map((channel) => (
          <article key={channel.id} className="ws360-channel-vision__card">
            <span className="ws360-channel-vision__label">{channel.label}</span>
            <strong className="ws360-channel-vision__count">
              {channel.tickets ?? '—'}{' '}
              <span className="ws360-channel-vision__count-unit">tickets</span>
            </strong>
            <span className="ws360-channel-vision__sla">
              SLA {channel.sla != null ? `${channel.sla}%` : '—'}
            </span>
            {channel.highVolume ? (
              <span className="ws360-channel-vision__alert" role="status">
                <i className="ti ti-alert-triangle" aria-hidden="true" />
                Alto volume
              </span>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
