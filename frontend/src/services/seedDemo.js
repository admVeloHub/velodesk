/**
 * Seed demo tickets — fonte única de dados demo
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import { getKanbanColumns, saveKanbanColumns } from './kanbanStorage';
import { resetClientDB } from './clientDb';
import { migrateAllTicketsForDeskV2 } from './desk/utils';

const DEMO_CLIENTS = [
  {
    cpf: '12345678901', cpfFmt: '123.456.789-01', name: 'Maria Oliveira',
    email: 'maria.oliveira@email.com', telefone: '(11) 98765-4321',
    title: 'Internet lenta após 22h — Maria Oliveira',
    description: 'Cliente relata queda de velocidade no período noturno.',
    clientMessage: 'Boa noite! Minha internet fica muito lenta depois das 22h.',
    status: 'novo', boxId: 'novos', source: 'WhatsApp', channel: 'WhatsApp',
    produto: 'Internet Fibra', classificacaoTipo: 'Reclamação', motivo: 'Lentidão',
    detalhe: 'Em análise', priority: 'alta'
  },
  {
    cpf: '98765432100', cpfFmt: '987.654.321-00', name: 'João Pereira',
    email: 'joao.pereira@email.com', telefone: '(11) 91234-5678',
    title: 'Bloqueio por inadimplência — João Pereira',
    description: 'Cliente contesta bloqueio do combo móvel.',
    clientMessage: 'Meu combo móvel foi bloqueado e eu já tinha feito acordo.',
    status: 'em-aberto', boxId: 'em-andamento', source: 'Portal', channel: 'Portal',
    produto: 'Combo', classificacaoTipo: 'Solicitação', motivo: 'Cobrança',
    detalhe: 'Contestação', priority: 'critica'
  },
  {
    cpf: '11122233344', cpfFmt: '111.222.333-44', name: 'Empresa Tech Ltda',
    email: 'contato@empresatech.com.br', telefone: '(11) 3456-7890',
    title: 'Upgrade link dedicado — Empresa Tech Ltda',
    description: 'CNPJ solicita upgrade de link corporativo.',
    clientMessage: 'Precisamos de upgrade do link dedicado corporativo.',
    status: 'pendente', boxId: 'pendentes', source: 'E-mail', channel: 'E-mail',
    produto: 'Internet Fibra', classificacaoTipo: 'Informação', motivo: 'Instalação',
    detalhe: 'Agendamento pendente', priority: 'normal'
  }
];

function defaultBoxes() {
  return [
    { id: 'novos', name: 'Novos', tickets: [] },
    { id: 'em-andamento', name: 'Em Andamento', tickets: [] },
    { id: 'em-espera', name: 'Pendente', tickets: [] },
    { id: 'pendentes', name: 'Aguardando retorno', tickets: [] },
    { id: 'resolvidos', name: 'Resolvidos', tickets: [] }
  ];
}

function buildTicket(client, index, baseId) {
  const now = new Date();
  const createdAt = new Date(now.getTime() - (index + 1) * 86400000).toISOString();
  const agent = 'Ana Silva';
  return {
    id: baseId + index,
    title: client.title,
    description: client.description,
    status: client.status,
    priority: client.priority,
    channel: client.channel,
    source: client.source,
    openedBy: 'client',
    createdAt,
    updatedAt: now.toISOString(),
    messages: [{
      id: 'client-msg-' + index,
      fromClient: true,
      type: 'client',
      text: client.clientMessage || client.description,
      timestamp: createdAt,
      author: client.name
    }],
    internalNotes: [],
    solicitante: client.name,
    clientName: client.name,
    clientCPF: client.cpfFmt,
    clientEmail: client.email || '',
    clientPhone: client.telefone || '',
    responsibleAgent: agent,
    group: client.boxId === 'pendentes' ? 'Supervisor de fila' : 'Fila N1 — Triagem',
    isDemo: true,
    lateralForm: {
      cpf: client.cpf,
      canal: client.channel,
      classificacaoTipo: client.classificacaoTipo,
      produto: client.produto,
      motivo: client.motivo,
      detalhe: client.detalhe,
      responsavel: agent,
      automacaoCategoria: '',
      automacaoAcao: '',
      _canalLocked: true
    }
  };
}

export function seedDemoTickets(opts = {}) {
  const force = opts.force !== false;
  const replaceAll = opts.replaceAll !== false;
  if (!force && localStorage.getItem('velodeskDemoTickets3')) return 3;

  resetClientDB();
  let columns = getKanbanColumns();
  if (!columns.length) columns = defaultBoxes();

  if (replaceAll) {
    columns.forEach((box) => { box.tickets = []; });
  } else {
    columns.forEach((box) => {
      if (box.tickets) box.tickets = box.tickets.filter((t) => !t.isDemo);
    });
  }

  const baseId = Date.now();
  DEMO_CLIENTS.forEach((client, i) => {
    const ticket = buildTicket(client, i, baseId);
    const box = columns.find((b) => b.id === client.boxId);
    if (box) {
      if (!box.tickets) box.tickets = [];
      box.tickets.push(ticket);
    }
  });

  saveKanbanColumns(columns);
  localStorage.setItem('velodeskDemoTickets3', 'true');
  return 3;
}

export function ensureDeskV2PrototypeTickets() {
  if (localStorage.getItem('velodeskDeskV2Seeded') === '1') return;
  seedDemoTickets({ force: false, replaceAll: false });

  let columns = getKanbanColumns();
  if (!columns.length) columns = defaultBoxes();

  const findBox = (id) => columns.find((b) => b.id === id);

  columns.forEach((box) => {
    (box.tickets || []).forEach((t) => {
      if ((t.clientName || '').indexOf('Maria Oliveira') >= 0) {
        t.status = 'em-aberto';
        const target = findBox('em-andamento');
        if (target && box.id !== 'em-andamento') {
          box.tickets = box.tickets.filter((x) => x !== t);
          if (!target.tickets) target.tickets = [];
          target.tickets.push(t);
        }
      }
    });
  });

  const now = Date.now();
  const extras = [
    {
      id: now + 901,
      title: 'Cancelamento de plano TV',
      clientName: 'Carlos Mendes',
      solicitante: 'Carlos Mendes',
      clientCPF: '555.666.777-88',
      status: 'pendente',
      channel: 'Telefone',
      createdAt: new Date(now - 86400000).toISOString(),
      messages: [{ fromClient: true, type: 'client', text: 'Quero cancelar meu plano de TV.', timestamp: new Date(now - 86400000).toISOString(), author: 'Carlos Mendes' }],
      lateralForm: { canal: 'Telefone', classificacaoTipo: 'Solicitação', produto: 'TV', motivo: 'Cancelamento', cpf: '55566677788' }
    },
    {
      id: now + 902,
      title: 'Segunda via de fatura',
      clientName: 'João Ferreira',
      status: 'novo',
      channel: 'E-mail',
      createdAt: new Date(now - 3600000).toISOString(),
      messages: [{ fromClient: true, type: 'client', text: 'Preciso da segunda via da minha fatura.', timestamp: new Date(now - 3600000).toISOString(), author: 'João Ferreira' }],
      lateralForm: { canal: 'E-mail', classificacaoTipo: 'Solicitação', produto: 'Internet Fibra', motivo: 'Sem conexão', cpf: '45678912345' }
    }
  ];

  extras.forEach((t) => {
    const exists = columns.some((b) => (b.tickets || []).some((x) => x.clientName === t.clientName));
    if (exists) return;
    const boxId = t.clientName.indexOf('Carlos') >= 0 ? 'pendentes' : 'novos';
    const box = findBox(boxId);
    if (box) {
      if (!box.tickets) box.tickets = [];
      box.tickets.push(t);
    }
  });

  saveKanbanColumns(columns);
  localStorage.setItem('velodeskDeskV2Seeded', '1');
  migrateAllTicketsForDeskV2();
}

export function seedEcosystemData() {
  if (localStorage.getItem('velodeskEcosystemSeeded')) return;
  localStorage.setItem('velodeskClient360', JSON.stringify({
    'cliente-demo': {
      name: 'Maria Oliveira', cpf: '***.456.789-**', preferredChannel: 'WhatsApp',
      products: ['Internet Fibra 500MB'], nps: 8, riskScore: 35
    }
  }));
  localStorage.setItem('velodeskEcosystemSeeded', 'true');
}

export function bootstrapCockpitData() {
  seedEcosystemData();
  ensureDeskV2PrototypeTickets();
}
