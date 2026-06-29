import nspell from 'nspell';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../node_modules/dictionary-pt-br');
const dic = readFileSync(join(dir, 'index.dic'), 'utf8');

const t1 = Date.now();
const spell = nspell({ aff: 'SET UTF-8\n', dic });
console.log('nspell dic-only init', Date.now() - t1, 'ms');
console.log('casa', spell.correct('casa'));
console.log('atendimeto', spell.correct('atendimeto'), spell.suggest('atendimeto').slice(0,3));
