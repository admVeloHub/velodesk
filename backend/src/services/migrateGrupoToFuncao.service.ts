/** migrateGrupoToFuncao v1.0.0 — migração grupo: → funcao: */
import { ChamadoN1 } from '../models/ChamadoN1';
import { getWorkflowDefinicaoModel } from '../models/WorkflowDefinicao';
import { GRUPO_TO_FUNCAO_MAP } from '../config/funcaoPermissaoDefaults';
import { normalizeAtribuidoValue } from '../utils/normalizeFuncao';

function grupoSlugToFuncao(slug: string): string {
  return GRUPO_TO_FUNCAO_MAP[slug.toLowerCase()] || slug;
}

function migrateAtribuicaoDoc(atribuicao: Record<string, unknown> | undefined) {
  if (!atribuicao || typeof atribuicao !== 'object') return atribuicao;
  if (atribuicao.tipo === 'grupo') {
    const grupoSlug = String(atribuicao.grupoSlug || '').trim();
    return {
      ...atribuicao,
      tipo: 'funcao',
      funcaoSlug: grupoSlugToFuncao(grupoSlug),
      grupoSlug: '',
    };
  }
  return atribuicao;
}

export async function migrateGrupoToFuncao(): Promise<{ workflows: number; tickets: number }> {
  let workflowsUpdated = 0;
  let ticketsUpdated = 0;

  const Workflow = getWorkflowDefinicaoModel();
  const defs = await Workflow.find({});
  for (const def of defs) {
    let changed = false;
    for (const envelope of def.passos || []) {
      const passo = envelope.passo as unknown as Record<string, unknown>;
      if (!passo?.atribuicao) continue;
      const before = JSON.stringify(passo.atribuicao);
      passo.atribuicao = migrateAtribuicaoDoc(passo.atribuicao as Record<string, unknown>);
      if (JSON.stringify(passo.atribuicao) !== before) changed = true;
    }
    if (changed) {
      def.markModified('passos');
      await def.save();
      workflowsUpdated += 1;
    }
  }

  const cursor = ChamadoN1.find({
    'tabulacao.atribuido': { $regex: /^grupo:/i },
  }).cursor();

  for await (const chamado of cursor) {
    const tab = chamado.tabulacao?.[0];
    if (!tab) continue;
    const normalized = normalizeAtribuidoValue(tab.atribuido);
    if (normalized !== tab.atribuido) {
      tab.atribuido = normalized;
      chamado.tabulacao = [tab];
      await chamado.save();
      ticketsUpdated += 1;
    }
  }

  if (workflowsUpdated || ticketsUpdated) {
    console.log(`Migração grupo→funcao: workflows=${workflowsUpdated}, tickets=${ticketsUpdated}`);
  }

  return { workflows: workflowsUpdated, tickets: ticketsUpdated };
}
