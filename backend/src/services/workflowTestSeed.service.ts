/** workflowTestSeed v1.1.0 — tickets fictícios para Desk e console Workflow (Financeiro/Produtos) */
import mongoose from 'mongoose';
import { ChamadoN1, IChamadoN1, IRegistro } from '../models/ChamadoN1';
import type { IWorkflowDefinicao, IWorkflowPassoEnvelope } from '../models/WorkflowDefinicao';
import { getClienteModel } from '../models/Cliente';
import { getTabulacaoProdutoModel } from '../models/TabulacaoProduto';
import { invalidateTabulationCache } from './tabulation.service';
import { seedWorkflowConfig } from './workflowConfigSeed.service';
import { getWorkflowBySlug } from './workflowDefinicao.service';
import { buildLateralWorkflowDto } from './workflowDto.util';
import { buildTabulationFieldsFromTicket, resolveAtribuidoForPasso } from './workflowMatcher.service';
import { readTabulacaoSnapshot } from './chamado.mapper';

export const WORKFLOW_TEST_PROTOCOL_PREFIX = 'WF-TEST-';

const TEST_CLIENTS = [
  {
    cpf: '90100000001',
    nome: 'Helena Mendes',
    email: 'helena.mendes@email-teste.com',
    telefone: '11987650001',
  },
  {
    cpf: '90100000002',
    nome: 'Ricardo Almeida',
    email: 'ricardo.almeida@email-teste.com',
    telefone: '11987650002',
  },
  {
    cpf: '90100000003',
    nome: 'Camila Souza',
    email: 'camila.souza@email-teste.com',
    telefone: '11987650003',
  },
  {
    cpf: '90100000004',
    nome: 'Gustavo Lima',
    email: 'gustavo.lima@email-teste.com',
    telefone: '11987650004',
  },
  {
    cpf: '90100000005',
    nome: 'Patricia Nunes',
    email: 'patricia.nunes@email-teste.com',
    telefone: '11987650005',
  },
  {
    cpf: '90100000006',
    nome: 'Bruno Carvalho',
    email: 'bruno.carvalho@email-teste.com',
    telefone: '11987650006',
  },
  {
    cpf: '90100000007',
    nome: 'Maria Oliveira',
    email: 'maria.oliveira@email-teste.com',
    telefone: '11987650007',
  },
  {
    cpf: '90100000008',
    nome: 'Roberto Alves',
    email: 'roberto.alves@email-teste.com',
    telefone: '11987650008',
  },
  {
    cpf: '90100000009',
    nome: 'Fernanda Lima',
    email: 'fernanda.lima@email-teste.com',
    telefone: '11987650009',
  },
  {
    cpf: '90100000010',
    nome: 'Lucas Ferreira',
    email: 'lucas.ferreira@email-teste.com',
    telefone: '11987650010',
  },
  {
    cpf: '90100000011',
    nome: 'Juliana Costa',
    email: 'juliana.costa@email-teste.com',
    telefone: '11987650011',
  },
  {
    cpf: '90100000012',
    nome: 'Diego Martins',
    email: 'diego.martins@email-teste.com',
    telefone: '11987650012',
  },
  {
    cpf: '90100000013',
    nome: 'Amanda Ribeiro',
    email: 'amanda.ribeiro@email-teste.com',
    telefone: '11987650013',
  },
] as const;

const PRODUTO_X_TABULACAO = {
  produto: 'Produto X',
  ordem: 99,
  ativo: true,
  motivos: [
    {
      motivo: 'Reembolso',
      ordem: 0,
      ativo: true,
      detalhes: [
        { detalhe: 'Dentro de 7 dias', ordem: 0, ativo: true },
        { detalhe: 'Fora do prazo', ordem: 1, ativo: true },
        { detalhe: 'Em análise', ordem: 2, ativo: true },
      ],
    },
    {
      motivo: 'Cobrança indevida',
      ordem: 1,
      ativo: true,
      detalhes: [{ detalhe: 'Em análise', ordem: 0, ativo: true }],
    },
  ],
  updatedBy: 'workflow-test-seed',
};

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function buildClienteMessage(text: string, clientName: string, hours = 2): IRegistro {
  return {
    data: hoursAgo(hours),
    origin: 'cliente',
    autor: clientName,
    mensagemPublica: text,
    anexosMensagemPublica: [],
    anotacaoInterna: '',
    anexosAnotacaoInterna: [],
    alteracoes: [],
    metadados: {},
    status: 'novo',
  };
}

