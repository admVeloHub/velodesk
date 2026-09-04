/**
 * raInitialMessagePrompt — guarda no navegador se o agente já respondeu
 * "Enviar mensagem: Sim/Não" para a saudação inicial de um ticket RA.
 */
const STORAGE_KEY = 'veloDeskRaInitialMessageAnsweredV1';

function readAnsweredSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function writeAnsweredSet(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* localStorage indisponível (modo privado/quota) — prompt pode reaparecer ao recarregar */
  }
}

export function isRaInitialMessageAnswered(ticketId) {
  if (!ticketId) return false;
  return readAnsweredSet().has(String(ticketId));
}

export function markRaInitialMessageAnswered(ticketId) {
  if (!ticketId) return;
  const set = readAnsweredSet();
  set.add(String(ticketId));
  writeAnsweredSet(set);
}
