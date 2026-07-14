/** workflowTestSeed v1.0.0 â€” tickets fictÃ­cios para testar workflow visual no Desk (dev) */
import mongoose from 'mongoose';
import { ChamadoN1, IChamadoN1, IRegistro } from '../models/ChamadoN1';
import { getClienteModel } from '../models/Cliente';
import { getTabulacaoProdutoModel } from '../models/TabulacaoProduto';
import { invalidateTabulationCache } from './tabulation.service';

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
        { detalhe: 'Em anÃ¡lise', ordem: 2, ativo: true },
      ],
    },
    {
      motivo: 'CobranÃ§a indevida',
      ordem: 1,
      ativo: true,
      detalhes: [{ detalhe: 'Em anÃ¡lise', ordem: 0, ativo: true }],
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
    'Workflow **REEMBOLSO DENTRO DOS 7 DIAS** iniciado automaticamente com base na classificaÃ§Ã£o do ticket.';

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
    formaPagamento: 'CartÃ£o Â· final 4521',
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
        tipoChamado: 'SolicitaÃ§Ã£o',
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

async function createTestTicket(doc: Partial<IChamadoN1>) {
  const protocolo = String(doc.chamadoProtocolo ?? '').trim();
  const exists = await ChamadoN1.findOne({ chamadoProtocolo: protocolo });
  if (exists) return { created: false, protocolo };

  await ChamadoN1.create(doc);
  return { created: true, protocolo };
}

export async function seedWorkflowTestTickets(): Promise<{ created: number; skipped: number }> {
  await ensureProdutoXTabulation();
  invalidateTabulationCache();

  const clientRefs = new Map<string, mongoose.Types.ObjectId>();
  for (const client of TEST_CLIENTS) {
    const saved = await upsertTestClient(client);
    if (saved?._id) clientRefs.set(client.cpf, saved._id as mongoose.Types.ObjectId);
  }

  const [helena, ricardo, camila, gustavo, patricia, bruno, maria, roberto, fernanda] = TEST_CLIENTS;

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
          'OlÃ¡, comprei o Produto X na semana passada e gostaria de solicitar o reembolso integral. A compra foi feita hÃ¡ 5 dias e ainda estÃ¡ dentro do prazo de 7 dias.',
          helena.nome,
          1
        ),
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}002`,
      chamadoTitulo: '[TESTE] Disputa de cobranÃ§a no cartÃ£o',
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
          'Fui cobrado duas vezes no cartÃ£o de crÃ©dito referente Ã  assinatura do mÃªs. Preciso que o financeiro analise e estorne a cobranÃ§a duplicada.',
          ricardo.nome,
          2,
        ),
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}003`,
      chamadoTitulo: '[TESTE] Workflow ativo â€” aguardando financeiro',
      cliente: [
        {
          clienteCpf: camila.cpf,
          clienteId: clientRefs.get(camila.cpf) ?? null,
        },
      ],
      tabulacao: [
        {
          tipoChamado: 'SolicitaÃ§Ã£o',
          produto: 'Produto X',
        motivo: 'Reembolso',
        detalhe: 'Dentro de 7 dias',
          responsavel: 'admin@velodesk.local',
          atribuido: '',
        },
      ],
      registro: [
        buildClienteMessage(
          'Bom dia! Solicito reembolso do Produto X. A compra foi realizada hÃ¡ 4 dias.',
          camila.nome,
          5,
        ),
        {
          data: hoursAgo(3),
          origin: 'agente',
          autor: 'Admin Velodesk',
          mensagemPublica: '',
          anexosMensagemPublica: [],
          anotacaoInterna: 'ClassificaÃ§Ã£o aplicada â€” workflow de reembolso iniciado.',
          anexosAnotacaoInterna: [],
          alteracoes: [
            {
              tipoChamado: 'SolicitaÃ§Ã£o',
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
      chamadoTitulo: '[TESTE] AprovaÃ§Ã£o reembolso â€” Maria Oliveira',
      cliente: [{ clienteCpf: maria.cpf, clienteId: clientRefs.get(maria.cpf) ?? null }],
      tabulacao: [{
        tipoChamado: 'SolicitaÃ§Ã£o',
        produto: 'Produto X',
        motivo: 'Reembolso',
        detalhe: 'Dentro de 7 dias',
        responsavel: 'Ana Silva',
        atribuido: '',
      }],
      registro: [
        buildClienteMessage(
          'Comprei o Produto X hÃ¡ 4 dias e quero solicitar o reembolso integral conforme a polÃ­tica de 7 dias.',
          maria.nome,
          6,
        ),
        buildWorkflowAgentRegistro({
          agentName: 'Ana Silva (Atendimento)',
          note: 'Atendimento confirmou elegibilidade e encaminhou para aprovaÃ§Ã£o.',
          stepActiveHoursAgo: 1.33,
          approval: buildApprovalMeta({ valor: 249.9, canal: 'WhatsApp' }),
        }),
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}008`,
      chamadoTitulo: '[TESTE] AprovaÃ§Ã£o reembolso â€” Roberto Alves',
      cliente: [{ clienteCpf: roberto.cpf, clienteId: clientRefs.get(roberto.cpf) ?? null }],
      tabulacao: [{
        tipoChamado: 'SolicitaÃ§Ã£o',
        produto: 'duplicidade',
        motivo: 'Estorno',
        detalhe: 'Em análise',
        responsavel: 'Ana Silva',
        atribuido: '',
      }],
      registro: [
        buildClienteMessage(
          'Preciso do reembolso do Produto X. Compra realizada por e-mail hÃ¡ 5 dias.',
          roberto.nome,
          8,
        ),
        buildWorkflowAgentRegistro({
          agentName: 'Ana Silva (Atendimento)',
          note: 'Cliente elegÃ­vel â€” encaminhado ao financeiro.',
          stepActiveHoursAgo: 2.75,
          approval: buildApprovalMeta({
            valor: 89.9,
            canal: 'E-mail',
            formaPagamento: 'CartÃ£o Â· final 4521',
          }),
        }),
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}009`,
      chamadoTitulo: '[TESTE] AprovaÃ§Ã£o reembolso â€” Fernanda Lima (SLA crÃ­tico)',
      cliente: [{ clienteCpf: fernanda.cpf, clienteId: clientRefs.get(fernanda.cpf) ?? null }],
      tabulacao: [{
        tipoChamado: 'SolicitaÃ§Ã£o',
        produto: 'Produto Y',
        motivo: 'Reembolso',
        detalhe: 'Dentro de 7 dias',
        responsavel: 'Ana Silva',
        atribuido: '',
      }],
      registro: [
        buildClienteMessage(
          'Liguei para solicitar reembolso do Produto X. A compra foi hÃ¡ 3 dias e preciso de urgÃªncia.',
          fernanda.nome,
          10,
        ),
        buildWorkflowAgentRegistro({
          agentName: 'Ana Silva (Atendimento)',
          note: 'Urgente â€” SLA financeiro prestes a vencer.',
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
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}004`,
      chamadoTitulo: '[TESTE] LentidÃ£o na internet fibra',
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
          'Minha internet fibra estÃ¡ muito lenta desde ontem Ã  noite. Velocidade caiu de 500 Mbps para menos de 50 Mbps.',
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
          'Quero cancelar meu pacote de TV. NÃ£o uso mais os canais premium e preciso encaminhar para o time responsÃ¡vel.',
          patricia.nome,
          3,
        ),
      ],
    },
    {
      chamadoProtocolo: `${WORKFLOW_TEST_PROTOCOL_PREFIX}006`,
      chamadoTitulo: '[TESTE] DÃºvida sobre valor da fatura',
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
          'Recebi a fatura deste mÃªs e o valor veio diferente do combinado. Podem me explicar os itens cobrados?',
          bruno.nome,
          4,
        ),
      ],
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const ticket of tickets) {
    const result = await createTestTicket(ticket);
    if (result.created) created += 1;
    else skipped += 1;
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