function buildWorkflowState(stepActiveHoursAgo = 3) {
  const startedAt = hoursAgo(stepActiveHoursAgo + 1).toISOString();
  const activeAt = hoursAgo(stepActiveHoursAgo).toISOString();
  const systemMessage =
    'Workflow **REEMBOLSO DENTRO DOS 7 DIAS** iniciado automaticamente com base na classificação do ticket.';

  return {
    templateId: 'reembolso-7dias',
    title: 'REEMBOLSO DENTRO DOS 7 DIAS',
    currentStepId: 'aprovacao-financeiro',
    startedAt,
    stepHistory: [
      { stepId: 'abertura', status: 'completed', at: startedAt, by: 'sistema' },
      { stepId: 'elegibilidade', status: 'completed', at: startedAt, by: 'sistema' },
      {
        stepId: 'aprovacao-financeiro',
        status: 'active',
        at: activeAt,
        by: 'sistema',
      },
    ],
    systemMessage,
    systemMessageInjected: true,
  };
}

function buildApprovalMeta(overrides: Record<string, unknown> = {}) {
  return {
    valor: 249.9,
    pedido: '#PED-2026-98732',
    formaPagamento: 'Cartão · final 4521',
    dataCompra: hoursAgo(4 * 24).toISOString(),
    diasDesdeCompra: 4,
    canal: 'WhatsApp',
    ...overrides,
  };
}

function buildWorkflowAgentRegistro(options: {
  agentName: string;
  note: string;
  stepActiveHoursAgo?: number;
  approval?: Record<string, unknown>;
  tabulacao?: { produto?: string; motivo?: string; detalhe?: string };
}) {
  return {
    data: hoursAgo(options.stepActiveHoursAgo ?? 3),
    origin: 'agente' as const,
    autor: options.agentName,
    mensagemPublica: '',
    anexosMensagemPublica: [],
    anotacaoInterna: options.note,
    anexosAnotacaoInterna: [],
    alteracoes: [
      {
        tipoChamado: 'Solicitação',
        produto: options.tabulacao?.produto ?? 'Produto X',
        motivo: options.tabulacao?.motivo ?? 'Reembolso',
        detalhe: options.tabulacao?.detalhe ?? 'Dentro de 7 dias',
      },
    ],
    metadados: {
      workflow: buildWorkflowState(options.stepActiveHoursAgo),
      approval: buildApprovalMeta(options.approval),
    },
    status: 'em-aberto',
  };
}

async function upsertTestClient(client: (typeof TEST_CLIENTS)[number]) {
  const Cliente = getClienteModel();
  const existing = await Cliente.findOne({ 'clienteDados.clienteCpf': client.cpf });
  if (existing) {
    existing.clienteDados[0].clienteNome = client.nome;
    existing.clienteDados[0].clienteEmail = { lista: [client.email] };
    existing.clienteDados[0].clienteTelefone = { lista: [client.telefone] };
    await existing.save();
    return existing;
  }

  return Cliente.create({
    clienteDados: [
      {
        clienteCpf: client.cpf,
        clienteNome: client.nome,
        clienteEmail: { lista: [client.email] },
        clienteTelefone: { lista: [client.telefone] },
      },
    ],
    atendimentoHistorico: [],
  });
}

