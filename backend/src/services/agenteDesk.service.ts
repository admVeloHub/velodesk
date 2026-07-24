/** agenteDesk.service v1.3.0 — GET lê VeloHub ao vivo; sync sem conflito updatedBy */
import { getDeskAgenteModel, IDeskAgente } from '../models/DeskAgente';
import {
  listColaboradoresVelotaxDesk,
  type ColaboradorDeskPublico,
} from './colaboradoresCadastro.service';
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

function mapDocToPublico(
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

function mapColaboradorToPublico(
  col: ColaboradorDeskPublico,
  funcaoBySlug: Map<string, { nome: string; nivel: number }>,
  syncedAt: Date | null,
  updatedBy: string,
): AgenteDeskPublico {
  const derived = deriveFuncaoFromAtuacao(col.atuacao, funcaoBySlug);
  return {
    email: normalizeEmail(col.userMail),
    velohubId: String(col._id || ''),
    colaboradorNome: col.colaboradorNome || '',
    empresa: col.empresa || '',
    departamento: col.departamento || '',
    atuacao: col.atuacao || [],
    funcaoSlug: derived.funcaoSlug,
    funcaoNome: derived.funcaoNome,
    nivel: derived.nivel,
    afastado: col.afastado === true,
    syncedAt: syncedAt ? syncedAt.toISOString() : null,
    updatedBy,
  };
}

async function listAgentesFromVelohubLive(updatedBy = 'velohub'): Promise<AgenteDeskPublico[]> {
  const colaboradores = await listColaboradoresVelotaxDesk();
  const funcaoBySlug = await buildFuncaoMap();
  const now = new Date();
  return colaboradores
    .map((col) => mapColaboradorToPublico(col, funcaoBySlug, now, updatedBy))
    .filter((a) => Boolean(a.email))
    .sort((a, b) => a.colaboradorNome.localeCompare(b.colaboradorNome, 'pt-BR'));
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
  return docs.map((d) => mapDocToPublico(d, funcaoBySlug));
}

/**
 * Lista agentes Desk a partir do cadastro VeloHub (fonte da verdade).
 * Espelho local (desk_agentes) é atualizado em background da resposta; se o sync
 * falhar, a API ainda devolve os dados vivos do VeloHub.
 */
export async function listAgentesDeskFresh(updatedBy = 'auto'): Promise<{
  agentes: AgenteDeskPublico[];
  synced: number;
  removed: number;
  syncOk: boolean;
  syncError?: string;
}> {
  let synced = 0;
  let removed = 0;
  let syncOk = true;
  let syncError: string | undefined;

  try {
    const result = await syncAgentesFromVelohub(updatedBy);
    synced = result.synced;
    removed = result.removed;
  } catch (err) {
    syncOk = false;
    syncError = err instanceof Error ? err.message : String(err);
    console.warn('[agentes-desk] sync automático falhou — listando VeloHub ao vivo:', syncError);
  }

  try {
    const agentes = await listAgentesFromVelohubLive(updatedBy);
    return { agentes, synced, removed, syncOk, syncError };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[agentes-desk] leitura VeloHub falhou — usando espelho local:', message);
    const agentes = await listAgentesDesk();
    return {
      agentes,
      synced,
      removed,
      syncOk: false,
      syncError: syncError || message,
    };
  }
}

export async function syncAgentesFromVelohub(updatedBy = 'sync'): Promise<{ synced: number; removed: number }> {
  const colaboradores = await listColaboradoresVelotaxDesk();
  const Model = getDeskAgenteModel();
  const funcaoBySlug = await buildFuncaoMap();
  const syncedEmails: string[] = [];
  const now = new Date();

  for (const col of colaboradores) {
    const email = normalizeEmail(col.userMail);
    if (!email) continue;
    syncedEmails.push(email);

    const derived = deriveFuncaoFromAtuacao(col.atuacao, funcaoBySlug);

    // updatedBy só em $set — $setOnInsert no mesmo path gera conflito no MongoDB
    await Model.findOneAndUpdate(
      { email },
      {
        $set: {
          velohubId: String(col._id || ''),
          colaboradorNome: col.colaboradorNome,
          empresa: col.empresa,
          departamento: col.departamento,
          atuacao: col.atuacao,
          funcaoSlug: derived.funcaoSlug,
          afastado: col.afastado,
          syncedAt: now,
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
