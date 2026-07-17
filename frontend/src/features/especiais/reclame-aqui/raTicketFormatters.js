/**
 * raTicketFormatters — formatação compartilhada do ticket RA
 */

export function formatMessageTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return `hoje ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatComplaintDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRaListDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export function getRaSlaClass(item) {
  const tone = item?.slaTone || 'neutral';
  if (tone === 'red') return 'danger';
  if (tone === 'yellow') return 'warning';
  if (tone === 'green') return 'ok';
  return 'neutral';
}

export function getRaSlaLabel(item) {
  const cls = getRaSlaClass(item);
  if (cls === 'danger') return 'Urgente';
  if (cls === 'warning') return 'Atenção';
  if (cls === 'ok') return 'No prazo';
  return '—';
}
