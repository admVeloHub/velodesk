/**
 * DefaultLandingRedirect v1.0.0 — rota inicial por perfil (Painel 360°)
 * VERSION: v1.0.0 | DATE: 2026-07-02 | AUTHOR: VeloHub Development Team
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { getProfileDefaultPath } from '../config/profiles';

export default function DefaultLandingRedirect() {
  const { profileId } = useProfile();
  return <Navigate to={getProfileDefaultPath(profileId)} replace />;
}
