import fs from 'fs';
const p = '../frontend/src/services/workflow/workflowApprovalData.js';
let lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
if (lines.some(l => l.includes('const timeLabel'))) { console.log('skip'); process.exit(0); }
const idx = lines.findIndex(l => l.includes('const subject = amountLabel'));
lines.splice(idx + 1, 0, '', '  const elapsedLabel = stepStarted?.at ? formatRelativeTime(stepStarted.at) : formatRelativeTime(ticket.updatedAt);', '  const nearSlaExpiry = progress.slaRemainingMs != null && progress.slaRemainingMs < 3600000;', "  const timeCritical = sla === 'critical' || nearSlaExpiry;", '  const timeLabel = timeCritical && progress.slaRemainingLabel', '    ? `vence ${progress.slaRemainingLabel}`', '    : elapsedLabel;');
const elIdx = lines.findIndex(l => l.includes('elapsedLabel: stepStarted'));
lines[elIdx] = '    elapsedLabel,';
lines.splice(elIdx + 1, 0, '    timeLabel,', '    timeCritical,');
fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('done');
