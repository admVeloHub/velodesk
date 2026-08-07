/**
 * Verificação do fluxo Nova demanda Procon por CPF.
 * Uso: node scripts/verify-procon-cpf-flow.mjs
 */

const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] ?? null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
};

function normalizeCpf(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidCpfDigits(cpf) {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += parseInt(digits[i], 10) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== parseInt(digits[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += parseInt(digits[i], 10) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === parseInt(digits[10], 10);
}

function mapClienteDocToContact(doc) {
  const dados = doc?.clienteDados?.[0];
  if (!dados) return null;
  const cpf = normalizeCpf(dados.clienteCpf);
  const emails = dados.clienteEmail?.lista || [];
  const phones = dados.clienteTelefone?.lista || [];
  const whatsappRaw = dados.clienteTelefone?.whatsapp || phones[0] || '';
  return {
    clientCPF: cpf,
    clientName: dados.clienteNome || '',
    email: emails[0] || '',
    whatsappPhone: whatsappRaw,
    phone: phones[0] || '',
    emails,
    phones,
  };
}

function buildDemandaFromCliente(doc) {
  const contact = mapClienteDocToContact(doc);
  if (!contact) return null;
  const consumidor = contact.clientName || 'Consumidor';
  const assunto = `Demanda Procon — ${consumidor}`;
  return {
    id: `pc-${Date.now()}`,
    consumidor,
    cpf: contact.clientCPF,
    email: contact.email,
    telefoneWhatsapp: contact.whatsappPhone || contact.phone,
    assunto,
    descricao: '',
    produto: 'Empréstimo',
    tipo: 'Reclamação',
    isDraft: false,
  };
}

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`  OK  ${label}`);
  } else {
    failed += 1;
    console.error(` FAIL ${label}`);
  }
}

console.log('1. Validação CPF');
assert('CPF inválido rejeitado', !isValidCpfDigits('111.111.111-11'));
assert('CPF válido aceito', isValidCpfDigits('529.982.247-25'));

console.log('\n2. buildDemandaFromCliente');
const doc = {
  clienteDados: [{
    clienteCpf: '52998224725',
    clienteNome: 'Maria Silva',
    clienteEmail: { lista: ['maria@email.com'] },
    clienteTelefone: { lista: ['11999998888'], whatsapp: '11999998888' },
  }],
};
const demanda = buildDemandaFromCliente(doc);
assert('Demanda criada', Boolean(demanda));
assert('Consumidor preenchido', demanda.consumidor === 'Maria Silva');
assert('Assunto default', demanda.assunto === 'Demanda Procon — Maria Silva');
assert('CPF normalizado', demanda.cpf === '52998224725');
assert('E-mail mapeado', demanda.email === 'maria@email.com');

console.log('\n3. Cliente inválido');
assert('Doc vazio retorna null', buildDemandaFromCliente({}) === null);

console.log(`\nResultado: ${passed} ok, ${failed} falhas`);
process.exit(failed > 0 ? 1 : 0);
