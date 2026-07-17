/**
 * Cria ticket de teste no backend local (Desk v2 + pop-over Produtos)
 * Uso: node scripts/create-desk-test-ticket.mjs
 */
const API = process.env.VELDESK_API || 'http://localhost:8001/api';
const DEV_EMAIL = process.env.VELDESK_DEV_EMAIL || 'lucasmgravina@gmail.com';

const TEST_CLIENT = {
  cpf: '90100000010',
  nome: 'Cliente Teste Popover',
  email: 'popover.teste@email-teste.com',
  telefone: '11987654321',
};

const TEST_TICKET = {
  chamadoProtocolo: 'POP-TEST-001',
  chamadoTitulo: '[TESTE] Encaminhar para Produtos — alteração cadastral',
  status: 'em-andamento',
  clientName: TEST_CLIENT.nome,
  clientCPF: TEST_CLIENT.cpf,
  text: 'Cliente solicita alteração de telefone cadastral no app. Ticket criado para testar o pop-over de Produtos.',
  lateralForm: {
    clienteCpf: TEST_CLIENT.cpf,
    clienteNome: TEST_CLIENT.nome,
    clienteEmail: [TEST_CLIENT.email],
    clienteTelefone: [TEST_CLIENT.telefone],
    classificacaoTipo: 'Solicitação',
    tipoChamado: 'Solicitação',
    produto: 'Internet Fibra',
    motivo: 'Lentidão',
    detalhe: 'Em análise',
    responsavel: DEV_EMAIL,
  },
};

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = typeof data === 'object' && data?.message ? data.message : text;
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return data;
}

async function ensureClient(token) {
  try {
    return await api(`/clients?cpf=${TEST_CLIENT.cpf}`, { token });
  } catch (err) {
    if (!String(err.message).includes('404')) throw err;
  }

  return api('/clients', {
    method: 'POST',
    token,
    body: {
      clienteDados: [{
        clienteCpf: TEST_CLIENT.cpf,
        clienteNome: TEST_CLIENT.nome,
        clienteEmail: { lista: [TEST_CLIENT.email] },
        clienteTelefone: { lista: [TEST_CLIENT.telefone] },
      }],
    },
  });
}

async function ensureTicket(token, clienteId) {
  try {
    return await api(`/tickets/by-protocol/${encodeURIComponent(TEST_TICKET.chamadoProtocolo)}`, { token });
  } catch (err) {
    if (!String(err.message).includes('404')) throw err;
  }

  return api('/tickets', {
    method: 'POST',
    token,
    body: {
      ...TEST_TICKET,
      clienteId: clienteId || undefined,
    },
  });
}

async function main() {
  console.log(`API: ${API}`);
  const login = await api('/auth/dev-login', {
    method: 'POST',
    body: { email: DEV_EMAIL },
  });
  const token = login.token;
  if (!token) throw new Error('Token não retornado no dev-login');

  const cliente = await ensureClient(token);
  const clienteId = cliente?._id || cliente?.id;
  const ticket = await ensureTicket(token, clienteId);

  console.log('');
  console.log('Ticket de teste pronto:');
  console.log(`  Protocolo: ${ticket.chamadoProtocolo || TEST_TICKET.chamadoProtocolo}`);
  console.log(`  ID: ${ticket.id || ticket._id}`);
  console.log(`  Cliente: ${TEST_CLIENT.nome} (CPF ${TEST_CLIENT.cpf})`);
  console.log(`  Tabulação: Solicitação · Internet Fibra · Lentidão · Em análise`);
  console.log('');
  console.log('Abra no Desk:');
  console.log('  http://localhost:8000/tickets?desk=v2');
  console.log('');
  console.log('Passos:');
  console.log('  1. Abra o ticket POP-TEST-001 na fila Em andamento');
  console.log('  2. Encaminhar para → Produtos');
  console.log('  3. Preencha e envie no pop-over');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
