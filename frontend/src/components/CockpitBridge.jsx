/**
 * Ponte global cockpit ↔ React Router
 * VERSION: v2.1.0 | DATE: 2026-07-13
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { useTickets } from '../context/TicketsContext';
import { useProfile } from '../context/ProfileContext';
import { installCockpitBridge } from '../utils/cockpitBridge';

export default function CockpitBridge() {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const { openTicket, refreshTickets } = useTickets();
  const { profileId } = useProfile();

  useEffect(() => {
    installCockpitBridge(navigate, showNotification, { openTicket, refreshTickets, profileId });
  }, [navigate, showNotification, openTicket, refreshTickets, profileId]);

  return null;
}
