/**
 * Tickets — Desk CRM
 * VERSION: v2.2.0 | DATE: 2026-07-15 | AUTHOR: VeloHub Development Team
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import DeskPortal from '../features/desk/DeskPortal';

export default function TicketsPage() {
  const { profileId } = useProfile();

  if (profileId === 'workflow') {
    return <Navigate to="/workflow" replace />;
  }

  return <DeskPortal />;
}
