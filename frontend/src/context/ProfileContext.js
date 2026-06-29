/**
 * ProfileContext v1.2.0 — perfis + segmentação pós-gate (fase 1: agent)
 * VERSION: v1.2.0 | DATE: 2026-06-24 | AUTHOR: VeloHub Development Team
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROFILES, getProfileMeta } from '../config/profiles';
import { useNotifications } from './NotificationContext';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const [profileId, setProfileIdState] = useState(() => {
    const saved = localStorage.getItem('velodeskProfile') || 'agent';
    const id = PROFILES[saved] ? saved : 'agent';
    if (id !== saved) localStorage.setItem('velodeskProfile', id);
    return id;
  });
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

  const setProfile = useCallback((id) => {
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
  }, [navigate, showNotification, profileId]);

  const toggleDropdown = useCallback(() => setDropdownOpen((v) => !v), []);

  const isNavAllowed = useCallback((pageId) => profile.nav.indexOf(pageId) >= 0, [profile]);

  return (
    <ProfileContext.Provider value={{
      profileId,
      profile,
      segmentation,
      dropdownOpen,
      setProfile,
      applyGateProfile,
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
