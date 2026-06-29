/**
 * keyboardDistance v1.0.0 — proximidade de teclas ABNT2 para ranking de sugestões
 * VERSION: v1.0.0 | DATE: 2026-06-26
 */

/** @type {Record<string, string[]>} */
const ABNT2_NEIGHBORS = {
  q: ['w', 'a', '1', '2'],
  w: ['q', 'e', 's', 'a', '2', '3'],
  e: ['w', 'r', 'd', 's', '3', '4'],
  r: ['e', 't', 'f', 'd', '4', '5'],
  t: ['r', 'y', 'g', 'f', '5', '6'],
  y: ['t', 'u', 'h', 'g', '6', '7'],
  u: ['y', 'i', 'j', 'h', '7', '8'],
  i: ['u', 'o', 'k', 'j', '8', '9'],
  o: ['i', 'p', 'l', 'k', '9', '0'],
  p: ['o', 'ç', 'l', '0', '-'],
  a: ['q', 'w', 's', 'z'],
  s: ['a', 'w', 'e', 'd', 'z', 'x'],
  d: ['s', 'e', 'r', 'f', 'x', 'c'],
  f: ['d', 'r', 't', 'g', 'c', 'v'],
  g: ['f', 't', 'y', 'h', 'v', 'b'],
  h: ['g', 'y', 'u', 'j', 'b', 'n'],
  j: ['h', 'u', 'i', 'k', 'n', 'm'],
  k: ['j', 'i', 'o', 'l', 'm', ','],
  l: ['k', 'o', 'p', 'ç', ',', '.'],
  ç: ['l', 'p', ';', '.'],
  z: ['a', 's', 'x'],
  x: ['z', 's', 'd', 'c'],
  c: ['x', 'd', 'f', 'v'],
  v: ['c', 'f', 'g', 'b'],
  b: ['v', 'g', 'h', 'n'],
  n: ['b', 'h', 'j', 'm'],
  m: ['n', 'j', 'k', ','],
};

/**
 * @param {string} from
 * @param {string} to
 */
export function keyboardSubstitutionCost(from, to) {
  const a = from.toLowerCase();
  const b = to.toLowerCase();
  if (a === b) return 0;
  const neighbors = ABNT2_NEIGHBORS[a];
  if (neighbors?.includes(b)) return 1;
  return 3;
}

/**
 * @param {string} input
 * @param {string} candidate
 */
export function keyboardAwareWordDistance(input, candidate) {
  const a = input.toLowerCase();
  const b = candidate.toLowerCase();
  if (a === b) return 0;

  let cost = 0;
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i += 1) {
    const ca = a[i] || '';
    const cb = b[i] || '';
    if (!ca || !cb) {
      cost += 2;
      continue;
    }
    cost += keyboardSubstitutionCost(ca, cb);
  }
  return cost;
}
