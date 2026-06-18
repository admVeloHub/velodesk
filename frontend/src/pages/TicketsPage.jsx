/**
 * Tickets — Desk CRM ou kanban
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import React from 'react';
import { useDeskV2Mode } from '../hooks/useDeskV2Mode';
import DeskPortal from '../features/desk/DeskPortal';
import KanbanBoard from '../features/tickets/KanbanBoard';

export default function TicketsPage() {
  const isDeskV2 = useDeskV2Mode();
  if (isDeskV2) return <DeskPortal />;
  return <KanbanBoard />;
}
