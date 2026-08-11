import { createHash } from 'crypto';

export function hashTextoClassificacao(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}
