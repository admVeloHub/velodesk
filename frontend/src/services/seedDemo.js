/**
 * Seed demo tickets — fonte única de dados demo
 * VERSION: v2.1.0 | DATE: 2026-06-19
 */
import { getKanbanColumns, saveKanbanColumns } from './kanbanStorage';
import { getClientDB, resetClientDB, saveClientDB } from './clientDb';
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

const QUEUE_TEST_TICKETS = [
  {
    id: 'test-queue-novo',
    boxId: 'novos',
    status: 'novo',
    cpf: '10010010010',
    cpfFmt: '100.100.100-10',
    name: 'Cliente Teste Novo',
    email: 'teste.novo@velodesk.dev',
    telefone: '(11) 91001-0001',
    title: '[Teste] Instalação de fibra — Novo',
    description: 'Cliente solicita agendamento de instalação de internet fibra.',
    clientMessage: 'Olá, gostaria de agendar a instalação da internet fibra no meu endereço.',
    channel: 'WhatsApp',
    produto: 'Internet Fibra',
    classificacaoTipo: 'Solicitação',
    motivo: 'Instalação',
    priority: 'normal',
    termometro: 35,
    termometroLabel: 'Estável',
    ageMs: 45 * 60 * 1000,
  },
  {
    id: 'test-queue-andamento',
    boxId: 'em-andamento',
    status: 'em-aberto',
    cpf: '20020020020',
    cpfFmt: '200.200.200-20',
    name: 'Cliente Teste Andamento',
    email: 'teste.andamento@velodesk.dev',
    telefone: '(11) 91002-0002',
    title: '[Teste] Lentidão de internet — Em andamento',
    description: 'Cliente relata queda de velocidade durante o dia.',
    clientMessage: 'Minha internet está muito lenta desde ontem. Já reiniciei o roteador.',
    channel: 'Portal',
    produto: 'Internet Fibra',
    classificacaoTipo: 'Reclamação',
    motivo: 'Lentidão',
    priority: 'alta',
    termometro: 48,
    termometroLabel: 'Atenção',
    ageMs: 3 * 3600000,
  },
  {
    id: 'test-queue-pendente',
    boxId: 'em-espera',
    status: 'pendente',
    cpf: '30030030030',
    cpfFmt: '300.300.300-30',
    name: 'Cliente Teste Pendente',
    email: 'teste.pendente@velodesk.dev',
    telefone: '(11) 91003-0003',
    title: '[Teste] Aguardando retorno — Pendente',
    description: 'Cliente pediu retorno após envio de orientações técnicas.',
    clientMessage: 'Enviei as fotos do equipamento. Aguardo retorno da equipe técnica.',
    channel: 'E-mail',
    produto: 'TV',
    classificacaoTipo: 'Dúvida',
    motivo: 'Queda de sinal',
    priority: 'normal',
    termometro: 55,
    termometroLabel: 'Atenção',
    ageMs: 6 * 3600000,
  },
];

function buildQueueTestTicket(def) {
  const now = new Date();
  const createdAt = new Date(now.getTime() - (def.ageMs || 3600000)).toISOString();
  const agent = 'Ana Silva';
  return {
    id: def.id,
    title: def.title,
    description: def.description,
    status: def.status,
    priority: def.priority,
    channel: def.channel,
    source: def.channel,
    openedBy: 'client',
    createdAt,
    updatedAt: now.toISOString(),
    messages: [{
      id: `${def.id}-msg`,
      fromClient: true,
      type: 'client',
      text: def.clientMessage,
      timestamp: createdAt,
      author: def.name,
    }],
    internalNotes: [],
    solicitante: def.name,
    clientName: def.name,
    clientCPF: def.cpfFmt,
    clientEmail: def.email,
    clientPhone: def.telefone,
    responsibleAgent: agent,
    group: def.boxId === 'em-espera' ? 'Supervisor de fila' : 'Fila N1 — Triagem',
    isQueueTest: true,
    lateralForm: {
      cpf: def.cpf,
      canal: def.channel,
      classificacaoTipo: def.classificacaoTipo,
      produto: def.produto,
      motivo: def.motivo,
      detalhe: 'Ticket de teste',
      responsavel: agent,
      automacaoCategoria: '',
      automacaoAcao: '',
      _canalLocked: true,
    },
  };
}

