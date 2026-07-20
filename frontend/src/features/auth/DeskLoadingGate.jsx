/**
 * DeskLoadingGate v1.1.0 — validação sessão VeloHub + landing Painel 360°
 * VERSION: v1.1.0 | DATE: 2026-07-02 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { GATE_STATUS, runDeskAccessGate } from '../../services/deskAccessGate';
import { getProfileDefaultPath, normalizeProfileId } from '../../config/profiles';
import { fetchMyPermissions } from '../../services/permissions/permissionService';
import DeskAccessDenied from './DeskAccessDenied';

const shellStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#F3F4F8',
  gap: '1rem',
};

export default function DeskLoadingGate() {
  const { authStatus, bootstrapFromGate } = useAuth();
  const { applyGateProfile, applyDefaultPortalFromPermissions } = useProfile();
  const [phase, setPhase] = useState('loading');
  const [reason, setReason] = useState('');
  const [landingPath, setLandingPath] = useState('/workspace');

  useEffect(() => {
    if (authStatus === 'authorized') return;

    let cancelled = false;
    (async () => {
      setPhase('loading');
      const result = await runDeskAccessGate();
      if (cancelled) return;

      if (result.status === GATE_STATUS.AUTHORIZED) {
        try {
          await bootstrapFromGate(result);
          await fetchMyPermissions().catch(() => null);
          applyGateProfile(result.colaborador);
          applyDefaultPortalFromPermissions();
          const profileId = normalizeProfileId(localStorage.getItem('velodeskProfile') || 'agent');
          setLandingPath(getProfileDefaultPath(profileId));
          setPhase('authorized');
        } catch (err) {
          setReason(err?.message || 'Não foi possível conectar ao backend do Desk.');
          setPhase(GATE_STATUS.ERROR);
        }
        return;
      }

      setReason(result.reason || '');
      setPhase(result.status);
    })();

    return () => { cancelled = true; };
  }, [authStatus, bootstrapFromGate, applyGateProfile, applyDefaultPortalFromPermissions]);

  if (authStatus === 'authorized' || phase === 'authorized') {
    return <Navigate to={landingPath} replace />;
  }

  if (phase === GATE_STATUS.ACCESS_DENIED) {
    return <DeskAccessDenied message={reason} />;
  }

  if (phase === GATE_STATUS.SESSION_INVALID) {
    return <DeskAccessDenied variant="invalid" message={reason} />;
  }

  if (phase === GATE_STATUS.ERROR) {
    return (
      <div className="desk-gate-page desk-gate-page--error" style={shellStyle}>
        <DeskAccessDenied
          title="Erro ao validar acesso"
          message={reason || 'Não foi possível consultar o VeloHub. Tente novamente.'}
        />
        <button
          type="button"
          className="btn-primary"
          style={{ marginTop: '-1rem' }}
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="desk-gate-page desk-gate-page--loading" style={shellStyle} role="status" aria-live="polite">
      <div style={{
        width: 40,
        height: 40,
        border: '3px solid #E4E6EA',
        borderTopColor: '#1634FF',
        borderRadius: '50%',
        animation: 'desk-gate-spin 0.8s linear infinite',
      }}
      />
      <p style={{ margin: 0, color: '#6b7280', fontSize: '.95rem' }}>Validando acesso ao Desk…</p>
      <style>{'@keyframes desk-gate-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}
