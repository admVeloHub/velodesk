/** workflowConfigSeed v1.2.0 — seed grupos + workflows (reembolso + escalonar) */
import { getGrupoResponsabilidadeModel } from '../models/GrupoResponsabilidade';
import { getWorkflowDefinicaoModel, IWorkflowDefinicao } from '../models/WorkflowDefinicao';
import { DEFAULT_GRUPOS, invalidateGrupoCache } from './grupoResponsabilidade.service';
import { invalidateWorkflowCache } from './workflowDefinicao.service';

function isAberturaPasso(nome?: string): boolean {
  const n = String(nome || '').trim().toLowerCase();
  return n === 'abertura' || n.startsWith('abertura n1') || n.includes('ticket criado') || n.includes('início — ticket');
}

async function repairWorkflowPassos(doc: IWorkflowDefinicao): Promise<boolean> {
  const passos = [...(doc.passos || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const filtered = passos.filter((p) => !isAberturaPasso(p.passo?.nome));
  if (filtered.length === 0 || filtered.length === passos.length) {
    const first = passos[0];
    if (first?._id && String(doc.passoInicialId || '') !== String(first._id)) {
      doc.passoInicialId = first._id;
      await doc.save();
      return true;
    }
    return false;
  }

  filtered.forEach((p, index) => {
    p.ordem = index;
  });
  doc.passos = filtered;
  doc.passoInicialId = filtered[0]?._id ?? null;
  await doc.save();
  return true;
}

export async function seedWorkflowConfig(): Promise<void> {
  const Grupo = getGrupoResponsabilidadeModel();
  const grupoCount = await Grupo.countDocuments();
  if (grupoCount === 0) {
    await Grupo.insertMany(
      DEFAULT_GRUPOS.map((g) => ({ ...g, updatedBy: 'seed' })),
    );
    console.log(`Seed: ${DEFAULT_GRUPOS.length} grupo(s) de responsabilidade criados`);
  }

  const Workflow = getWorkflowDefinicaoModel();
  const wfExists = await Workflow.findOne({ slug: 'reembolso-7dias' }).select('_id').lean();
  if (!wfExists) {
    const doc = await Workflow.create({
      slug: 'reembolso-7dias',
      titulo: 'REEMBOLSO DENTRO DOS 7 DIAS',
      descricao: 'Fluxo de reembolso com aprovação financeira',
      ordem: 0,
      ativo: true,
      gatilho: {
        tipo: 'tabulacao',
        criterios: [
          { fonte: 'tabulacao', campo: 'tipoChamado', operador: 'equals', valor: 'Solicitação' },
          { fonte: 'tabulacao', campo: 'produto', operador: 'contains', valor: 'produto x' },
          { fonte: 'tabulacao', campo: 'motivo', operador: 'contains', valor: 'reembolso' },
        ],
      },
      passos: [
        {
          ordem: 0,
          passo: {
            nome: 'Elegibilidade',
            descricao: 'N1 confirma elegibilidade do reembolso.',
            icone: 'ti-circle-check',
            slaHoras: 2,
            criterios: [],
            atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' },
            acao: { tipo: 'manual', rotas: [] },
          },
        },
        {
          ordem: 1,
          passo: {
            nome: 'Aprovação financeiro',
            descricao: 'Financeiro analisa e decide.',
            icone: 'ti-building-bank',
            slaHoras: 4,
            criterios: [],
            atribuicao: { tipo: 'grupo', grupoSlug: 'financeiro', colaborador: '' },
            acao: {
              tipo: 'aprovacao',
              rotas: [
                { variavel: 'approve', rotulo: 'Aprovar', proximoPassoId: null, statusTicket: 'em-andamento' },
                { variavel: 'reject', rotulo: 'Reprovar', proximoPassoId: null, statusTicket: 'pendente' },
                { variavel: 'request_info', rotulo: 'Pedir informação', proximoPassoId: null, statusTicket: 'pendente' },
              ],
            },
          },
        },
        {
          ordem: 2,
          passo: {
            nome: 'Estorno processado',
            descricao: 'Financeiro processa estorno.',
            icone: 'ti-refresh',
            slaHoras: 8,
            criterios: [],
            atribuicao: { tipo: 'grupo', grupoSlug: 'financeiro', colaborador: '' },
            acao: { tipo: 'manual', rotas: [] },
          },
        },
        {
          ordem: 3,
          passo: {
            nome: 'Retorno ao cliente',
            descricao: 'N1 comunica resultado ao cliente.',
            icone: 'ti-device-desktop',
            slaHoras: 2,
            criterios: [],
            atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' },
            acao: { tipo: 'manual', rotas: [] },
          },
        },
      ],
      updatedBy: 'seed',
    });

    const first = doc.passos?.[0];
    if (first?._id) {
      doc.passoInicialId = first._id;
      await doc.save();
    }

    console.log('Seed: workflow reembolso-7dias criado');
  }

  const escalonarSeeds = [
    {
      slug: 'escalonar-financeiro',
      titulo: 'ENCAMINHAMENTO FINANCEIRO',
      passos: [
        { ordem: 0, passo: { nome: 'Triagem N1', descricao: 'N1 prepara encaminhamento financeiro.', icone: 'ti-circle-check', slaHoras: 2, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
        { ordem: 1, passo: { nome: 'Aprovação financeiro', descricao: '', icone: 'ti-building-bank', slaHoras: 4, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'financeiro', colaborador: '' }, acao: { tipo: 'aprovacao', rotas: [{ variavel: 'approve', rotulo: 'Aprovar', proximoPassoId: null, statusTicket: 'em-andamento' }, { variavel: 'reject', rotulo: 'Reprovar', proximoPassoId: null, statusTicket: 'pendente' }, { variavel: 'request_info', rotulo: 'Pedir informação', proximoPassoId: null, statusTicket: 'pendente' }] } } },
        { ordem: 2, passo: { nome: 'Estorno processado', descricao: '', icone: 'ti-refresh', slaHoras: 8, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'financeiro', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
        { ordem: 3, passo: { nome: 'Retorno ao cliente', descricao: '', icone: 'ti-device-desktop', slaHoras: 2, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
      ],
    },
    {
      slug: 'escalonar-n2',
      titulo: 'ENCAMINHAMENTO N2',
      passos: [
        { ordem: 0, passo: { nome: 'Análise N2', descricao: 'N2 analisa o encaminhamento.', icone: 'ti-arrows-exchange', slaHoras: 4, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n2', colaborador: '' }, acao: { tipo: 'aprovacao', rotas: [{ variavel: 'approve', rotulo: 'Aprovar', proximoPassoId: null, statusTicket: 'em-andamento' }, { variavel: 'reject', rotulo: 'Reprovar', proximoPassoId: null, statusTicket: 'pendente' }, { variavel: 'request_info', rotulo: 'Pedir informação', proximoPassoId: null, statusTicket: 'pendente' }] } } },
        { ordem: 1, passo: { nome: 'Retorno ao cliente', descricao: '', icone: 'ti-device-desktop', slaHoras: 2, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
      ],
    },
    {
      slug: 'escalonar-suporte',
      titulo: 'ENCAMINHAMENTO SUPORTE',
      passos: [
        { ordem: 0, passo: { nome: 'Diagnóstico suporte', descricao: 'Suporte técnico diagnostica o caso.', icone: 'ti-tool', slaHoras: 4, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'suporte', colaborador: '' }, acao: { tipo: 'aprovacao', rotas: [{ variavel: 'approve', rotulo: 'Aprovar', proximoPassoId: null, statusTicket: 'em-andamento' }, { variavel: 'reject', rotulo: 'Reprovar', proximoPassoId: null, statusTicket: 'pendente' }, { variavel: 'request_info', rotulo: 'Pedir informação', proximoPassoId: null, statusTicket: 'pendente' }] } } },
        { ordem: 1, passo: { nome: 'Retorno ao cliente', descricao: '', icone: 'ti-device-desktop', slaHoras: 2, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
      ],
    },
  ];

  for (const seed of escalonarSeeds) {
    const exists = await Workflow.findOne({ slug: seed.slug }).select('_id').lean();
    if (exists) continue;
    const doc = await Workflow.create({
      slug: seed.slug,
      titulo: seed.titulo,
      descricao: 'Fluxo de encaminhamento',
      ordem: 10,
      ativo: true,
      gatilho: { tipo: 'tabulacao', criterios: [] },
      passos: seed.passos,
      updatedBy: 'seed',
    });
    const first = doc.passos?.[0];
    if (first?._id) {
      doc.passoInicialId = first._id;
      await doc.save();
    }
    console.log(`Seed: workflow ${seed.slug} criado`);
  }

  const repairSlugs = ['reembolso-7dias', 'escalonar-financeiro', 'escalonar-n2', 'escalonar-suporte'];
  for (const slug of repairSlugs) {
    const doc = await Workflow.findOne({ slug });
    if (doc && (await repairWorkflowPassos(doc))) {
      console.log(`Seed: workflow ${slug} — passos iniciais corrigidos (sem abertura)`);
    }
  }

  invalidateGrupoCache();
  invalidateWorkflowCache();
}
