/**
 * Ponte global cockpit ↔ React Router
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { useTickets } from '../context/TicketsContext';
import { installCockpitBridge } from '../utils/cockpitBridge';

export default function CockpitBridge() {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const { openTicket, refreshTickets } = useTickets();

  useEffect(() => {
    installCockpitBridge(navigate, showNotification, { openTicket, refreshTickets });
  }, [navigate, showNotification, openTicket, refreshTickets]);

  return null;
}
