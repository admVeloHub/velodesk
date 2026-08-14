/** octadeskProtocolo v1.0.0 — número Octadesk → protocolo desk 10 dígitos (zeros à esquerda) */

/**
 * Converte o número puro do Octadesk (ou legado pré-Octa com menos dígitos)
 * para o protocolo desk de 10 dígitos com pad à esquerda.
 *
 * Exemplos:
 * - 100192408 → 0100192408
 * - 123456 → 0000123456
 */
export function toProtocoloDesk(octadeskNumber: number | string): string {
  const digits = String(octadeskNumber ?? '').replace(/\D/g, '');
  if (!digits) {
    throw new Error('número Octadesk vazio');
  }
  if (digits.length > 10) {
    throw new Error(`número Octadesk com mais de 10 dígitos: ${digits}`);
  }
  return digits.padStart(10, '0');
}
