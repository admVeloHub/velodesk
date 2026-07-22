/**
 * Tickets — Desk CRM
 * VERSION: v2.2.0 | DATE: 2026-07-15 | AUTHOR: VeloHub Development Team
 */
import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useDeskV2Mode } from '../hooks/useDeskV2Mode';
import DeskPortal from '../features/desk/DeskPortal';

export default function TicketsPage() {
  const { profileId } = useProfile();
  useDeskV2Mode();
  const [searchParams] = useSearchParams();
  const ticketParam = searchParams.get('ticket');
  const isDeskV2 = searchParams.get('desk') === 'v2';

  if (profileId === 'workflow' && !(ticketParam && isDeskV2)) {
    return <Navigate to="/workflow" replace />;
  }

  return <DeskPortal />;
}
