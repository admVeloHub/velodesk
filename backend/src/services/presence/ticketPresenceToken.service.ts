/** ticketPresenceToken.service v1.0.0 — JWT (HS256) compatível com Supabase Realtime Authorization */
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import type { AuthPayload } from '../../middleware/auth';

export interface TicketPresenceToken {
  token: string;
  expiresAt: string;
}

export function isTicketPresenceConfigured(): boolean {
  return Boolean(env.ticketPresenceJwtSecret);
}

/**
 * Assina um JWT com o JWT Secret do projeto Supabase (Settings → API → JWT Settings).
 * O Supabase Realtime aceita qualquer JWT assinado com esse segredo, mesmo vindo de um
 * auth provider próprio — não é necessário usar o Supabase Auth para autorizar canais privados.
 */
export function mintTicketPresenceToken(authUser: AuthPayload): TicketPresenceToken {
  if (!isTicketPresenceConfigured()) {
    throw new Error('PRESENCE_REALTIME_JWT_SECRET não configurado');
  }

  const ttlSec = env.ticketPresenceTokenTtlSec;
  const nowSec = Math.floor(Date.now() / 1000);

  const token = jwt.sign(
    {
      role: 'authenticated',
      sub: String(authUser.userId),
      email: authUser.email,
      name: authUser.name || authUser.email,
      iat: nowSec,
      exp: nowSec + ttlSec,
    },
    env.ticketPresenceJwtSecret,
  );

  return {
    token,
    expiresAt: new Date((nowSec + ttlSec) * 1000).toISOString(),
  };
}