export function ensureQueueTestTickets() {
  let columns = getKanbanColumns();
  if (!columns.length) columns = defaultBoxes();

  const db = getClientDB();
  let dbChanged = false;

  QUEUE_TEST_TICKETS.forEach((def) => {
    columns.forEach((box) => {
      if (box.tickets) box.tickets = box.tickets.filter((t) => t.id !== def.id);
    });

    const ticket = buildQueueTestTicket(def);
    const box = columns.find((b) => b.id === def.boxId);
    if (box) {
      if (!box.tickets) box.tickets = [];
      box.tickets.unshift(ticket);
    }

    if (!db[def.cpf]) {
      db[def.cpf] = {
        cpf: def.cpfFmt,
        name: def.name,
        email: def.email,
        telefone: def.telefone,
        situacao: 'Adimplente',
        produtos: [def.produto],
        risco: def.termometro >= 55 ? 'Alto' : def.termometro >= 45 ? 'Médio' : 'Baixo',
        termometro: def.termometro,
        termometroLabel: def.termometroLabel,
      };
      dbChanged = true;
    }
  });

  if (dbChanged) saveClientDB(db);
  saveKanbanColumns(columns);
  migrateAllTicketsForDeskV2();
  return QUEUE_TEST_TICKETS.length;
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

export function countKanbanTickets(columns) {
  return (columns || []).reduce((total, box) => total + (box.tickets?.length || 0), 0);
}

export function ensureLocalTestTicket() {
  if (!import.meta.env.DEV) return null;

  let columns = getKanbanColumns();
  if (!columns.length) columns = defaultBoxes();

  const testId = 'local-test-ticket';
  const exists = columns.some((box) =>
    (box.tickets || []).some((ticket) => ticket.id === testId || ticket.isLocalTest)
  );
  if (exists) return testId;

  const now = new Date().toISOString();
  const ticket = {
    id: testId,
    title: 'Ticket Teste Local — Verificação do Cockpit',
    description: 'Ticket criado automaticamente para testes em localhost.',
    status: 'em-aberto',
    priority: 'normal',
    channel: 'Portal',
    source: 'Portal',
    openedBy: 'client',
    clientName: 'Cliente Teste Local',
    solicitante: 'Cliente Teste Local',
    clientCPF: '999.888.777-66',
    clientEmail: 'teste.local@velodesk.dev',
    clientPhone: '(11) 90000-0000',
    responsibleAgent: 'Admin Velodesk',
    group: 'Fila N1 — Triagem',
    createdAt: now,
    updatedAt: now,
    isLocalTest: true,
    messages: [{
      id: 'local-test-msg-1',
      fromClient: true,
      type: 'client',
      text: 'Olá, preciso de ajuda com meu plano de internet. Este é um ticket de teste local.',
      timestamp: now,
      author: 'Cliente Teste Local',
    }],
    internalNotes: [],
    lateralForm: {
      cpf: '99988877766',
      canal: 'Portal',
      classificacaoTipo: 'Solicitação',
      produto: 'Internet Fibra',
      motivo: 'Sem conexão',
      detalhe: 'Teste local',
      responsavel: 'Admin Velodesk',
    },
  };

  const db = getClientDB();
  if (!db['99988877766']) {
    db['99988877766'] = {
      cpf: '999.888.777-66',
      name: 'Cliente Teste Local',
      email: 'teste.local@velodesk.dev',
      telefone: '(11) 90000-0000',
      situacao: 'Adimplente',
      produtos: ['Internet Fibra'],
      risco: 'Baixo',
      termometro: 30,
      termometroLabel: 'Estável',
    };
    saveClientDB(db);
  }

  const box = columns.find((item) => item.id === 'em-andamento') || columns[0];
  if (!box.tickets) box.tickets = [];
  box.tickets.unshift(ticket);
  saveKanbanColumns(columns);
  migrateAllTicketsForDeskV2();
  return testId;
}

export function bootstrapCockpitData() {
  seedEcosystemData();

  let columns = getKanbanColumns();
  if (!columns.length || countKanbanTickets(columns) === 0) {
    localStorage.removeItem('velodeskDeskV2Seeded');
    localStorage.removeItem('velodeskDemoTickets3');
    columns = getKanbanColumns();
  }

  ensureDeskV2PrototypeTickets();
  ensureQueueTestTickets();
  ensureLocalTestTicket();
}
