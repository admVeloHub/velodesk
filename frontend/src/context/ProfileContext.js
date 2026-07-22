/**
 * ProfileContext v1.6.0 — portal lock por RBAC
 * VERSION: v1.6.0 | DATE: 2026-07-17
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROFILES, getProfileMeta, getProfileDefaultPath, normalizeProfileId } from '../config/profiles';
import { useNotifications } from './NotificationContext';
import { isPortalAllowed, readCachedPermissions, getAllowedProfilePortals } from '../services/permissions/permissionService';

const ProfileContext = createContext(null);

function readInitialProfileId() {
  try {
    const saved = localStorage.getItem('velodeskProfile') || 'agent';
    const id = normalizeProfileId(saved);
    if (id !== saved) localStorage.setItem('velodeskProfile', id);
    localStorage.removeItem('velodesk_profile_locked');
    return id;
  } catch {
    return 'agent';
  }
}

export function ProfileProvider({ children }) {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const [profileId, setProfileIdState] = useState(readInitialProfileId);
  const [profileLocked] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
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

  const applyDefaultPortalFromPermissions = useCallback(() => {
    const perm = readCachedPermissions();
    const allowed = getAllowedProfilePortals(perm);
    const preferred = allowed.includes('gestao') ? 'gestao'
      : allowed.includes('especiais') ? 'especiais'
        : allowed.includes('workflow') ? 'workflow'
          : 'agent';
    const id = normalizeProfileId(preferred);
    localStorage.setItem('velodeskProfile', id);
    setProfileIdState(id);
  }, []);

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

  const applyProfileFromAccess = useCallback((deskProfile) => {
    const perm = readCachedPermissions();
    const fallback = deskProfile === 'supervisor' ? 'gestao' : 'agent';
    const allowed = perm?.portalVisivel || [fallback];
    const id = allowed.includes(fallback) ? fallback : (allowed[0] || 'agent');
    const normalized = normalizeProfileId(id);
    localStorage.setItem('velodeskProfile', normalized);
    localStorage.removeItem('velodesk_profile_locked');
    setProfileIdState(normalized);
    setDropdownOpen(false);
  }, []);

  const setProfile = useCallback((id) => {
    const normalized = normalizeProfileId(id);
    if (!PROFILES[normalized]) {
      setDropdownOpen(false);
      return;
    }
    if (normalized === profileId && normalized !== 'especiais') {
      setDropdownOpen(false);
      return;
    }
    if (!isPortalAllowed(normalized)) {
      showNotification('Sem permissão para a visão: ' + PROFILES[normalized].label, 'warning');
      setDropdownOpen(false);
      return;
    }
    localStorage.setItem('velodeskProfile', normalized);
    setProfileIdState(normalized);
    setDropdownOpen(false);
    showNotification('Perfil alterado: ' + PROFILES[normalized].label, 'success');
    navigate(getProfileDefaultPath(normalized));
  }, [navigate, showNotification, profileId]);

  const toggleDropdown = useCallback(() => {
    setDropdownOpen((v) => !v);
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
