/**
 * DeskLoginPage v1.3.1 — aviso sessão expirada (?session=expired)
 * VERSION: v1.3.1 | DATE: 2026-07-15 | AUTHOR: VeloHub Development Team
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { getGoogleClientId } from '../../config/googleAuthConfig';
import { getProfileDefaultPath, normalizeProfileId } from '../../config/profiles';
import { fetchMyPermissions } from '../../services/permissions/permissionService';
import { isGoogleDeskAuthMode } from '../../config/deskAuthMode';
import { DEV_QUICK_LOGIN_EMAIL, isDevQuickLoginEnabled } from '../../config/devAuth';
import { loadGoogleGsiScript } from '../../utils/loadGoogleGsiScript';
import DeskLoadingGate from './DeskLoadingGate';
import DeskAccessDenied from './DeskAccessDenied';
import DevQuickLoginButton from './DevQuickLoginButton';
import {
  DEV_LOGIN_RETRY_MS,
  isDevLoginRetryableError,
  resolveDevLoginError,
} from './devLoginHelpers';
import './desk-login.css';

function getGoogleButtonWidth(containerEl) {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 360;
  const viewportSafeWidth = Math.max(240, Math.min(viewportWidth - 48, 420));
  if (!containerEl?.getBoundingClientRect) return viewportSafeWidth;
  const width = Math.round(containerEl.getBoundingClientRect().width || 0);
  if (!width) return viewportSafeWidth;
  return Math.max(240, Math.min(width, viewportSafeWidth));
}

function resolveLoginError(err) {
  const status = err?.response?.status;
  const apiMsg = String(err?.response?.data?.message || '').trim();

  if (status === 503 || /mongodb|banco de dados/i.test(apiMsg)) {
    return 'Aguardando o backend conectar ao banco de dados. Tente novamente em alguns segundos.';
  }
  if (status === 403) {
    return 'Usuário sem permissão para acessar o Desk.';
  }
  if (status === 429) {
    return 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.';
  }
  if (status === 401 && apiMsg) {
    return apiMsg;
  }
  if (apiMsg) return apiMsg;
  return err?.message || 'Não foi possível entrar com Google.';
}

function getPostLoginPath(location, profileId) {
  const from = location?.state?.from;
  if (from?.pathname) {
    return `${from.pathname}${from.search || ''}`;
  }
  return getProfileDefaultPath(profileId);
}

export default function DeskLoginPage() {
  const useGoogleMode = isGoogleDeskAuthMode();
  const navigate = useNavigate();
  const location = useLocation();
  const { authStatus, bootstrapFromGoogleLogin, isAuthenticated } = useAuth();
  const { applyProfileFromAccess, profileId, applyDefaultPortalFromPermissions } = useProfile();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const buttonRef = useRef(null);
  const initializedRef = useRef(false);
  const devLoginAttemptedRef = useRef(false);
  const clientId = getGoogleClientId();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('session') === 'expired') {
      setError('Sessão expirada ou inválida. Entre novamente com Google.');
    }
  }, [location.search]);

  const completeLogin = useCallback(async (data) => {
    if (!data?.token || !data?.user) {
      throw new Error('Resposta de autenticação inválida.');
    }
    await bootstrapFromGoogleLogin(data);
    await fetchMyPermissions().catch(() => null);
    const deskProfile = data.user.deskProfile || data.user.role;
    applyProfileFromAccess(deskProfile);
    applyDefaultPortalFromPermissions();
    const profile = normalizeProfileId(localStorage.getItem('velodeskProfile') || 'agent');
    navigate(getPostLoginPath(location, profile), { replace: true });
  }, [applyProfileFromAccess, applyDefaultPortalFromPermissions, bootstrapFromGoogleLogin, location, navigate]);

  const handleCredential = useCallback(async (response) => {
    setLoading(true);
    setError('');
    try {
      const data = await authApi.googleLogin(response.credential);
      await completeLogin(data);
    } catch (err) {
      setError(resolveLoginError(err));
    } finally {
      setLoading(false);
    }
  }, [completeLogin]);

  const mountGoogleButton = useCallback(() => {
    if (!window.google?.accounts?.id || !buttonRef.current || !clientId) return;
    try {
      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: getGoogleButtonWidth(buttonRef.current),
      });
    } catch (err) {
      console.warn('Google renderButton:', err);
    }
  }, [clientId]);

  useEffect(() => {
    if (!useGoogleMode || !clientId) return undefined;

    let cancelled = false;
    loadGoogleGsiScript()
      .then(() => {
        if (cancelled || initializedRef.current) return;
        initializedRef.current = true;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        setGsiReady(true);
        mountGoogleButton();
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Falha ao carregar login Google.');
      });

    return () => { cancelled = true; };
  }, [useGoogleMode, clientId, handleCredential, mountGoogleButton]);

  useEffect(() => {
    if (!isDevQuickLoginEnabled() || clientId || isAuthenticated) return undefined;
    if (devLoginAttemptedRef.current) return undefined;

    let active = true;
    let retryTimer = null;
    devLoginAttemptedRef.current = true;

    const attemptDevLogin = async () => {
      if (!active) return;
      setLoading(true);
      setError('');
      try {
        const data = await authApi.devLogin(DEV_QUICK_LOGIN_EMAIL);
        if (!active) return;
        await completeLogin(data);
      } catch (err) {
        if (!active) return;
        const message = resolveDevLoginError(err);
        setError(message);
        if (isDevLoginRetryableError(err)) {
          retryTimer = window.setTimeout(attemptDevLogin, DEV_LOGIN_RETRY_MS);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void attemptDevLogin();

    return () => {
      active = false;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [clientId, completeLogin, isAuthenticated]);

  useEffect(() => {
    if (!gsiReady) return undefined;
    const onResize = () => mountGoogleButton();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [gsiReady, mountGoogleButton]);

  if (!useGoogleMode) {
    return <DeskLoadingGate />;
  }

  if (authStatus === 'authorized' || isAuthenticated) {
    return <Navigate to={getPostLoginPath(location, profileId)} replace />;
  }

  if (!clientId) {
    if (isDevQuickLoginEnabled()) {
      return (
        <div className="desk-login-page">
          <div className="desk-login-card">
            <div className="desk-login-brand">
              <span className="desk-login-brand__mark">Velodesk</span>
            </div>
            <p className="desk-login-dev-hint">
              Ambiente local sem Google OAuth — use o login rápido de desenvolvimento.
            </p>
            {loading ? <p className="desk-login-loading">Entrando no Desk…</p> : null}
            {error ? (
              <div className="desk-login-error" role="alert">
                <i className="ti ti-alert-circle" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>
          <DevQuickLoginButton />
        </div>
      );
    }

    return (
      <DeskAccessDenied
        title="Login não configurado"
        message="Defina GOOGLE_CLIENT_ID ou VITE_GOOGLE_CLIENT_ID em FONTE DA VERDADE/.env-velodesk e reinicie o frontend."
      />
    );
  }

  return (
    <div className="desk-login-page">
      <div className="desk-login-card">
        <div className="desk-login-brand">
          <span className="desk-login-brand__mark">Velodesk</span>
        </div>

        {error ? (
          <div className="desk-login-error" role="alert">
            <i className="ti ti-alert-circle" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="desk-login-google-wrap">
          <div ref={buttonRef} id="desk-google-signin-button" />
          {loading ? <p className="desk-login-loading">Validando acesso…</p> : null}
        </div>
      </div>

      <DevQuickLoginButton />
    </div>
  );
}
