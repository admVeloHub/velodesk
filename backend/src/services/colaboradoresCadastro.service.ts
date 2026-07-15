/**
 * colaboradoresCadastro.service v1.0.1 — leitura console_funcionarios (MONGO_ENV)
 * VERSION: v1.0.1 | DATE: 2026-07-15 | AUTHOR: VeloHub Development Team
 */
import { env } from '../config/env';
import { getFuncionariosConnection, isFuncionariosConnected } from '../config/database';

export interface ColaboradorDeskPublico {
  _id: unknown;
  colaboradorNome: string;
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
  userMail: 1,
  atuacao: 1,
  acessos: 1,
  empresa: 1,
  departamento: 1,
  desligado: 1,
  afastado: 1,
  profile_pic: 1,
} as const;

function mapPublico(doc: Record<string, unknown> | null): ColaboradorDeskPublico | null {
  if (!doc) return null;
  return {
    _id: doc._id,
    colaboradorNome: String(doc.colaboradorNome || ''),
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

export async function findColaboradorByEmail(email: string): Promise<ColaboradorDeskPublico | null> {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;

  const col = getCadastroCollection();
  const doc = await col.findOne(
    {
      $or: [
        { userMail: normalized },
        { userMail: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      ],
    },
    { projection: PUBLIC_PROJECTION },
  );

  return mapPublico(doc as Record<string, unknown> | null);
}
