/**
 * Leaderboard operacional — dados demo supervisor
 * VERSION: v1.0.0 | DATE: 2026-06-19
 */

export const LEADERBOARD_SHIFT_OPTIONS = [
  { value: 'all', label: 'Turno: Todos' },
  { value: 'manha', label: 'Turno: Manhã' },
  { value: 'tarde', label: 'Turno: Tarde' },
  { value: 'noite', label: 'Turno: Noite' },
];

export const LEADERBOARD_CHANNEL_OPTIONS = [
  { value: 'all', label: 'Canal: Todos' },
  { value: 'whatsapp', label: 'Canal: WhatsApp' },
  { value: 'email', label: 'Canal: E-mail' },
  { value: 'telefone', label: 'Canal: Telefone' },
];

export const OPERATIONAL_LEADERBOARD = [
  {
    id: 'ana-silva',
    rank: 1,
    name: 'Ana Silva',
    trend: 'up',
    medal: true,
    sla: '98%',
    resolved: 32,
    tma: '3m 12s',
    csat: 9.2,
    vsYesterday: '+5%',
    shift: 'manha',
    channel: 'whatsapp',
  },
  {
    id: 'carlos-mendes',
    rank: 2,
    name: 'Carlos Mendes',
    trend: 'up',
    medal: false,
    sla: '94%',
    resolved: 15,
    tma: '4m 28s',
    csat: 8.4,
    vsYesterday: '+5%',
    shift: 'tarde',
    channel: 'email',
  },
  {
    id: 'julia-costa',
    rank: 3,
    name: 'Julia Costa',
    trend: 'down',
    medal: false,
    sla: '91%',
    resolved: 12,
    tma: '5m 01s',
    csat: 7.8,
    vsYesterday: '-1%',
    shift: 'manha',
    channel: 'telefone',
  },
  {
    id: 'pedro-alves',
    rank: 4,
    name: 'Pedro Alves',
    trend: 'up',
    medal: false,
    sla: '93%',
    resolved: 10,
    tma: '4m 05s',
    csat: 8.1,
    vsYesterday: '+5%',
    shift: 'noite',
    channel: 'whatsapp',
  },
];

export function filterOperationalLeaderboard(entries, { shift = 'all', channel = 'all' } = {}) {
  return entries.filter((entry) => {
    if (shift !== 'all' && entry.shift !== shift) return false;
    if (channel !== 'all' && entry.channel !== channel) return false;
    return true;
  });
}
