import fs from 'fs';

// Fix workflowApprovalData.js
const dataPath = 'frontend/src/services/workflow/workflowApprovalData.js';
let d = fs.readFileSync(dataPath, 'utf8');
d = d.replace(/\$\{baseSubject\} [^$]+\$\{amountLabel\}/, '${baseSubject} · ${amountLabel}');
if (!d.includes('timeLabel')) {
  d = d.replace(
    `  return {
    id: String(ticket.id),
    clientName: ticket.clientName || ticket.solicitante || 'Cliente',
    elapsedLabel: stepStarted?.at ? formatRelativeTime(stepStarted.at) : formatRelativeTime(ticket.updatedAt),
    subject,`,
    `  const elapsedLabel = stepStarted?.at ? formatRelativeTime(stepStarted.at) : formatRelativeTime(ticket.updatedAt);
  const nearSlaExpiry = progress.slaRemainingMs != null && progress.slaRemainingMs < 3600000;
  const timeCritical = sla === 'critical' || nearSlaExpiry;
  const timeLabel = timeCritical && progress.slaRemainingLabel
    ? \`vence \${progress.slaRemainingLabel}\`
    : elapsedLabel;

  return {
    id: String(ticket.id),
    clientName: ticket.clientName || ticket.solicitante || 'Cliente',
    elapsedLabel,
    timeLabel,
    timeCritical,
    subject,`
  );
}
fs.writeFileSync(dataPath, d, 'utf8');
console.log('data ok', d.includes('timeLabel'));

// Fix seed 008/009 by line-based edits
const seedPath = 'backend/src/services/workflowTestSeed.service.ts';
let s = fs.readFileSync(seedPath, 'utf8');
const i8 = s.indexOf('WORKFLOW_TEST_PROTOCOL_PREFIX}008');
const i9 = s.indexOf('WORKFLOW_TEST_PROTOCOL_PREFIX}009');
const i10 = s.indexOf('WORKFLOW_TEST_PROTOCOL_PREFIX}004');
if (i8 > -1 && i9 > -1) {
  const block8 = s.slice(i8 - 30, i9);
  if (block8.includes("valor: 249.9") && block8.includes('008')) {
    let nb = block8
      .replace("produto: 'Produto X'", "produto: 'duplicidade'")
      .replace("motivo: 'Reembolso'", "motivo: 'Estorno'")
      .replace("detalhe: 'Dentro de 7 dias'", "detalhe: 'Em análise'")
      .replace('valor: 249.9', 'valor: 89.9')
      .replace(
        'stepActiveHoursAgo: 2.75,\n          approval:',
        "stepActiveHoursAgo: 2.75,\n          tabulacao: { produto: 'duplicidade', motivo: 'Estorno', detalhe: 'Em análise' },\n          approval:"
      );
    s = s.slice(0, i8 - 30) + nb + s.slice(i9);
  }
}
const i9b = s.indexOf('WORKFLOW_TEST_PROTOCOL_PREFIX}009');
const i4b = s.indexOf('WORKFLOW_TEST_PROTOCOL_PREFIX}004');
if (i9b > -1 && i4b > -1) {
  let block9 = s.slice(i9b - 30, i4b);
  block9 = block9
    .replace(/produto: 'Produto X'/g, "produto: 'Produto Y'")
    .replace('valor: 249.9', 'valor: 599')
    .replace('stepActiveHoursAgo: 3.85', 'stepActiveHoursAgo: 3.83')
    .replace(
      'stepActiveHoursAgo: 3.83,\n          approval:',
      "stepActiveHoursAgo: 3.83,\n          tabulacao: { produto: 'Produto Y', motivo: 'Reembolso', detalhe: 'Dentro de 7 dias' },\n          approval:"
    );
  s = s.slice(0, i9b - 30) + block9 + s.slice(i4b);
}
fs.writeFileSync(seedPath, s, 'utf8');
console.log('seed ok');
