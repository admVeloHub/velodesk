/**
 * ProfileContext v1.5.0 — seletor Agente / Gestão / Workflow
 * VERSION: v1.5.0 | DATE: 2026-07-13 | AUTHOR: VeloHub Development Team
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROFILES, getProfileMeta, getProfileDefaultPath, normalizeProfileId } from '../config/profiles';
import { useNotifications } from './NotificationContext';

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

  const applyGateProfile = useCallback((colaborador) => {
    localStorage.setItem('velodeskProfile', 'agent');
    localStorage.removeItem('velodesk_profile_locked');
    setProfileIdState('agent');
    const meta = colaborador ? {
      atuacao: colaborador.atuacao || [],
      departamento: colaborador.departamento || '',
    } : null;
    if (meta) {
      localStorage.setItem('velodesk_colaborador_meta', JSON.stringify(meta));
      setSegmentation(meta);
    }
  }, []);

  const applyProfileFromAccess = useCallback((deskProfile) => {
    const id = deskProfile === 'supervisor' ? 'gestao' : 'agent';
    localStorage.setItem('velodeskProfile', id);
    localStorage.removeItem('velodesk_profile_locked');
    setProfileIdState(id);
    setDropdownOpen(false);
  }, []);

  const setProfile = useCallback((id) => {
    const normalized = normalizeProfileId(id);
    if (!PROFILES[normalized] || normalized === profileId) {
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
