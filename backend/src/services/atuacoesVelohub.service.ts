/** atuacoesVelohub.service v1.0.0 — leitura gerenciamento_atuacoes (VeloHubCentral) */
import { env } from '../config/env';
import { getFuncionariosConnection, isFuncionariosConnected } from '../config/database';
import { normalizeFuncao } from '../utils/normalizeFuncao';

export interface AtuacaoVelohubPublica {
  _id: unknown;
  funcao: string;
  funcaoSlug: string;
  descricao: string;
  modulosVelohub: Record<string, boolean>;
}

function getAtuacoesCollection() {
  if (!isFuncionariosConnected()) {
    throw new Error('Conexão console_funcionarios indisponível');
  }
  return getFuncionariosConnection().db!.collection('gerenciamento_atuacoes');
}

export async function listAtuacoesVelohub(): Promise<AtuacaoVelohubPublica[]> {
  const col = getAtuacoesCollection();
  const docs = await col
    .find({})
    .project({ funcao: 1, descricao: 1, modulosVelohub: 1 })
    .sort({ funcao: 1 })
    .toArray();

  return docs
    .map((doc) => {
      const funcao = String((doc as Record<string, unknown>).funcao || '').trim();
      if (!funcao) return null;
      const modulos = (doc as Record<string, unknown>).modulosVelohub;
      return {
        _id: (doc as Record<string, unknown>)._id,
        funcao,
        funcaoSlug: normalizeFuncao(funcao),
        descricao: String((doc as Record<string, unknown>).descricao || ''),
        modulosVelohub: (modulos && typeof modulos === 'object'
          ? modulos
          : {}) as Record<string, boolean>,
      };
    })
    .filter((d): d is AtuacaoVelohubPublica => Boolean(d));
}

export async function isAtuacoesAvailable(): Promise<boolean> {
  if (!isFuncionariosConnected()) return false;
  try {
    await getAtuacoesCollection().findOne({}, { projection: { _id: 1 } });
    return true;
  } catch {
    return false;
  }
}

export function getFuncionariosCollectionName(): string {
  return env.mongoFuncionariosCollection;
}
