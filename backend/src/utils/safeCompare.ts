import { timingSafeEqual } from 'crypto';

export function safeCompare(received: string | null | undefined, expected: string): boolean {
  if (!received || !expected) return false;
  const receivedBuf = Buffer.from(received);
  const expectedBuf = Buffer.from(expected);
  if (receivedBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return timingSafeEqual(receivedBuf, expectedBuf);
}
