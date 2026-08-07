import fs from 'fs';
const p = '../frontend/src/services/workflow/workflowApprovalData.js';
let d = fs.readFileSync(p, 'utf8');
if (!d.includes('timeLabel')) {
  d = d.replace(
    "  const subject = amountLabel ? `${baseSubject} · ${amountLabel}` : baseSubject;\n\n  return {\n    id: String(ticket.id),\n    clientName: ticket.clientName || ticket.solicitante || 'Cliente',\n    elapsedLabel: stepStarted?.at ? formatRelativeTime(stepStarted.at) : formatRelativeTime(ticket.updatedAt),\n    subject,",
    "  const subject = amountLabel ? `${baseSubject} · ${amountLabel}` : baseSubject;\n\n  const elapsedLabel = stepStarted?.at ? formatRelativeTime(stepStarted.at) : formatRelativeTime(ticket.updatedAt);\n  const nearSlaExpiry = progress.slaRemainingMs != null && progress.slaRemainingMs < 3600000;\n  const timeCritical = sla === 'critical' || nearSlaExpiry;\n  const timeLabel = timeCritical && progress.slaRemainingLabel\n    ? `vence ${progress.slaRemainingLabel}`\n    : elapsedLabel;\n\n  return {\n    id: String(ticket.id),\n    clientName: ticket.clientName || ticket.solicitante || 'Cliente',\n    elapsedLabel,\n    timeLabel,\n    timeCritical,\n    subject,"
  );
  fs.writeFileSync(p, d, 'utf8');
  console.log('patched');
} else console.log('skip');
