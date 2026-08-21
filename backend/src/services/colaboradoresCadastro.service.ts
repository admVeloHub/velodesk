/**
 * colaboradoresCadastro.service v1.4.0 — índice responsável → nome/alias para exibição
 * Campos de login: userMail, password, CPF, colaboradorNome, aliasColaborador
 * VERSION: v1.4.0 | DATE: 2026-08-20 | AUTHOR: VeloHub Development Team
 */
import { env } from '../config/env';
import { getFuncionariosConnection, isFuncionariosConnected } from '../config/database';

export interface ColaboradorDeskPublico {
  _id: unknown;
  colaboradorNome: string;
  aliasColaborador: string;
  userMail: string;
  atuacao: Array<{ funcao?: string } | string>;
  acessos: Record<string, boolean>;
  empresa: string;
  departamento: string;
  desligado: boolean;
  afastado: boolean;
  profile_pic: string;
}

const DESK_ACCESS_OR = [
  { 'acessos.Desk': true },
  { 'acessos.desk': true },
];

const PUBLIC_PROJECTION = {
  colaboradorNome: 1,
  aliasColaborador: 1,
  userMail: 1,
  atuacao: 1,
  acessos: 1,
  empresa: 1,
  departamento: 1,
  desligado: 1,
  afastado: 1,
  profile_pic: 1,
} as const;

const AUTH_PROJECTION = {
  ...PUBLIC_PROJECTION,
  password: 1,
  CPF: 1,
} as const;

export interface ColaboradorAuthRecord extends ColaboradorDeskPublico {
  password: string;
  CPF: string;
}

