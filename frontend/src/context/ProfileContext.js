/**
 * ProfileContext — perfis Agente / Supervisor / Gestão
 * VERSION: v1.0.0 | DATE: 2026-06-18
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
    return PROFILES[saved] ? saved : 'agent';
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const profile = getProfileMeta(profileId);

  useEffect(() => {
    document.body.dataset.velodeskProfile = profileId;
  }, [profileId]);

  const setProfile = useCallback((id) => {
    if (!PROFILES[id]) return;
    localStorage.setItem('velodeskProfile', id);
    setProfileIdState(id);
    setDropdownOpen(false);
    showNotification('Perfil alterado: ' + PROFILES[id].label, 'success');
    const defaultPage = PROFILES[id].defaultPage;
    if (defaultPage === 'tickets') navigate('/tickets?desk=v2');
    else if (defaultPage === 'analytics-ia') navigate('/analytics-ia');
    else navigate('/' + defaultPage);
  }, [navigate, showNotification]);

  const toggleDropdown = useCallback(() => setDropdownOpen((v) => !v), []);

  const isNavAllowed = useCallback((pageId) => profile.nav.indexOf(pageId) >= 0, [profile]);

  return (
    <ProfileContext.Provider value={{
      profileId,
      profile,
      dropdownOpen,
      setProfile,
      toggleDropdown,
      setDropdownOpen,
      isNavAllowed
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
