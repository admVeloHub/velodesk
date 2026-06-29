import { createSpellingDictionary } from 'cspell-lib';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../node_modules/@cspell/dict-pt-br');
const dict = await createSpellingDictionary(join(root, 'pt_BR.trie.gz'), 'pt-br', 'pt-br', {});

const words = ['atendimento', 'Olá', 'ola', 'informação', 'informacao', 'casa', 'brasil'];
for (const w of words) {
  console.log(w, {
    caseSensitive: dict.has(w, { ignoreCase: false }),
    ignoreCase: dict.has(w, { ignoreCase: true }),
    hasExact: dict.hasWord ? dict.hasWord(w) : 'n/a',
  });
}

console.log('dict keys', Object.keys(dict));
