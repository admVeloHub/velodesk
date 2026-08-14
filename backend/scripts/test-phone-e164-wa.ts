/** test-phone-e164-wa.ts v1.0.0 — sanity check normalização WhatsApp BR */
import { normalizePhoneE164 } from '../src/services/telephonyRecado.validation';

const cases = [
  ['11966153419', '+5511966153419'],
  ['15997995634', '+5515997995634'],
  ['5515992382865', '+5515992382865'],
  ['+5515992382865', '+5515992382865'],
  ['(15) 99979-5634', '+5515997995634'],
];

let ok = true;
for (const [input, expected] of cases) {
  const got = normalizePhoneE164(input);
  const pass = got === expected;
  if (!pass) ok = false;
  console.log(`${pass ? 'OK' : 'FAIL'} ${input} => ${got} (expected ${expected})`);
}

process.exit(ok ? 0 : 1);