function normalizeNameToken(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function onlyDigits(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

/** Senha padrão quando password vazio em funcionarios_cadastroColaboradores: nome.sobrenome + CPF. */
export function buildDefaultColaboradorPassword(colaboradorNome: string, cpf: string): string {
  const parts = String(colaboradorNome || '').trim().split(/\s+/).filter(Boolean);
  const first = normalizeNameToken(parts[0] || 'colaborador');
  const last = normalizeNameToken(parts.length > 1 ? parts[parts.length - 1] : parts[0] || 'colaborador');
  const cpfDigits = onlyDigits(cpf);
  return `${first}.${last}${cpfDigits}`;
}

export function resolveColaboradorPassword(
  storedPassword: string | undefined | null,
  colaboradorNome: string,
  cpf: string,
): string {
  const trimmed = String(storedPassword || '').trim();
  if (trimmed) return trimmed;
  return buildDefaultColaboradorPassword(colaboradorNome, cpf);
}

export function resolveFirstLastName(colaboradorNome: string): string {
  const parts = String(colaboradorNome || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function emailLocalPart(email: string): string {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized.includes('@')) return normalized;
  return normalized.split('@')[0] ?? '';
}

function normalizeLookupKey(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

let responsavelDisplayIndexCache: Map<string, string> | null = null;
let responsavelDisplayIndexAt = 0;
const RESPONSAVEL_INDEX_TTL_MS = 5 * 60 * 1000;

/** Mapa chave (email, login, nome) → nome exibido (alias ou primeiro+último). */
export function buildResponsavelDisplayIndex(
  colaboradores: ColaboradorDeskPublico[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const col of colaboradores) {
    const display = resolveColaboradorDisplayName(col);
    if (!display) continue;
    const keys = new Set<string>();
    const push = (raw?: string) => {
      const trimmed = String(raw ?? '').trim();
      if (!trimmed) return;
      keys.add(trimmed.toLowerCase());
      keys.add(normalizeLookupKey(trimmed));
    };
    push(col.userMail);
    push(emailLocalPart(col.userMail));
    push(col.colaboradorNome);
    push(resolveFirstLastName(col.colaboradorNome));
    push(display);
    keys.forEach((key) => map.set(key, display));
  }
  return map;
}

export async function warmResponsavelDisplayCache(force = false): Promise<void> {
  const now = Date.now();
  if (!force && responsavelDisplayIndexCache && now - responsavelDisplayIndexAt < RESPONSAVEL_INDEX_TTL_MS) {
    return;
  }
  if (!isFuncionariosConnected()) return;
  const list = await listColaboradoresDesk();
  responsavelDisplayIndexCache = buildResponsavelDisplayIndex(list);
  responsavelDisplayIndexAt = now;
}

export function getResponsavelDisplayIndexSync(): Map<string, string> {
  return responsavelDisplayIndexCache ?? new Map();
}

/** Nome exibido em atendimentos — aliasColaborador ou primeiro+último de colaboradorNome. */
export function resolveColaboradorDisplayName(
  colaborador: Pick<ColaboradorDeskPublico, 'aliasColaborador' | 'colaboradorNome'> | null | undefined,
): string {
  const alias = String(colaborador?.aliasColaborador || '').trim();
  if (alias) return alias;
  return resolveFirstLastName(String(colaborador?.colaboradorNome || ''));
}

/** Nome do operador autenticado — cadastro funcionarios_cadastroColaboradores. */
export async function resolveOperadorDisplayNameForAuthEmail(email: string): Promise<string> {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return '';
  const colaborador = await findColaboradorByEmail(normalized);
  return resolveColaboradorDisplayName(colaborador);
}

function mapPublico(doc: Record<string, unknown> | null): ColaboradorDeskPublico | null {
  if (!doc) return null;
  return {
    _id: doc._id,
    colaboradorNome: String(doc.colaboradorNome || ''),
    aliasColaborador: String(doc.aliasColaborador || ''),
    userMail: String(doc.userMail || ''),
    atuacao: Array.isArray(doc.atuacao) ? (doc.atuacao as ColaboradorDeskPublico['atuacao']) : [],
    acessos: (doc.acessos && typeof doc.acessos === 'object'
      ? doc.acessos
      : {}) as Record<string, boolean>,
    empresa: String(doc.empresa || ''),
    departamento: String(doc.departamento || ''),
    desligado: doc.desligado === true,
    afastado: doc.afastado === true,
    profile_pic: String(doc.profile_pic || ''),
  };
}

function getCadastroCollection() {
  if (!isFuncionariosConnected()) {
    throw new Error('Conexão console_funcionarios indisponível');
  }
  return getFuncionariosConnection().db!.collection(env.mongoFuncionariosCollection);
}

export async function listColaboradoresDesk(): Promise<ColaboradorDeskPublico[]> {
  const col = getCadastroCollection();
  const docs = await col
    .find(
      {
        desligado: { $ne: true },
        $or: DESK_ACCESS_OR,
      },
      { maxTimeMS: 10000 },
    )
    .project(PUBLIC_PROJECTION)
    .toArray();

  return docs
    .map((d) => mapPublico(d as Record<string, unknown>))
    .filter((d): d is ColaboradorDeskPublico => Boolean(d))
    .sort((a, b) => a.colaboradorNome.localeCompare(b.colaboradorNome, 'pt-BR'));
}

export async function listColaboradoresVelotaxDesk(): Promise<ColaboradorDeskPublico[]> {
  const col = getCadastroCollection();
  const docs = await col
    .find(
      {
        desligado: { $ne: true },
        $or: DESK_ACCESS_OR,
        empresa: { $regex: /^velotax$/i },
      },
      { maxTimeMS: 10000 },
    )
    .project(PUBLIC_PROJECTION)
    .toArray();

  return docs
    .map((d) => mapPublico(d as Record<string, unknown>))
    .filter((d): d is ColaboradorDeskPublico => Boolean(d))
    .sort((a, b) => a.colaboradorNome.localeCompare(b.colaboradorNome, 'pt-BR'));
}

function buildEmailMatchFilter(normalized: string) {
  return {
    $or: [
      { userMail: normalized },
      { userMail: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    ],
  };
}

function mapAuthRecord(doc: Record<string, unknown> | null): ColaboradorAuthRecord | null {
  const publico = mapPublico(doc);
  if (!publico) return null;
  return {
    ...publico,
    password: String(doc?.password || ''),
    CPF: String(doc?.CPF || ''),
  };
}

export async function findColaboradorByEmail(email: string): Promise<ColaboradorDeskPublico | null> {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  if (!isFuncionariosConnected()) return null;

  const col = getCadastroCollection();
  const doc = await col.findOne(buildEmailMatchFilter(normalized), { projection: PUBLIC_PROJECTION });

  return mapPublico(doc as Record<string, unknown> | null);
}

/** Busca em funcionarios_cadastroColaboradores (userMail + password + CPF) para login email/senha. */
export async function findColaboradorAuthByEmail(email: string): Promise<ColaboradorAuthRecord | null> {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;

  const col = getCadastroCollection();
  const doc = await col.findOne(buildEmailMatchFilter(normalized), { projection: AUTH_PROJECTION });

  return mapAuthRecord(doc as Record<string, unknown> | null);
}

export function verifyColaboradorPassword(
  colaborador: ColaboradorAuthRecord,
  password: string,
): boolean {
  const effective = resolveColaboradorPassword(
    colaborador.password,
    colaborador.colaboradorNome,
    colaborador.CPF,
  );
  return String(password || '') === effective;
}
