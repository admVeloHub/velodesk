/**
 * ProfileContext v1.3.0 — perfil fixo por allowlist (Google SSO testes)
 * VERSION: v1.3.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROFILES, getProfileMeta } from '../config/profiles';
import { useNotifications } from './NotificationContext';

const ProfileContext = createContext(null);

function readProfileLocked() {
  try {
    return localStorage.getItem('velodesk_profile_locked') === '1';
  } catch {
    return false;
  }
}

export function ProfileProvider({ children }) {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const [profileId, setProfileIdState] = useState(() => {
    const saved = localStorage.getItem('velodeskProfile') || 'agent';
    const id = PROFILES[saved] ? saved : 'agent';
    if (id !== saved) localStorage.setItem('velodeskProfile', id);
    return id;
  });
  const [profileLocked, setProfileLocked] = useState(readProfileLocked);
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
    setProfileLocked(false);
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
    const id = deskProfile === 'supervisor' ? 'supervisor' : 'agent';
    localStorage.setItem('velodeskProfile', id);
    localStorage.setItem('velodesk_profile_locked', '1');
    setProfileIdState(id);
    setProfileLocked(true);
    setDropdownOpen(false);
  }, []);

  const setProfile = useCallback((id) => {
    if (profileLocked) {
      setDropdownOpen(false);
      return;
    }
    if (!PROFILES[id] || id === profileId) {
      setDropdownOpen(false);
      return;
    }
    localStorage.setItem('velodeskProfile', id);
    setProfileIdState(id);
    setDropdownOpen(false);
    showNotification('Perfil alterado: ' + PROFILES[id].label, 'success');
    const defaultPage = PROFILES[id].defaultPage;
    if (defaultPage === 'tickets') navigate('/tickets?desk=v2');
    else if (defaultPage === 'analytics-ia') navigate('/analytics-ia');
    else navigate('/' + defaultPage);
  }, [navigate, showNotification, profileId, profileLocked]);

  const toggleDropdown = useCallback(() => {
    if (profileLocked) return;
    setDropdownOpen((v) => !v);
  }, [profileLocked]);

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
