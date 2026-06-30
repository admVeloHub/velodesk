/**
 * googleAuth.service v1.0.0 — validação id_token Google (tokeninfo)
 * VERSION: v1.0.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */

export interface GoogleTokenPayload {
  email: string;
  name: string;
  picture?: string;
}

export async function verifyGoogleIdToken(
  credential: string,
  expectedClientId: string,
): Promise<GoogleTokenPayload> {
  const token = String(credential || '').trim();
  if (!token) {
    throw new Error('Credencial Google ausente');
  }

  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (!res.ok || !data) {
    throw new Error('Token Google inválido ou expirado');
  }

  const clientId = String(expectedClientId || '').trim();
  if (clientId && data.aud !== clientId) {
    throw new Error('Token Google não corresponde ao client configurado');
  }

  const email = String(data.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('E-mail não encontrado no token Google');
  }

  return {
    email,
    name: String(data.name || email).trim(),
    picture: data.picture ? String(data.picture) : undefined,
  };
}
