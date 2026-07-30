/** emailBrand.util v1.0.0 — header de e-mail (gradiente + logo Velotax) */
import fs from 'fs';
import path from 'path';
import { escapeHtmlAttribute } from './emailHtml.util';

export const EMAIL_BRAND_COLORS = {
  blueDark: '#000058',
  blueMedium: '#1634FF',
  blueOpaque: '#006AB9',
} as const;

export const VELOTAX_LOGO_CID = 'velotax-logo';

function resolveVelotaxLogoPath(): string | null {
  const fileName = 'simbolo_velotax_ajustada_branco.png';
  const candidates = [
    path.join(process.cwd(), 'assets', 'email', fileName),
    path.join(process.cwd(), 'public', fileName),
    path.join(process.cwd(), '..', 'public', fileName),
    path.join(__dirname, '..', '..', 'assets', 'email', fileName),
    path.join(__dirname, '..', '..', '..', 'public', fileName),
    path.join(__dirname, '..', '..', 'public', fileName),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function loadVelotaxLogoInline(): {
  cid: string;
  filename: string;
  contentType: string;
  buffer: Buffer;
} | null {
  const logoPath = resolveVelotaxLogoPath();
  if (!logoPath) {
    console.warn('[emailBrand] logo Velotax não encontrado em public/');
    return null;
  }
  try {
    return {
      cid: VELOTAX_LOGO_CID,
      filename: 'velodesk-brand.png',
      contentType: 'image/png',
      buffer: fs.readFileSync(logoPath),
    };
  } catch (err) {
    console.warn('[emailBrand] falha ao ler logo:', (err as Error).message);
    return null;
  }
}

export function buildEmailHeaderHtml(title: string, withLogo: boolean): string {
  const safeTitle = escapeHtmlAttribute(String(title || '').trim());
  const gradient = `linear-gradient(90deg, ${EMAIL_BRAND_COLORS.blueDark} 0%, ${EMAIL_BRAND_COLORS.blueMedium} 50%, ${EMAIL_BRAND_COLORS.blueOpaque} 100%)`;
  const logoCell = withLogo
    ? `<td style="vertical-align:middle;padding-right:12px;width:40px;">
        <img src="cid:${VELOTAX_LOGO_CID}" alt="Velotax" width="32" height="32" style="display:block;border:0;outline:none;" />
      </td>`
    : `<td style="vertical-align:middle;padding-right:12px;width:40px;">
        <div style="width:32px;height:32px;border-radius:6px;background:rgba(255,255,255,0.15);"></div>
      </td>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;border-collapse:collapse;">
  <tr>
    <td style="background:${EMAIL_BRAND_COLORS.blueDark};background-image:${gradient};padding:16px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          ${logoCell}
          <td style="vertical-align:middle;">
            <h2 style="margin:0;font-size:18px;font-weight:600;color:#ffffff;font-family:Arial,sans-serif;line-height:1.3;">${safeTitle}</h2>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}
