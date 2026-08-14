/** workflowConfigSeed v1.4.0 — remove workflows experimental escalonar-*; purge no seed */
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

const EXPERIMENTAL_ESCALONAR_WORKFLOW_SLUGS = [
  'escalonar-financeiro',
  'escalonar-produtos',
  'escalonar-n2',
  'escalonar-suporte',
] as const;

async function purgeExperimentalEscalonarWorkflows(): Promise<void> {
  const Workflow = getWorkflowDefinicaoModel();
  const result = await Workflow.deleteMany({
    slug: { $in: [...EXPERIMENTAL_ESCALONAR_WORKFLOW_SLUGS] },
  });
  if (result.deletedCount) {
    console.log(`Purge: ${result.deletedCount} workflow(s) experimental escalonar-* removido(s)`);
  }
}

export async function seedWorkflowConfig(): Promise<void> {
  await purgeExperimentalEscalonarWorkflows();

  const Grupo = getGrupoResponsabilidadeModel();
  const grupoCount = await Grupo.countDocuments();
  if (grupoCount === 0) {
    await Grupo.insertMany(
      DEFAULT_GRUPOS.map((g) => ({ ...g, updatedBy: 'seed' })),
    );
    console.log(`Seed: ${DEFAULT_GRUPOS.length} grupo(s) de responsabilidade criados`);
  } else {
    for (const grupo of DEFAULT_GRUPOS) {
      const exists = await Grupo.findOne({ slug: grupo.slug }).select('_id').lean();
      if (!exists) {
        await Grupo.create({ ...grupo, updatedBy: 'seed' });
        console.log(`Seed: grupo ${grupo.slug} criado`);
      }
    }
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
            slaHoras: 2,
            atribuicao: { tipo: 'funcao', funcaoSlug: 'atendimento', grupoSlug: '', colaborador: '' },
            acao: { tipo: 'manual', rotas: [] },
          },
        },
        {
          ordem: 1,
          passo: {
            nome: 'Aprovação financeiro',
            descricao: 'Financeiro analisa e decide.',
            slaHoras: 4,
            atribuicao: { tipo: 'funcao', funcaoSlug: 'financeiro', grupoSlug: '', colaborador: '' },
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
            slaHoras: 8,
            atribuicao: { tipo: 'funcao', funcaoSlug: 'financeiro', grupoSlug: '', colaborador: '' },
            acao: { tipo: 'manual', rotas: [] },
          },
        },
        {
          ordem: 3,
          passo: {
            nome: 'Retorno ao cliente',
            descricao: 'N1 comunica resultado ao cliente.',
            slaHoras: 2,
            atribuicao: { tipo: 'funcao', funcaoSlug: 'atendimento', grupoSlug: '', colaborador: '' },
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

  const raTratativaExists = await Workflow.findOne({ slug: 'reclame-aqui-tratativa' }).select('_id').lean();
  if (!raTratativaExists) {
    const doc = await Workflow.create({
      slug: 'reclame-aqui-tratativa',
      titulo: 'TRATATIVA RECLAME AQUI',
      descricao: 'Fluxo de tratativa de reclamações publicadas no Reclame Aqui',
      ordem: 5,
      ativo: true,
      gatilho: {
        tipo: 'tabulacao',
        criterios: [
          { fonte: 'tabulacao', campo: 'canal', operador: 'equals', valor: 'Reclame Aqui' },
        ],
      },
      passos: [
        { ordem: 0, passo: { nome: 'Triagem N1', descricao: 'N1 analisa a reclamação RA.', icone: 'ti-circle-check', slaHoras: 4, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
        { ordem: 1, passo: { nome: 'Resposta pública RA', descricao: 'Publicar resposta no Reclame Aqui.', icone: 'ti-message-circle', slaHoras: 48, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
        { ordem: 2, passo: { nome: 'Aguardando avaliação', descricao: 'Aguardar avaliação do consumidor.', icone: 'ti-star', slaHoras: 72, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
      ],
      updatedBy: 'seed',
    });
    const first = doc.passos?.[0];
    if (first?._id) {
      doc.passoInicialId = first._id;
      await doc.save();
    }
    console.log('Seed: workflow reclame-aqui-tratativa criado');
  }

  const pcTratativaExists = await Workflow.findOne({ slug: 'procon-tratativa' }).select('_id').lean();
  if (!pcTratativaExists) {
    const doc = await Workflow.create({
      slug: 'procon-tratativa',
      titulo: 'TRATATIVA PROCON',
      descricao: 'Fluxo de tratativa de demandas registradas no Procon',
      ordem: 6,
      ativo: true,
      gatilho: {
        tipo: 'tabulacao',
        criterios: [
          { fonte: 'tabulacao', campo: 'canal', operador: 'equals', valor: 'Procon' },
        ],
      },
      passos: [
        { ordem: 0, passo: { nome: 'Triagem N1', descricao: 'N1 analisa a demanda Procon.', icone: 'ti-circle-check', slaHoras: 8, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
        { ordem: 1, passo: { nome: 'Resposta formal', descricao: 'Elaborar resposta formal ao Procon.', icone: 'ti-file-text', slaHoras: 72, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
        { ordem: 2, passo: { nome: 'Encerramento', descricao: 'Encerrar demanda após tratativa.', icone: 'ti-check', slaHoras: 24, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
      ],
      updatedBy: 'seed',
    });
    const first = doc.passos?.[0];
    if (first?._id) {
      doc.passoInicialId = first._id;
      await doc.save();
    }
    console.log('Seed: workflow procon-tratativa criado');
  }


  const cgTratativaExists = await Workflow.findOne({ slug: 'consumidor-gov-tratativa' }).select('_id').lean();
  if (!cgTratativaExists) {
    const doc = await Workflow.create({
      slug: 'consumidor-gov-tratativa',
      titulo: 'TRATATIVA CONSUMIDOR.GOV',
      descricao: 'Fluxo de tratativa de demandas registradas no Consumidor.Gov',
      ordem: 7,
      ativo: true,
      gatilho: {
        tipo: 'tabulacao',
        criterios: [
          { fonte: 'tabulacao', campo: 'canal', operador: 'equals', valor: 'Consumidor.Gov' },
        ],
      },
      passos: [
        { ordem: 0, passo: { nome: 'Triagem N1', descricao: 'N1 analisa a demanda Consumidor.Gov.', icone: 'ti-circle-check', slaHoras: 8, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
        { ordem: 1, passo: { nome: 'Resposta formal', descricao: 'Elaborar resposta formal no portal Consumidor.Gov.', icone: 'ti-file-text', slaHoras: 72, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
        { ordem: 2, passo: { nome: 'Encerramento', descricao: 'Encerrar demanda após tratativa.', icone: 'ti-check', slaHoras: 24, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
      ],
      updatedBy: 'seed',
    });
    const first = doc.passos?.[0];
    if (first?._id) {
      doc.passoInicialId = first._id;
      await doc.save();
    }
    console.log('Seed: workflow consumidor-gov-tratativa criado');
  }

  const bcTratativaExists = await Workflow.findOne({ slug: 'bacen-tratativa' }).select('_id').lean();
  if (!bcTratativaExists) {
    const doc = await Workflow.create({
      slug: 'bacen-tratativa',
      titulo: 'TRATATIVA BACEN',
      descricao: 'Fluxo de tratativa de demandas registradas no Bacen',
      ordem: 8,
      ativo: true,
      gatilho: {
        tipo: 'tabulacao',
        criterios: [
          { fonte: 'tabulacao', campo: 'canal', operador: 'equals', valor: 'Bacen' },
        ],
      },
      passos: [
        { ordem: 0, passo: { nome: 'Triagem N1', descricao: 'N1 analisa a demanda Bacen.', icone: 'ti-circle-check', slaHoras: 8, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
        { ordem: 1, passo: { nome: 'Resposta formal', descricao: 'Elaborar resposta formal ao Bacen.', icone: 'ti-file-text', slaHoras: 72, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
        { ordem: 2, passo: { nome: 'Encerramento', descricao: 'Encerrar demanda após tratativa.', icone: 'ti-check', slaHoras: 24, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
      ],
      updatedBy: 'seed',
    });
    const first = doc.passos?.[0];
    if (first?._id) {
      doc.passoInicialId = first._id;
      await doc.save();
    }
    console.log('Seed: workflow bacen-tratativa criado');
  }

  const escalonarSeeds = [
    {
      slug: 'escalonar-financeiro',
      titulo: 'ENCAMINHAMENTO FINANCEIRO',
      passos: [
        { ordem: 0, passo: { nome: 'Triagem N1', descricao: 'N1 prepara encaminhamento financeiro.', slaHoras: 2, atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
        { ordem: 1, passo: { nome: 'Aprovação financeiro', descricao: '', slaHoras: 4, atribuicao: { tipo: 'grupo', grupoSlug: 'financeiro', colaborador: '' }, acao: { tipo: 'aprovacao', rotas: [{ variavel: 'approve', rotulo: 'Aprovar', proximoPassoId: null, statusTicket: 'em-andamento' }, { variavel: 'reject', rotulo: 'Reprovar', proximoPassoId: null, statusTicket: 'pendente' }, { variavel: 'request_info', rotulo: 'Pedir informação', proximoPassoId: null, statusTicket: 'pendente' }] } } },
        { ordem: 2, passo: { nome: 'Estorno processado', descricao: '', slaHoras: 8, atribuicao: { tipo: 'grupo', grupoSlug: 'financeiro', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
        { ordem: 3, passo: { nome: 'Retorno ao cliente', descricao: '', slaHoras: 2, atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
      ],
    },
    {
      slug: 'escalonar-produtos',
      titulo: 'ENCAMINHAMENTO PRODUTOS',
      passos: [
        { ordem: 0, passo: { nome: 'Triagem N1', descricao: 'N1 prepara encaminhamento para produtos.', icone: 'ti-circle-check', slaHoras: 2, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
        { ordem: 1, passo: { nome: 'Análise produtos', descricao: '', icone: 'ti-package', slaHoras: 4, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'produtos', colaborador: '' }, acao: { tipo: 'aprovacao', rotas: [{ variavel: 'approve', rotulo: 'Aprovar', proximoPassoId: null, statusTicket: 'em-andamento' }, { variavel: 'reject', rotulo: 'Reprovar', proximoPassoId: null, statusTicket: 'pendente' }, { variavel: 'request_info', rotulo: 'Pedir informação', proximoPassoId: null, statusTicket: 'pendente' }] } } },
        { ordem: 2, passo: { nome: 'Retorno ao cliente', descricao: '', icone: 'ti-device-desktop', slaHoras: 2, criterios: [], atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
      ],
    },
    {
      slug: 'escalonar-n2',
      titulo: 'ENCAMINHAMENTO N2',
      passos: [
        { ordem: 0, passo: { nome: 'Análise N2', descricao: 'N2 analisa o encaminhamento.', slaHoras: 4, atribuicao: { tipo: 'grupo', grupoSlug: 'n2', colaborador: '' }, acao: { tipo: 'aprovacao', rotas: [{ variavel: 'approve', rotulo: 'Aprovar', proximoPassoId: null, statusTicket: 'em-andamento' }, { variavel: 'reject', rotulo: 'Reprovar', proximoPassoId: null, statusTicket: 'pendente' }, { variavel: 'request_info', rotulo: 'Pedir informação', proximoPassoId: null, statusTicket: 'pendente' }] } } },
        { ordem: 1, passo: { nome: 'Retorno ao cliente', descricao: '', slaHoras: 2, atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
      ],
    },
    {
      slug: 'escalonar-suporte',
      titulo: 'ENCAMINHAMENTO SUPORTE',
      passos: [
        { ordem: 0, passo: { nome: 'Diagnóstico suporte', descricao: 'Suporte técnico diagnostica o caso.', slaHoras: 4, atribuicao: { tipo: 'grupo', grupoSlug: 'suporte', colaborador: '' }, acao: { tipo: 'aprovacao', rotas: [{ variavel: 'approve', rotulo: 'Aprovar', proximoPassoId: null, statusTicket: 'em-andamento' }, { variavel: 'reject', rotulo: 'Reprovar', proximoPassoId: null, statusTicket: 'pendente' }, { variavel: 'request_info', rotulo: 'Pedir informação', proximoPassoId: null, statusTicket: 'pendente' }] } } },
        { ordem: 1, passo: { nome: 'Retorno ao cliente', descricao: '', slaHoras: 2, atribuicao: { tipo: 'grupo', grupoSlug: 'n1', colaborador: '' }, acao: { tipo: 'manual', rotas: [] } } },
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

  const repairSlugs = ['reembolso-7dias', 'reclame-aqui-tratativa', 'procon-tratativa', 'consumidor-gov-tratativa', 'bacen-tratativa', 'escalonar-financeiro', 'escalonar-produtos', 'escalonar-n2', 'escalonar-suporte'];
  for (const slug of repairSlugs) {
    const doc = await Workflow.findOne({ slug });
    if (doc) await repairWorkflowPassos(doc);
  }

  invalidateGrupoCache();
  invalidateWorkflowCache();
}
