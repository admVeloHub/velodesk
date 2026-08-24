/**
 * emailPreviewHtml v1.3.0 — bloco de estrelas do CSAT só na simulação
 * VERSION: v1.3.0 | DATE: 2026-08-24
 */

const BLUE = '#1634FF';
const FAREWELL_REPLY_HINT =
  'É só responder este e-mail — a sua mensagem chega direto para quem está cuidando do seu caso.';
const FAREWELL_TEXT = 'Estou por aqui para o que você precisar.';
const FAREWELL_SIGN_OFF = 'Time de Atendimento Velotax';

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function plainTextToPreviewHtml(raw) {
  const text = String(raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text.split(/\n{2,}/).map((block) => {
    const safe = escapeHtml(block).replace(/\n/g, '<br>');
    return `<p style="margin:0 0 12px 0;font-size:14px;color:#333;line-height:1.6;">${safe}</p>`;
  }).join('');
}

export function buildTicketBoxPreviewHtml(protocolo, titulo) {
  const safeProtocolo = escapeHtml(protocolo || '0100000001');
  const safeTitulo = escapeHtml(titulo || 'Exemplo de assunto do atendimento');
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;border-collapse:collapse;">
  <tr>
    <td style="background:#f4f6fb;border-left:4px solid ${BLUE};padding:16px 20px;">
      <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;letter-spacing:0.08em;color:#64748b;text-transform:uppercase;">Atendimento</p>
      <p style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BLUE};line-height:1.2;">${safeProtocolo}</p>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">Assunto: ${safeTitulo}</p>
    </td>
  </tr>
</table>`;
}

/**
 * Bloco visual das 5 estrelas do e-mail de CSAT — usado SÓ na simulação.
 * No envio real esse bloco é gerado pelo backend (csatEmail.service.ts,
 * buildCsatStarsHtml) com links de verdade; aqui é só uma representação
 * estática (sem link) para a prévia mostrar como o e-mail final vai ficar.
 */
export function buildCsatStarsPreviewHtml() {
  const stars = [1, 2, 3, 4, 5]
    .map((n) => `<td align="center" valign="top" style="padding:0 4px;">
      <span style="text-decoration:none;display:inline-block;">
        <span style="font-size:32px;line-height:1;color:#FFB800;">★</span>
        <br>
        <span style="font-size:11px;color:#9AA0AE;">${n}</span>
      </span>
    </td>`)
    .join('\n');

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
  <tr><td colspan="5" style="text-align:center;padding:0 0 6px 0;">
    <p style="margin:0;font-size:14px;font-weight:700;color:#272A30;font-family:Arial,sans-serif;">Como foi o seu atendimento?</p>
    <p style="margin:4px 0 12px 0;font-size:12px;color:#9AA0AE;font-family:Arial,sans-serif;">Clique nas estrelas para dar sua nota — de 1 a 5.</p>
  </td></tr>
  <tr>${stars}</tr>
</table>`;
}

export function buildFarewellPreviewHtml(farewellHtml) {
  if (farewellHtml && /<[a-z][\s\S]*>/i.test(String(farewellHtml))) {
    return String(farewellHtml);
  }
  const hint = escapeHtml(FAREWELL_REPLY_HINT);
  const text = escapeHtml(FAREWELL_TEXT);
  const signOff = escapeHtml(FAREWELL_SIGN_OFF);
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0 0;border-collapse:separate;border-spacing:0;">
  <tr>
    <td style="background:#EEF2FF;border:1px solid ${BLUE};border-radius:8px;padding:14px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td valign="top" style="padding:1px 10px 0 0;color:${BLUE};font-size:18px;line-height:1.4;font-weight:700;">&#8617;</td>
          <td style="font-family:Arial,sans-serif;font-size:14px;color:${BLUE};line-height:1.5;">${hint}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<p style="margin:20px 0 8px 0;font-size:14px;color:#333;line-height:1.6;">${text}</p>
<p style="margin:0;font-size:14px;color:#111;font-weight:700;line-height:1.5;">${signOff}</p>`;
}

export function wrapPreviewDocument(innerHtml, headerHtml = '') {
  const headerRow = headerHtml
    ? `<tr><td style="padding:0;">${headerHtml}</td></tr>`
    : '';
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;min-height:100%;background:#f4f6fb;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;min-height:100%;background:#f4f6fb;padding:16px 0;">
    <tr>
      <td align="center" valign="top" style="padding:0 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border-collapse:separate;border-spacing:0;overflow:hidden;">
          ${headerRow}
          <tr>
            <td style="font-family:Arial,sans-serif;line-height:1.6;color:#333;padding:24px;">
              ${innerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>`;
}

export function buildOutboundPreviewHtml({
  headerHtml,
  saudacao,
  corpo,
  farewellHtml,
  signatureHtml,
  protocolo,
  titulo,
  showCsatStars = false,
}) {
  const parts = [
    plainTextToPreviewHtml(saudacao),
    buildTicketBoxPreviewHtml(protocolo, titulo),
    plainTextToPreviewHtml(corpo),
  ];
  if (showCsatStars) parts.push(buildCsatStarsPreviewHtml());
  parts.push(buildFarewellPreviewHtml(farewellHtml));
  if (signatureHtml) {
    parts.push(`<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">${signatureHtml}</div>`);
  }
  return wrapPreviewDocument(parts.join('\n'), headerHtml || '');
}
