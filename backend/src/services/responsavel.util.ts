/**
 * responsavel.util v1.1.0 — inferência do autor da 1ª resposta pública
 * VERSION: v1.1.0 | DATE: 2026-07-29 | AUTHOR: VeloHub Development Team
 *
 * Rótulos de visão/permissão e termos genéricos nunca representam atribuição:
 * nesses casos o campo fica vazio, sem preenchimento de fachada.
 */
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
