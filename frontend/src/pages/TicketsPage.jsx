/**
 * Tickets — Desk CRM ou kanban
 * VERSION: v2.1.0 | DATE: 2026-07-13
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useDeskV2Mode } from '../hooks/useDeskV2Mode';
import { useProfile } from '../context/ProfileContext';
import DeskPortal from '../features/desk/DeskPortal';
import KanbanBoard from '../features/tickets/KanbanBoard';

export default function TicketsPage() {
  const { profileId } = useProfile();
  const isDeskV2 = useDeskV2Mode();

  if (profileId === 'workflow') {
    return <Navigate to="/workflow" replace />;
  }

  if (isDeskV2) return <DeskPortal />;
  return <KanbanBoard />;
}
