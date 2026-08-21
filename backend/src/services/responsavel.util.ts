/**
 * responsavel.util v1.2.0 — exibição responsável: alias ou primeiro+último (nunca login/e-mail)
 * VERSION: v1.2.0 | DATE: 2026-08-20 | AUTHOR: VeloHub Development Team
 */
import {
  getResponsavelDisplayIndexSync,
  warmResponsavelDisplayCache,
} from './colaboradoresCadastro.service';

const GENERIC_RESPONSAVEL = new Set([
  'agente',
  'agent',
  'atendimento',
  'sistema',
  'system',
  'admin',
  'admin velodesk',
  'administrador',
  'nenhum',
  'sem responsavel',
  'n/a',
  'na',
  '-',
  '--',
  '—',
]);

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeLookupKey(value: string): string {
  return normalize(value);
}

/** Rótulo de visão/perfil ("Visão Especiais", "Visao Workflow"…) não é agente. */
function isVisionLabel(normalized: string): boolean {
  return normalized.startsWith('visao ');
}

export function isRealResponsavel(value: unknown): boolean {
  const normalized = normalize(value);
  if (!normalized) return false;
  if (isVisionLabel(normalized)) return false;
  return !GENERIC_RESPONSAVEL.has(normalized);
}

/** Devolve o responsável quando é real; caso contrário, string vazia. */
export function sanitizeResponsavel(value: unknown): string {
  return isRealResponsavel(value) ? String(value).trim() : '';
}

/** E-mail, login ou token sem espaço — nunca exibir como responsável. */
export function looksLikeNonDisplayResponsavelToken(value: unknown): boolean {
  const v = String(value ?? '').trim();
  if (!v) return false;
  if (v.includes('@')) return true;
  if (/^[a-z0-9._-]+$/i.test(v) && !/\s/.test(v)) return true;
  return false;
}

/** Resolve valor persistido (login/e-mail/nome) para nome exibido (alias ou primeiro+último). */
export function resolveResponsavelDisplayNameSync(raw: unknown): string {
  const stored = sanitizeResponsavel(raw);
  if (!stored) return '';

  const index = getResponsavelDisplayIndexSync();
  const keys = [
    normalizeLookupKey(stored),
    stored.trim().toLowerCase(),
  ];
  for (const key of keys) {
    const fromIndex = index.get(key);
    if (fromIndex) return fromIndex;
  }

  if (looksLikeNonDisplayResponsavelToken(stored)) return '';
  return stored;
}

/** Normaliza antes de gravar tabulacao.responsavel — sempre nome/alias canônico. */
export async function normalizeResponsavelForStorage(raw: unknown): Promise<string> {
  const stored = sanitizeResponsavel(raw);
  if (!stored) return '';
  await warmResponsavelDisplayCache();
  const resolved = resolveResponsavelDisplayNameSync(stored);
  if (resolved) return resolved;
  if (looksLikeNonDisplayResponsavelToken(stored)) return '';
  return stored;
}

/** Inferência somente leitura — 1ª resposta pública de agente no registro. */
export function inferResponsavelFromAgentRegistro(
  registros: Array<{
    origin?: string;
    autor?: string;
    mensagemPublica?: string;
    anexosMensagemPublica?: string[];
  }> | undefined,
): string {
  for (const reg of registros ?? []) {
    if (String(reg.origin ?? '').trim().toLowerCase() !== 'agente') continue;
    const hasPublic = Boolean(
      String(reg.mensagemPublica ?? '').trim()
      || (reg.anexosMensagemPublica?.length ?? 0) > 0,
    );
    if (!hasPublic) continue;
    const autor = sanitizeResponsavel(reg.autor);
    if (autor) return autor;
  }
  return '';
}
