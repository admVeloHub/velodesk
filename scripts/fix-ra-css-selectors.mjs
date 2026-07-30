import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(__dirname, '../frontend/velodesk-ecosystem.css');
let css = fs.readFileSync(cssPath, 'utf8');

const broken = '#especiais-reclame-aqui, #especiais-procon .';
const countBefore = css.split(broken).length - 1;

css = css.replace(
  /#especiais-reclame-aqui, #especiais-procon (\.[^{,\n]+)/g,
  (_, selector) => `#especiais-reclame-aqui ${selector}, #especiais-procon ${selector}`,
);

const countAfter = css.split(broken).length - 1;
fs.writeFileSync(cssPath, css);
console.log(`Reclame Aqui CSS selectors fixed: ${countBefore} -> ${countAfter} remaining`);
