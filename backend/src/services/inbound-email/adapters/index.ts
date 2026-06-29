/** inbound-email/adapters/index v1.0.0 */
import { env } from '../../../config/env';
import { parseGenericInboundEmail } from './generic.adapter';
import { parseMailgunInboundEmail } from './mailgun.adapter';
import type { InboundEmailPayload } from '../types';

export function parseInboundEmailPayload(body: Record<string, unknown>): InboundEmailPayload {
  const provider = env.inboundEmailProvider;
  if (provider === 'mailgun') return parseMailgunInboundEmail(body);
  return parseGenericInboundEmail(body);
}
