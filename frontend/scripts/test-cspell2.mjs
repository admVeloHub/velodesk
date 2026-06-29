import { createSpellingDictionary, suggestionsForWord } from 'cspell-lib';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../node_modules/@cspell/dict-pt-br');
const triePath = join(root, 'pt_BR.trie.gz');

const t0 = Date.now();
const dict = await createSpellingDictionary(triePath, 'pt-br', 'pt-br', { noSuggest: false });
console.log('loaded', Date.now() - t0, 'ms');

async function getSuggestions(word) {
  const result = suggestionsForWord(dict, word, { numSuggestions: 5 });
  if (result && typeof result[Symbol.asyncIterator] === 'function') {
    const items = [];
    for await (const s of result) items.push(s.word || s);
    return items;
  }
  if (Array.isArray(result)) return result.map((s) => s.word || s);
  return [];
}

const words = ['atendimeto', 'atendimento', 'obrigadu', 'informacao', 'informação', 'voce', 'você', 'nao', 'não', 'xkjhfg', 'Ola', 'Olá'];
for (const w of words) {
  const ok = dict.has(w, { ignoreCase: false });
  const sug = await getSuggestions(w);
  console.log(w, 'has:', ok, 'suggest:', sug.slice(0, 3));
}
