/**
 * DevQuickLoginButton v1.1.0 — login direto dev + landing Painel 360°
 * VERSION: v1.1.0 | DATE: 2026-07-02 | AUTHOR: VeloHub Development Team
 */
import React, { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/client';
import { DEV_QUICK_LOGIN_EMAIL, isDevQuickLoginEnabled } from '../../config/devAuth';
import { getProfileDefaultPath } from '../../config/profiles';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';

function getPostLoginPath(location, profileId) {
  const from = location?.state?.from;
  if (from?.pathname) {
    return `${from.pathname}${from.search || ''}`;
  }
  return getProfileDefaultPath(profileId);
}

export default function DevQuickLoginButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { bootstrapFromGoogleLogin, isAuthenticated } = useAuth();
  const { applyProfileFromAccess } = useProfile();
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (loading || isAuthenticated) return;

    setLoading(true);
    try {
      const data = await authApi.devLogin(DEV_QUICK_LOGIN_EMAIL);
      if (!data?.token || !data?.user) {
        throw new Error('Resposta de autenticação inválida.');
      }
      await bootstrapFromGoogleLogin(data);
      const deskProfile = data.user.deskProfile || data.user.role;
      applyProfileFromAccess(deskProfile);
      navigate(getPostLoginPath(location, deskProfile), { replace: true });
    } catch (err) {
      console.error('[DevQuickLogin]', err?.response?.data?.message || err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [applyProfileFromAccess, bootstrapFromGoogleLogin, isAuthenticated, loading, location, navigate]);

  if (!isDevQuickLoginEnabled()) return null;

  return (
    <button
      type="button"
      className={`dev-quick-login-btn${loading ? ' dev-quick-login-btn--loading' : ''}`}
      onClick={handleClick}
      disabled={loading}
      title="Dev: login direto"
      aria-label="Dev: login direto"
    />
  );
}
