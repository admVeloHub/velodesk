import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(__dirname, '../frontend/velodesk-ecosystem.css');
let css = fs.readFileSync(cssPath, 'utf8');

const lines = css.split('\n').map((line) => {
  if (!line.includes('#especiais-procon') || line.includes('#especiais-consumidor-gov')) {
    return line;
  }
  return line
    .replace(/ , #especiais-procon /g, ' , #especiais-procon , #especiais-consumidor-gov ')
    .replace(/, #especiais-procon /g, ', #especiais-procon , #especiais-consumidor-gov ')
    .replace(/, #especiais-procon,/g, ', #especiais-procon, #especiais-consumidor-gov,')
    .replace(/, #especiais-procon\{/g, ', #especiais-procon, #especiais-consumidor-gov {')
    .replace(/, #especiais-procon \{/g, ', #especiais-procon, #especiais-consumidor-gov {');
});

css = lines.join('\n');

if (!css.includes('CONSUMIDOR.GOV — tema azul')) {
  const themeMarker = '/* ===== PROCON';
  const themeStart = css.indexOf(themeMarker);
  if (themeStart >= 0) {
    const nextSection = css.indexOf('\n\n/*', themeStart + themeMarker.length + 20);
    const sliceEnd = nextSection > themeStart ? nextSection : css.length;
    const themeBlock = css.slice(themeStart, sliceEnd);
    const govTheme = themeBlock
      .replace(/PROCON/g, 'CONSUMIDOR.GOV')
      .replace(/Procon/g, 'Consumidor.Gov')
      .replace(/#especiais-procon/g, '#especiais-consumidor-gov')
      .replace(/#0F766E/g, '#2563EB')
      .replace(/#14b8a6/g, '#3B82F6')
      .replace(/rgba\(15, 118, 110/g, 'rgba(37, 99, 235');
    css += `\n${govTheme}`;
  }
}

if (!css.includes('#especiais-consumidor-gov .ra-crm-queue {')) {
  css += `\n/* Consumidor.Gov — fila CRM azul */
#especiais-consumidor-gov .ra-crm-queue {
    background: linear-gradient(180deg, #1e3a8a 0%, #172554 100%);
}
`;
}

fs.writeFileSync(cssPath, css);

const miss = css.split('\n').filter((l) => l.includes('#especiais-procon') && !l.includes('#especiais-consumidor-gov'));
console.log('CSS patched; procon-only lines remaining:', miss.length);
