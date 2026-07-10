/**
 * whitelist v1.0.1 — termos ignorados pelo corretor ortográfico
 * VERSION: v1.0.1 | DATE: 2026-07-10
 */

const STATIC_WHITELIST = new Set([
  'velotax',
  'velodesk',
  'velohub',
  'whatsapp',
  'nps',
  'sla',
  'cpf',
  'cnpj',
  'pix',
  'sms',
  'email',
  'e-mail',
  'ok',
  'crm',
  'api',
  'n1',
  'n2',
  'n3',
  'fibra',
  'wi-fi',
  'wifi',
  'tv',
  'ott',
  'boleto',
  'chatbot',
  'chat',
  'ticket',
  'protocolo',
  'velo',
]);

/** @param {Set<string>} set @param {string} str */
export function addSpellWhitelistTerms(set, str) {
  const normalized = String(str || '').trim().toLowerCase();
  if (!normalized) return;
  set.add(normalized);
  normalized.split(/[\s/\-–—]+/).forEach((part) => {
    const clean = part.replace(/[^a-zà-ÿ0-9]/gi, '');
    if (clean.length >= 2) set.add(clean);
  });
}

/** @param {Set<string>} set @param {string} str */
function addWordsFromString(set, str) {
  addSpellWhitelistTerms(set, str);
}

/** @param {object|null|undefined} config */
export function buildWhitelistFromConfig(config) {
  const words = new Set(STATIC_WHITELIST);
  for (const produto of config?.produtos || []) {
    addWordsFromString(words, produto.produto);
    for (const motivo of produto.motivos || []) {
      addWordsFromString(words, motivo.motivo);
      for (const detalhe of motivo.detalhes || []) {
        addWordsFromString(words, detalhe.detalhe);
      }
    }
  }
  return words;
}

/** @param {Iterable<string>} [extraTerms] */
export function buildWhitelistFromTerms(extraTerms) {
  const words = new Set(STATIC_WHITELIST);
  for (const term of extraTerms || []) {
    addSpellWhitelistTerms(words, term);
  }
  return words;
}

/**
 * @param {string} word
 * @param {Set<string>} whitelist
 * @param {Set<string>} [ignoredWords]
 */
export function shouldSkipWord(word, whitelist, ignoredWords) {
  if (!word || word.length < 2) return true;
  const lower = word.toLowerCase();
  if (ignoredWords?.has(lower)) return true;
  if (whitelist.has(lower)) return true;
  if (/^\d+$/.test(word)) return true;
  if (/^[A-Z]{2,}\d*$/.test(word)) return true;
  if (word.includes('@')) return true;
  if (/^https?$/i.test(word)) return true;
  return false;
}
