/**
 * ClientThermoGauge v1.0.0 — dial circular compacto (header do ticket)
 * VERSION: v1.0.0 | DATE: 2026-07-03
 */
import React from 'react';

function resolveThermo(client) {
  const score = client?.termometro ?? 38;
  const label = client?.termometroLabel || (score >= 55 ? 'Crítico' : score >= 45 ? 'Atenção' : 'Estável');
  const color = score >= 55 ? '#FCC200' : score >= 45 ? '#FCC200' : '#15A237';
  return { score, label, color };
}

export default function ClientThermoGauge({ client }) {
  const { score, label, color } = resolveThermo(client);

  return (
    <div
      className="profile-thermo-gauge"
      id="profileThermoGauge"
      style={{ '--thermo-color': color, '--thermo-score': score }}
      title={`Termômetro do cliente: ${score} — ${label}`}
      aria-label={`Termômetro do cliente: ${score}, ${label}`}
    >
      <span className="profile-thermo-gauge__ring" aria-hidden="true" />
      <span className="profile-thermo-gauge__center">
        <span className="profile-thermo-gauge__value">{score}</span>
      </span>
    </div>
  );
}
