/** agenteDesk.service v1.1.0 — sync VeloHub Velotax + função RBAC derivada de atuacao */
import { getDeskAgenteModel, IDeskAgente } from '../models/DeskAgente';
import { listColaboradoresVelotaxDesk } from './colaboradoresCadastro.service';
import { listFuncoesPermissoes } from './funcaoPermissao.service';
import { invalidatePermissionCache } from './permission.service';
import { extractFuncoes, resolvePrimaryFuncao } from '../utils/normalizeFuncao';

export interface AgenteDeskPublico {
  email: string;
  velohubId: string;
  colaboradorNome: string;
  empresa: string;
  departamento: string;
  atuacao: IDeskAgente['atuacao'];
  funcaoSlug: string | null;
  funcaoNome: string | null;
  nivel: number | null;
  afastado: boolean;
  syncedAt: string | null;
  updatedBy: string;
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

async function buildFuncaoMap() {
  const funcoes = await listFuncoesPermissoes();
  return new Map(funcoes.map((f) => [f.slug, { nome: f.nome, nivel: f.nivel ?? 1 }]));
}

export function deriveFuncaoFromAtuacao(
  atuacao: IDeskAgente['atuacao'] | undefined,
  funcaoBySlug: Map<string, { nome: string; nivel: number }>,
): { funcaoSlug: string | null; funcaoNome: string | null; nivel: number | null } {
  const slugs = extractFuncoes(atuacao);
  if (!slugs.length) {
    return { funcaoSlug: null, funcaoNome: null, nivel: null };
  }

  const nivelMap = new Map(
    [...funcaoBySlug.entries()].map(([slug, f]) => [slug, f.nivel]),
  );
  const funcaoSlug = resolvePrimaryFuncao(slugs, nivelMap);
  const funcao = funcaoBySlug.get(funcaoSlug);
  return {
    funcaoSlug: funcaoSlug || null,
    funcaoNome: funcao?.nome || funcaoSlug || null,
    nivel: funcao?.nivel ?? nivelMap.get(funcaoSlug) ?? null,
  };
}

function mapToPublico(
  doc: IDeskAgente,
  funcaoBySlug: Map<string, { nome: string; nivel: number }>,
): AgenteDeskPublico {
  const derived = deriveFuncaoFromAtuacao(doc.atuacao, funcaoBySlug);
  return {
    email: doc.email,
    velohubId: doc.velohubId || '',
    colaboradorNome: doc.colaboradorNome || '',
    empresa: doc.empresa || '',
    departamento: doc.departamento || '',
    atuacao: doc.atuacao || [],
    funcaoSlug: derived.funcaoSlug,
    funcaoNome: derived.funcaoNome,
    nivel: derived.nivel,
    afastado: doc.afastado === true,
    syncedAt: doc.syncedAt ? doc.syncedAt.toISOString() : null,
    updatedBy: doc.updatedBy || '',
  };
}

export async function getAgenteByEmail(email: string): Promise<IDeskAgente | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const Model = getDeskAgenteModel();
  return Model.findOne({ email: normalized }).lean() as Promise<IDeskAgente | null>;
}

export async function listAgentesDesk(): Promise<AgenteDeskPublico[]> {
  const Model = getDeskAgenteModel();
  const funcaoBySlug = await buildFuncaoMap();
  const docs = await Model.find().sort({ colaboradorNome: 1 }).lean() as unknown as IDeskAgente[];
  return docs.map((d) => mapToPublico(d, funcaoBySlug));
}

export async function syncAgentesFromVelohub(updatedBy = 'sync'): Promise<{ synced: number; removed: number }> {
  const colaboradores = await listColaboradoresVelotaxDesk();
  const Model = getDeskAgenteModel();
  const syncedEmails: string[] = [];
  const now = new Date();

  for (const col of colaboradores) {
    const email = normalizeEmail(col.userMail);
    if (!email) continue;
    syncedEmails.push(email);

    await Model.findOneAndUpdate(
      { email },
      {
        $set: {
          velohubId: String(col._id || ''),
          colaboradorNome: col.colaboradorNome,
          empresa: col.empresa,
          departamento: col.departamento,
          atuacao: col.atuacao,
          afastado: col.afastado,
          syncedAt: now,
        },
        $setOnInsert: {
          updatedBy,
        },
      },
      { upsert: true, new: true },
    );
  }

  const removeResult = syncedEmails.length
    ? await Model.deleteMany({ email: { $nin: syncedEmails } })
    : { deletedCount: 0 };

  invalidatePermissionCache();
  return { synced: syncedEmails.length, removed: removeResult.deletedCount ?? 0 };
}
