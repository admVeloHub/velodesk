/**
 * DeskAccessDenied v1.0.0 — acesso negado ao Desk
 * VERSION: v1.0.0 | DATE: 2026-06-24 | AUTHOR: VeloHub Development Team
 */
import React from 'react';

const shellStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#F3F4F8',
  padding: '2rem',
};

const cardStyle = {
  maxWidth: 440,
  width: '100%',
  background: '#fff',
  border: '0.5px solid #E4E6EA',
  borderRadius: 12,
  padding: '2rem',
  textAlign: 'center',
};

export default function DeskAccessDenied({ title, message, variant = 'denied' }) {
  const isInvalid = variant === 'invalid';
  const heading = title || (isInvalid ? 'Sessão inválida' : 'Acesso negado ao Desk');
  const body = message || (isInvalid
    ? 'Sua sessão expirou ou não foi encontrada. Acesse o Desk pelo VeloHub.'
    : 'Seu usuário não possui permissão para acessar o Desk. Solicite liberação ao administrador.');

  return (
    <div className="desk-gate-page desk-gate-page--denied" style={shellStyle}>
      <div style={cardStyle}>
        <div style={{
          width: 48,
          height: 48,
          margin: '0 auto 1rem',
          borderRadius: '50%',
          background: isInvalid ? '#FFF8E1' : '#FEE2E2',
          color: isInvalid ? '#854d0e' : '#b91c1c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
        }}
        >
          <i className={'ti ' + (isInvalid ? 'ti-clock-off' : 'ti-lock')} aria-hidden="true" />
        </div>
        <h1 style={{ margin: '0 0 .5rem', color: '#000058', fontSize: '1.25rem' }}>{heading}</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '.9rem', lineHeight: 1.5 }}>{body}</p>
      </div>
    </div>
  );
}
