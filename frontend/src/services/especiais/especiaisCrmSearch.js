function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function collectSearchValues(item, protocolField) {
  return [
    item.chamadoProtocolo,
    item[protocolField],
    item.ticketId,
    item.id,
    item.cpf,
  ]
    .filter(Boolean)
    .map((value) => String(value));
}

export function matchesTicketCpfSearch(item, query, protocolField = 'protocoloRa') {
  const trimmed = String(query || '').trim();
  if (!trimmed) return true;

  const qLower = trimmed.toLowerCase();
  const qDigits = normalizeDigits(trimmed);
  const values = collectSearchValues(item, protocolField);

  if (values.some((value) => value.toLowerCase().includes(qLower))) {
    return true;
  }

  const cpfDigits = normalizeDigits(item.cpf);
  return qDigits.length >= 3 && cpfDigits.includes(qDigits);
}
