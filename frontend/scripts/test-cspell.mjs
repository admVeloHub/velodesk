import { spellCheckFile } from 'cspell-lib';
import { getDictionary } from 'cspell-lib';

const t0 = Date.now();
const dict = await getDictionary(['pt', 'pt-BR']);
console.log('dict loaded', Date.now() - t0, 'ms');

const words = ['atendimeto', 'atendimento', 'obrigadu', 'informacao', 'informação', 'voce', 'você', 'nao', 'não'];
for (const w of words) {
  const ok = dict.has(w, { ignoreCase: false });
  const sug = dict.suggest(w).slice(0, 3);
  console.log(w, 'has:', ok, 'suggest:', sug);
}
