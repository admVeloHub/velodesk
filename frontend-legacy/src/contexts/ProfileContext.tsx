import { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { PROFILES, VelodeskProfile } from '../types';

interface ProfileContextValue {
  profile: VelodeskProfile;
  setProfile: (p: VelodeskProfile) => void;
  allowedNav: string[];
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<VelodeskProfile>(() => {
    return (localStorage.getItem('velodeskProfile') as VelodeskProfile) || 'agent';
  });

  const setProfile = (p: VelodeskProfile) => {
    setProfileState(p);
    localStorage.setItem('velodeskProfile', p);
  };

  const allowedNav = PROFILES[profile].nav;

  const value = useMemo(() => ({ profile, setProfile, allowedNav }), [profile, allowedNav]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile fora de ProfileProvider');
  return ctx;
}
