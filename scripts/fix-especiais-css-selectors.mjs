import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const cssPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../frontend/velodesk-ecosystem.css');
let css = fs.readFileSync(cssPath, 'utf8');

const brokenNeedle = ', #especiais-procon , #especiais-consumidor-gov , #especiais-consumidor-gov ';
let fixed = 0;

if (css.includes(brokenNeedle)) {
  const lines = css.split('\n');
  const out = lines.map((line) => {
    if (!line.includes(brokenNeedle)) return line;
    const brace = line.indexOf(' {');
    if (brace < 0) return line;
    const selectors = line.slice(0, brace);
    const rest = line.slice(brace);
    const govMarker = ', #especiais-consumidor-gov ';
    const govIdx = selectors.lastIndexOf(govMarker);
    if (govIdx < 0) return line;
    const suffix = selectors.slice(govIdx + govMarker.length);
    const raPart = selectors.slice(0, selectors.indexOf(brokenNeedle));
    const repaired = `${raPart}, #especiais-procon ${suffix}, #especiais-consumidor-gov ${suffix}`;
    fixed += 1;
    return repaired + rest;
  });
  css = out.join('\n');
}

// Remove duplicate CONSUMIDOR.GOV theme blocks (keep first only)
const themeMarker = '/* ===== CONSUMIDOR.GOV';
let firstTheme = css.indexOf(themeMarker);
if (firstTheme >= 0) {
  let searchFrom = firstTheme + themeMarker.length;
  while (true) {
    const next = css.indexOf(themeMarker, searchFrom);
    if (next < 0) break;
    const nextSection = css.indexOf('\n\n/*', next + themeMarker.length);
    const end = nextSection > next ? nextSection : css.length;
    css = css.slice(0, next) + css.slice(end);
    console.log('Removed duplicate CONSUMIDOR.GOV theme block');
  }
}

fs.writeFileSync(cssPath, css);
console.log(`Fixed ${fixed} broken selector lines`);

const remaining = css.split('\n').filter((l) => l.includes(', #especiais-procon ,')).length;
console.log(`Remaining broken lines: ${remaining}`);
