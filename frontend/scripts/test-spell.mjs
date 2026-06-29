import nspell from 'nspell';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../node_modules/dictionary-pt-br');
console.log('reading...');
const t0 = Date.now();
const aff = readFileSync(join(dir, 'index.aff'), 'utf8');
const dic = readFileSync(join(dir, 'index.dic'), 'utf8');
console.log('read', Date.now() - t0, 'ms, aff', aff.length, 'dic', dic.length);

const t1 = Date.now();
const spell = nspell(aff, dic);
console.log('init', Date.now() - t1, 'ms');

const t2 = Date.now();
console.log('atendimeto', spell.correct('atendimeto'));
console.log('correct()', Date.now() - t2, 'ms');

const t3 = Date.now();
console.log('suggest', spell.suggest('atendimeto').slice(0, 3));
console.log('suggest()', Date.now() - t3, 'ms');