async function ensureProdutoXTabulation() {
  const Produto = getTabulacaoProdutoModel();
  const existing = await Produto.findOne({ produto: PRODUTO_X_TABULACAO.produto });
  if (existing) {
    existing.motivos = PRODUTO_X_TABULACAO.motivos;
    existing.ativo = true;
    existing.ordem = PRODUTO_X_TABULACAO.ordem;
    existing.updatedBy = PRODUTO_X_TABULACAO.updatedBy;
    await existing.save();
    return;
  }

  await Produto.create(PRODUTO_X_TABULACAO);
}

async function upsertTestTicket(doc: Partial<IChamadoN1>): Promise<{ created: boolean; protocolo: string }> {
  const protocolo = String(doc.chamadoProtocolo ?? '').trim();
  const exists = await ChamadoN1.findOne({ chamadoProtocolo: protocolo }).select('_id').lean();
  if (exists) {
    await ChamadoN1.updateOne({ chamadoProtocolo: protocolo }, { $set: doc });
    return { created: false, protocolo };
  }

  await ChamadoN1.create(doc);
  return { created: true, protocolo };
}

function sortPassos(definicao: IWorkflowDefinicao): IWorkflowPassoEnvelope[] {
  return [...(definicao.passos || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

function applyAtribuidoForPasso(chamado: IChamadoN1, passo: IWorkflowPassoEnvelope): void {
  const fields = buildTabulationFieldsFromTicket({
    tabulacao: chamado.tabulacao as unknown as Array<Record<string, string>>,
  });
  const atribuido = resolveAtribuidoForPasso(
    passo.passo?.atribuicao || { tipo: 'funcao', funcaoSlug: 'atendimento', grupoSlug: '', colaborador: '' },
    fields,
  );
  if (!atribuido) return;
  const tab = readTabulacaoSnapshot(chamado.tabulacao[0]);
  chamado.tabulacao = [{ ...tab, atribuido }];
}

async function hydrateTicketWorkflow(
  protocolo: string,
  slug: string,
  stepIndex: number,
  options: {
    stepActiveHoursAgo?: number;
    pendingDecision?: 'approve' | 'reject' | null;
    approval?: Record<string, unknown>;
    note?: string;
  } = {},
): Promise<void> {
  const chamado = await ChamadoN1.findOne({ chamadoProtocolo: protocolo });
  if (!chamado) return;

  const definicao = await getWorkflowBySlug(slug);
  if (!definicao) {
    console.warn(`[seed] Workflow "${slug}" não encontrado — ${protocolo} sem workflow top-level`);
    return;
  }

  const passos = sortPassos(definicao);
  const passo = passos[stepIndex];
  if (!passo) return;

  const startedAt = hoursAgo((options.stepActiveHoursAgo ?? 3) + 2);
  chamado.workflow = {
    active: true,
    workflowId: definicao._id as mongoose.Types.ObjectId,
    step: stepIndex,
    passoId: (passo._id as mongoose.Types.ObjectId) || null,
    startedAt,
    completedAt: null,
    pendingDecision: options.pendingDecision ?? null,
  };

  applyAtribuidoForPasso(chamado, passo);

  const lateralDto = buildLateralWorkflowDto(chamado, definicao);
  if (!lateralDto) return;

  const registro: IRegistro = {
    data: hoursAgo(options.stepActiveHoursAgo ?? 2),
    origin: 'agente',
    autor: 'Sistema (seed workflow)',
    mensagemPublica: '',
    anexosMensagemPublica: [],
    anotacaoInterna: options.note || `Workflow "${definicao.titulo}" posicionado na etapa ${stepIndex + 1}.`,
    anexosAnotacaoInterna: [],
    alteracoes: [{ workflowHydrated: slug, step: stepIndex }],
    metadados: {
      workflow: lateralDto,
      ...(options.approval ? { approval: options.approval } : {}),
    },
    status: 'em-aberto',
  };

  chamado.registro = [...(chamado.registro || []), registro];
  await chamado.save();
}

export async function seedWorkflowTestTickets(): Promise<{ created: number; skipped: number }> {
  await seedWorkflowConfig();
  await ensureProdutoXTabulation();
  invalidateTabulationCache();

  const clientRefs = new Map<string, mongoose.Types.ObjectId>();
  for (const client of TEST_CLIENTS) {
    const saved = await upsertTestClient(client);
    if (saved?._id) clientRefs.set(client.cpf, saved._id as mongoose.Types.ObjectId);
  }

  const [helena, ricardo, camila, gustavo, patricia, bruno, maria, roberto, fernanda, lucas, juliana, diego, amanda] = TEST_CLIENTS;

  const tickets: Partial<IChamadoN1>[] = [
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}001`,
      chamadoTitulo: '[TESTE] Reembolso Produto X em 7 dias',
      cliente: [
        {
          clienteCpf: helena.cpf,
          clienteId: clientRefs.get(helena.cpf) ?? null,
        },
      ],
      tabulacao: [
        {
          tipoChamado: '',
          produto: '',
          motivo: '',
          detalhe: '',
          responsavel: '',
          atribuido: '',
        },
      ],
      registro: [
        buildClienteMessage(
          'Olá, comprei o Produto X na semana passada e gostaria de solicitar o reembolso integral. A compra foi feita há 5 dias e ainda está dentro do prazo de 7 dias.',
          helena.nome,
          1
        ),
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}002`,
      chamadoTitulo: '[TESTE] Disputa de cobrança no cartão',
      cliente: [
        {
          clienteCpf: ricardo.cpf,
          clienteId: clientRefs.get(ricardo.cpf) ?? null,
        },
      ],
      tabulacao: [
        {
          tipoChamado: '',
          produto: '',
          motivo: '',
          detalhe: '',
          responsavel: '',
          atribuido: '',
        },
      ],
      registro: [
        buildClienteMessage(
          'Fui cobrado duas vezes no cartão de crédito referente à assinatura do mês. Preciso que o financeiro analise e estorne a cobrança duplicada.',
          ricardo.nome,
          2,
        ),
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}003`,
      chamadoTitulo: '[TESTE] Workflow ativo — aguardando financeiro',
      cliente: [
        {
          clienteCpf: camila.cpf,
          clienteId: clientRefs.get(camila.cpf) ?? null,
        },
      ],
      tabulacao: [
        {
          tipoChamado: 'Solicitação',
          produto: 'Produto X',
          motivo: 'Reembolso',
          detalhe: 'Dentro de 7 dias',
          responsavel: 'admin@velodesk.local',
          atribuido: '',
        },
      ],
      registro: [
        buildClienteMessage(
          'Bom dia! Solicito reembolso do Produto X. A compra foi realizada há 4 dias.',
          camila.nome,
          5,
        ),
        {
          data: hoursAgo(3),
          origin: 'agente',
          autor: 'Admin Velodesk',
          mensagemPublica: '',
          anexosMensagemPublica: [],
          anotacaoInterna: 'Classificação aplicada — workflow de reembolso iniciado.',
          anexosAnotacaoInterna: [],
          alteracoes: [
            {
              tipoChamado: 'Solicitação',
              produto: 'Produto X',
              motivo: 'Reembolso',
              detalhe: 'Dentro de 7 dias',
            },
          ],
          metadados: {
            workflow: buildWorkflowState(2.5),
            approval: buildApprovalMeta({ valor: 189.5, pedido: '#PED-2026-98701' }),
          },
          status: 'em-aberto',
        },
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}007`,
      chamadoTitulo: '[TESTE] Aprovação reembolso — Maria Oliveira',
      cliente: [{ clienteCpf: maria.cpf, clienteId: clientRefs.get(maria.cpf) ?? null }],
      tabulacao: [{
        tipoChamado: 'Solicitação',
        produto: 'Produto X',
        motivo: 'Reembolso',
        detalhe: 'Dentro de 7 dias',
        responsavel: 'Ana Silva',
        atribuido: '',
      }],
      registro: [
        buildClienteMessage(
          'Comprei o Produto X há 4 dias e quero solicitar o reembolso integral conforme a política de 7 dias.',
          maria.nome,
          6,
        ),
        buildWorkflowAgentRegistro({
          agentName: 'Ana Silva (Atendimento)',
          note: 'Atendimento confirmou elegibilidade e encaminhou para aprovação.',
          stepActiveHoursAgo: 1.33,
          approval: buildApprovalMeta({ valor: 249.9, canal: 'WhatsApp' }),
        }),
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}008`,
      chamadoTitulo: '[TESTE] Aprovação reembolso — Roberto Alves',
      cliente: [{ clienteCpf: roberto.cpf, clienteId: clientRefs.get(roberto.cpf) ?? null }],
      tabulacao: [{
        tipoChamado: 'Solicitação',
        produto: 'duplicidade',
        motivo: 'Estorno',
        detalhe: 'Em análise',
        responsavel: 'Ana Silva',
        atribuido: '',
      }],
      registro: [
        buildClienteMessage(
          'Preciso do reembolso do Produto X. Compra realizada por e-mail há 5 dias.',
          roberto.nome,
          8,
        ),
        buildWorkflowAgentRegistro({
          agentName: 'Ana Silva (Atendimento)',
          note: 'Cliente elegível — encaminhado ao financeiro.',
          stepActiveHoursAgo: 2.75,
          approval: buildApprovalMeta({
            valor: 89.9,
            canal: 'E-mail',
            formaPagamento: 'Cartão · final 4521',
          }),
        }),
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}009`,
      chamadoTitulo: '[TESTE] Aprovação reembolso — Fernanda Lima (SLA crítico)',
      cliente: [{ clienteCpf: fernanda.cpf, clienteId: clientRefs.get(fernanda.cpf) ?? null }],
      tabulacao: [{
        tipoChamado: 'Solicitação',
        produto: 'Produto Y',
        motivo: 'Reembolso',
        detalhe: 'Dentro de 7 dias',
        responsavel: 'Ana Silva',
        atribuido: '',
      }],
      registro: [
        buildClienteMessage(
          'Liguei para solicitar reembolso do Produto X. A compra foi há 3 dias e preciso de urgência.',
          fernanda.nome,
          10,
        ),
        buildWorkflowAgentRegistro({
          agentName: 'Ana Silva (Atendimento)',
          note: 'Urgente — SLA financeiro prestes a vencer.',
          stepActiveHoursAgo: 3.83,
          approval: buildApprovalMeta({
            valor: 599,
            canal: 'Telefone',
            diasDesdeCompra: 3,
          }),
        }),
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}010`,
      chamadoTitulo: '[TESTE] Escalonamento financeiro — cobrança duplicada',
      cliente: [{ clienteCpf: lucas.cpf, clienteId: clientRefs.get(lucas.cpf) ?? null }],
      tabulacao: [{
        tipoChamado: 'Solicitação',
        produto: 'Produto X',
        motivo: 'Cobrança indevida',
        detalhe: 'Em análise',
        responsavel: 'Ana Silva',
        atribuido: '',
      }],
      registro: [
        buildClienteMessage(
          'Fui cobrado duas vezes no cartão referente à assinatura. Preciso que o financeiro estorne a duplicidade.',
          lucas.nome,
          4,
        ),
        {
          data: hoursAgo(2),
          origin: 'agente',
          autor: 'Ana Silva (Atendimento)',
          mensagemPublica: '',
          anexosMensagemPublica: [],
          anotacaoInterna: 'N1 encaminhou para aprovação do financeiro.',
          anexosAnotacaoInterna: [],
          alteracoes: [{ escalonar: 'financeiro' }],
          metadados: { approval: buildApprovalMeta({ valor: 79.9, pedido: '#PED-2026-99001', canal: 'WhatsApp' }) },
          status: 'em-aberto',
        },
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}011`,
      chamadoTitulo: '[TESTE] Escalonamento financeiro — estorno em processamento',
      cliente: [{ clienteCpf: juliana.cpf, clienteId: clientRefs.get(juliana.cpf) ?? null }],
      tabulacao: [{
        tipoChamado: 'Solicitação',
        produto: 'Produto X',
        motivo: 'Reembolso',
        detalhe: 'Dentro de 7 dias',
        responsavel: 'Ana Silva',
        atribuido: '',
      }],
      registro: [
        buildClienteMessage(
          'Solicito estorno do valor cobrado indevidamente na fatura de março.',
          juliana.nome,
          12,
        ),
        {
          data: hoursAgo(7),
          origin: 'agente',
          autor: 'Ana Silva (Atendimento)',
          mensagemPublica: '',
          anexosMensagemPublica: [],
          anotacaoInterna: 'Encaminhado ao financeiro — aguardando processamento do estorno.',
          anexosAnotacaoInterna: [],
          alteracoes: [{ escalonar: 'financeiro' }],
          metadados: { approval: buildApprovalMeta({ valor: 149.9, pedido: '#PED-2026-99002' }) },
          status: 'em-aberto',
        },
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}012`,
      chamadoTitulo: '[TESTE] Escalonamento produtos — cancelamento de pacote',
      cliente: [{ clienteCpf: diego.cpf, clienteId: clientRefs.get(diego.cpf) ?? null }],
      tabulacao: [{
        tipoChamado: 'Solicitação',
        produto: 'Produto Y',
        motivo: 'Cancelamento',
        detalhe: 'Em análise',
        responsavel: 'Ana Silva',
        atribuido: '',
      }],
      registro: [
        buildClienteMessage(
          'Quero cancelar o pacote premium do Produto Y. Não utilizo mais os recursos inclusos.',
          diego.nome,
          3,
        ),
        {
          data: hoursAgo(3),
          origin: 'agente',
          autor: 'Ana Silva (Atendimento)',
          mensagemPublica: '',
          anexosMensagemPublica: [],
          anotacaoInterna: 'Encaminhado ao time de produtos para análise de cancelamento.',
          anexosAnotacaoInterna: [],
          alteracoes: [{ escalonar: 'produtos' }],
          metadados: { approval: buildApprovalMeta({ valor: 0, pedido: '#PED-2026-99003', canal: 'Portal' }) },
          status: 'em-aberto',
        },
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}013`,
      chamadoTitulo: '[TESTE] Escalonamento produtos — dúvida sobre funcionalidade',
      cliente: [{ clienteCpf: amanda.cpf, clienteId: clientRefs.get(amanda.cpf) ?? null }],
      tabulacao: [{
        tipoChamado: 'Solicitação',
        produto: 'Produto Y',
        motivo: 'Dúvida',
        detalhe: 'Em análise',
        responsavel: 'Ana Silva',
        atribuido: '',
      }],
      registro: [
        buildClienteMessage(
          'O Produto Y parou de sincronizar com meu aplicativo. Preciso de análise do time de produtos.',
          amanda.nome,
          7,
        ),
        {
          data: hoursAgo(5),
          origin: 'agente',
          autor: 'Ana Silva (Atendimento)',
          mensagemPublica: '',
          anexosMensagemPublica: [],
          anotacaoInterna: 'Escalonado para produtos — cliente aguarda retorno técnico.',
          anexosAnotacaoInterna: [],
          alteracoes: [{ escalonar: 'produtos' }],
          metadados: {},
          status: 'em-aberto',
        },
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}004`,
      chamadoTitulo: '[TESTE] Lentidão na internet fibra',
      cliente: [
        {
          clienteCpf: gustavo.cpf,
          clienteId: clientRefs.get(gustavo.cpf) ?? null,
        },
      ],
      tabulacao: [
        {
          tipoChamado: '',
          produto: '',
          motivo: '',
          detalhe: '',
          responsavel: '',
          atribuido: '',
        },
      ],
      registro: [
        buildClienteMessage(
          'Minha internet fibra está muito lenta desde ontem à noite. Velocidade caiu de 500 Mbps para menos de 50 Mbps.',
          gustavo.nome,
          0.5,
        ),
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}005`,
      chamadoTitulo: '[TESTE] Cancelamento do pacote TV',
      cliente: [
        {
          clienteCpf: patricia.cpf,
          clienteId: clientRefs.get(patricia.cpf) ?? null,
        },
      ],
      tabulacao: [
        {
          tipoChamado: '',
          produto: '',
          motivo: '',
          detalhe: '',
          responsavel: '',
          atribuido: '',
        },
      ],
      registro: [
        buildClienteMessage(
          'Quero cancelar meu pacote de TV. Não uso mais os canais premium e preciso encaminhar para o time responsável.',
          patricia.nome,
          3,
        ),
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}006`,
      chamadoTitulo: '[TESTE] Dúvida sobre valor da fatura',
      cliente: [
        {
          clienteCpf: bruno.cpf,
          clienteId: clientRefs.get(bruno.cpf) ?? null,
        },
      ],
      tabulacao: [
        {
          tipoChamado: '',
          produto: '',
          motivo: '',
          detalhe: '',
          responsavel: '',
          atribuido: '',
        },
      ],
      registro: [
        buildClienteMessage(
          'Recebi a fatura deste mês e o valor veio diferente do combinado. Podem me explicar os itens cobrados?',
          bruno.nome,
          4,
        ),
      ],
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const ticket of tickets) {
    const result = await upsertTestTicket(ticket);
    if (result.created) created += 1;
    else skipped += 1;
  }

  const workflowHydrations: Array<Parameters<typeof hydrateTicketWorkflow>> = [
    [`${WORKFLOW_TEST_PROTOCOL_PREFIX}003`, 'reembolso-7dias', 1, { stepActiveHoursAgo: 2.5, approval: buildApprovalMeta({ valor: 189.5 }) }],
    [`${WORKFLOW_TEST_PROTOCOL_PREFIX}007`, 'reembolso-7dias', 1, { stepActiveHoursAgo: 1.33, approval: buildApprovalMeta({ valor: 249.9, canal: 'WhatsApp' }) }],
    [`${WORKFLOW_TEST_PROTOCOL_PREFIX}008`, 'reembolso-7dias', 1, { stepActiveHoursAgo: 2.75, approval: buildApprovalMeta({ valor: 89.9, canal: 'E-mail' }) }],
    [`${WORKFLOW_TEST_PROTOCOL_PREFIX}009`, 'reembolso-7dias', 1, { stepActiveHoursAgo: 3.83, approval: buildApprovalMeta({ valor: 599, canal: 'Telefone' }) }],
    [`${WORKFLOW_TEST_PROTOCOL_PREFIX}010`, 'escalonar-financeiro', 1, { stepActiveHoursAgo: 1.5, approval: buildApprovalMeta({ valor: 79.9, pedido: '#PED-2026-99001' }) }],
    [`${WORKFLOW_TEST_PROTOCOL_PREFIX}011`, 'escalonar-financeiro', 2, { stepActiveHoursAgo: 5, note: 'Financeiro aprovou — estorno em processamento.' }],
    [`${WORKFLOW_TEST_PROTOCOL_PREFIX}012`, 'escalonar-produtos', 1, { stepActiveHoursAgo: 2, approval: buildApprovalMeta({ valor: 0, pedido: '#PED-2026-99003' }) }],
    [`${WORKFLOW_TEST_PROTOCOL_PREFIX}013`, 'escalonar-produtos', 1, { stepActiveHoursAgo: 4.5 }],
  ];

  for (const args of workflowHydrations) {
    await hydrateTicketWorkflow(...args);
  }

  return { created, skipped };
}

export async function purgeWorkflowTestTickets(): Promise<number> {
  const result = await ChamadoN1.deleteMany({
    chamadoProtocolo: { $regex: `^${WORKFLOW_TEST_PROTOCOL_PREFIX}` },
  });

  const Cliente = getClienteModel();
  const cpfs = TEST_CLIENTS.map((c) => c.cpf);
  await Cliente.deleteMany({ 'clienteDados.clienteCpf': { $in: cpfs } });

  return result.deletedCount ?? 0;
}
