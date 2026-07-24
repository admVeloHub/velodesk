/**
 * ProfileContext v2.0.0 — visão fixa por RBAC (sem troca manual)
 * VERSION: v2.0.0 | DATE: 2026-07-23 | AUTHOR: VeloHub Development Team
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getProfileMeta, getProfileDefaultPath, normalizeProfileId } from '../config/profiles';
import { usePermissions } from './PermissionContext';
import {
  readCachedPermissions,
  getAllowedProfilePortals,
  resolvePreferredProfilePortal,
  resolveProfilePortalForPermissions,
  isWorkflowOnlyPermissions,
} from '../services/permissions/permissionService';

const ProfileContext = createContext(null);

function readInitialProfileId() {
  try {
    localStorage.removeItem('velodesk_profile_locked');
    const perm = readCachedPermissions();
    if (perm) {
      const saved = localStorage.getItem('velodeskProfile') || 'agent';
      const id = normalizeProfileId(resolveProfilePortalForPermissions(perm, saved));
      localStorage.setItem('velodeskProfile', id);
      return id;
    }
    const saved = localStorage.getItem('velodeskProfile') || 'agent';
    const id = normalizeProfileId(saved);
    if (id !== saved) localStorage.setItem('velodeskProfile', id);
    return id;
  } catch {
    return 'agent';
  }
}

export function ProfileProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { permissions } = usePermissions();
  const [profileId, setProfileIdState] = useState(readInitialProfileId);
  const profileLocked = true;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const portalSyncedRef = useRef(false);
  const [segmentation, setSegmentation] = useState(() => {
    try {
      const raw = localStorage.getItem('velodesk_colaborador_meta');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const profile = getProfileMeta(profileId);

  useEffect(() => {
    document.body.dataset.velodeskProfile = profileId;
  }, [profileId]);

  const applyDefaultPortalFromPermissions = useCallback((permOverride) => {
    const perm = permOverride || readCachedPermissions();
    if (!perm) return profileId;

    const next = normalizeProfileId(resolveProfilePortalForPermissions(perm, profileId));

    if (next !== profileId) {
      localStorage.setItem('velodeskProfile', next);
      setProfileIdState(next);
    }
    return next;
  }, [profileId]);

  useEffect(() => {
    if (!permissions) return;

    const current = normalizeProfileId(profileId);
    const next = normalizeProfileId(resolveProfilePortalForPermissions(permissions, current));

    if (next === current) {
      portalSyncedRef.current = true;
      return;
    }

    localStorage.setItem('velodeskProfile', next);
    setProfileIdState(next);
    portalSyncedRef.current = true;

    const path = location.pathname;
    const shouldRedirect = path === '/'
      || (next === 'workflow' && current === 'agent' && (
        path === '/workspace' || path.startsWith('/tickets')
      ));
    if (shouldRedirect) {
      navigate(getProfileDefaultPath(next), { replace: true });
    }
  }, [permissions, profileId, navigate, location.pathname]);

  const applyGateProfile = useCallback((colaborador) => {
    applyDefaultPortalFromPermissions();
    localStorage.removeItem('velodesk_profile_locked');
    const meta = colaborador ? {
      atuacao: colaborador.atuacao || [],
      departamento: colaborador.departamento || '',
    } : null;
    if (meta) {
      localStorage.setItem('velodesk_colaborador_meta', JSON.stringify(meta));
      setSegmentation(meta);
    }
  }, [applyDefaultPortalFromPermissions]);

  const applyProfileFromAccess = useCallback((_deskProfile) => {
    const perm = readCachedPermissions();
    const allowed = getAllowedProfilePortals(perm);
    const preferred = resolvePreferredProfilePortal(allowed);
    const normalized = normalizeProfileId(
      isWorkflowOnlyPermissions(perm) && allowed.includes('workflow')
        ? 'workflow'
        : resolveProfilePortalForPermissions(perm, preferred),
    );
    localStorage.setItem('velodeskProfile', normalized);
    setProfileIdState(normalized);
    setDropdownOpen(false);
  }, []);

  const setProfile = useCallback(() => {
    setDropdownOpen(false);
  }, []);

  const toggleDropdown = useCallback(() => {
    setDropdownOpen(false);
  }, []);

  const isNavAllowed = useCallback((pageId) => profile.nav.indexOf(pageId) >= 0, [profile]);

  return (
    <ProfileContext.Provider value={{
      profileId,
      profile,
      segmentation,
      profileLocked,
      dropdownOpen,
      setProfile,
      applyGateProfile,
      applyProfileFromAccess,
      applyDefaultPortalFromPermissions,
      toggleDropdown,
      setDropdownOpen,
      isNavAllowed,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile requires ProfileProvider');
  return ctx;
}
