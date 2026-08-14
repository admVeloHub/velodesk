import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(__dirname, '../frontend/velodesk-ecosystem.css');
let css = fs.readFileSync(cssPath, 'utf8');

function appendBacenSelector(line) {
  if (!line.includes('#especiais-consumidor-gov') || line.includes('#especiais-bacen')) {
    return line;
  }

  const brace = line.indexOf(' {');
  if (brace < 0) return line;

  const selectors = line.slice(0, brace);
  const rest = line.slice(brace);

  // Append bacen mirror of consumidor-gov selector suffix
  const govMarker = ', #especiais-consumidor-gov ';
  const govIdx = selectors.lastIndexOf(govMarker);
  if (govIdx >= 0) {
    const suffix = selectors.slice(govIdx + govMarker.length);
    const bacenSelector = `#especiais-bacen ${suffix}`;
    if (selectors.includes(bacenSelector)) return line;
    return `${selectors}, ${bacenSelector}${rest}`;
  }

  // Root-level comma lists: #especiais-reclame-aqui, #especiais-procon, #especiais-consumidor-gov
  if (selectors.includes('#especiais-consumidor-gov') && !selectors.includes('#especiais-bacen')) {
    return selectors.replace(
      /#especiais-consumidor-gov/g,
      '#especiais-consumidor-gov, #especiais-bacen',
    ) + rest;
  }

  return line;
}

let patched = 0;
const lines = css.split('\n').map((line) => {
  const next = appendBacenSelector(line);
  if (next !== line) patched += 1;
  return next;
});
css = lines.join('\n');

fs.writeFileSync(cssPath, css);

const miss = css.split('\n').filter(
  (l) => l.includes('#especiais-consumidor-gov') && !l.includes('#especiais-bacen'),
).length;
const bacenCount = css.split('\n').filter((l) => l.includes('#especiais-bacen')).length;

console.log(`Patched ${patched} lines`);
console.log(`#especiais-bacen lines: ${bacenCount}`);
console.log(`consumidor-gov-only lines remaining: ${miss}`);
