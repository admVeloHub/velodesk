/** Teste local do webhook 55PBX (call center humano) — /api/inbound/telephony/inbound_b2c */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { ChamadoN1 } from '../src/models/ChamadoN1';
import { User } from '../src/models/User';
import { parseTelecom55B2cPayload } from '../src/services/telephony-inbound/adapters/telecom55B2c.adapter';
import {
  createTicketFromTelecom55B2cCall,
  resolveCategoriaFromUra,
  shouldCreateTicketFromTelecom55B2cEvent,
} from '../src/services/telecom55B2cTicket.service';

const DID_CENTRAL = '551130037293';
const DID_0800 = '08008000049';
const DID_CHAVES_PIX = '08002371339';

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    call_type: 'receptive',
    call_status: 'new_call',
    call_transfer_id: null,
    call_terminal: DID_CENTRAL,
    call_url_audio: null,
    call_ura: 'Opcao - 2',
    call_document: '12345678901',
    call_number: '11999999999',
    branch_email: 'branch-email-que-nao-existe@velotax.com.br',
    ...overrides,
  };
}

function checkFilter(label: string, overrides: Record<string, unknown>, expected: boolean) {
  const event = parseTelecom55B2cPayload(basePayload(overrides));
  const actual = shouldCreateTicketFromTelecom55B2cEvent(event);
  const ok = actual === expected;
  console.log(`${ok ? 'OK  ' : 'FAIL'} filtro "${label}": esperado=${expected} obtido=${actual}`);
  return ok;
}

async function main(): Promise<void> {
  await connectDatabase();

  console.log('--- Regras de filtro (funções puras, sem DB) ---');
  let allFiltersOk = true;
  allFiltersOk = checkFilter('happy path (deve passar)', {}, true) && allFiltersOk;
  allFiltersOk = checkFilter('call_type outbound', { call_type: 'outbound' }, false) && allFiltersOk;
  allFiltersOk = checkFilter('call_status != new_call', { call_status: 'call_attended' }, false) && allFiltersOk;
  allFiltersOk = checkFilter('com call_transfer_id', { call_transfer_id: 'abc123' }, false) && allFiltersOk;
  allFiltersOk = checkFilter('DID desconhecido', { call_terminal: '119999999' }, false) && allFiltersOk;
  allFiltersOk = checkFilter('já com call_url_audio', { call_url_audio: 'https://x/audio.mp3' }, false) && allFiltersOk;
  allFiltersOk = checkFilter('sem call_ura', { call_ura: '' }, false) && allFiltersOk;
  allFiltersOk = checkFilter('sem branch_email', { branch_email: '' }, false) && allFiltersOk;

  console.log('\n--- Categoria por DID/URA ---');
  const categoriaChecks: Array<[string, string, string]> = [
    [DID_CENTRAL, 'Opcao - 1', 'Crédito'],
    [DID_CENTRAL, 'Opcao - 2', 'Conta e PIX'],
    [DID_CENTRAL, 'Opcao - 3', 'Seguros'],
    [DID_CENTRAL, 'Opcao - 4', 'Clube'],
    [DID_CENTRAL, 'Opcao - a', 'Calculadora'],
    [DID_CENTRAL, 'valor-desconhecido', 'Crédito'],
    [DID_0800, 'Opcao - 3', 'Seguros'],
    [DID_CHAVES_PIX, 'Opcao - 1', 'Chaves PIX'],
    [DID_CHAVES_PIX, 'Opcao - 3', 'Chaves PIX'],
  ];
  let allCategoriasOk = true;
  for (const [did, ura, expected] of categoriaChecks) {
    const actual = resolveCategoriaFromUra(did, ura);
    const ok = actual === expected;
    allCategoriasOk = ok && allCategoriasOk;
    console.log(`${ok ? 'OK  ' : 'FAIL'} DID=${did} URA="${ura}" → esperado="${expected}" obtido="${actual}"`);
  }

  console.log('\n--- Criação de ticket (efeitos colaterais reais no Mongo) ---');
  const createdTicketIds: string[] = [];
  const anyUser = await User.findOne({ name: { $exists: true, $ne: '' } }).select('email name').lean();
  if (!anyUser?.email) {
    console.log('SKIP: nenhum User com nome preenchido encontrado no banco — não dá pra testar o caminho de sucesso.');
  } else {
    // CPF sintaticamente válido (dígitos verificadores corretos) mas que não deve existir
    // em cadastro nenhum, pra exercitar de verdade o caminho "não encontrado em lugar nenhum".
    const event = parseTelecom55B2cPayload(basePayload({
      branch_email: anyUser.email,
      call_document: '11144477735',
    }));
    const result = await createTicketFromTelecom55B2cCall(event);
    console.log('resultado (branch_email existente, CPF inexistente):', result);
    if (result) {
      createdTicketIds.push(result.ticketId);
      const chamado = await ChamadoN1.findById(result.ticketId).lean();
      console.log('canal:', chamado?.tabulacao?.[0]?.canal);
      console.log('produto:', chamado?.tabulacao?.[0]?.produto);
      console.log('motivo (deve ser ""):', JSON.stringify(chamado?.tabulacao?.[0]?.motivo));
      console.log('responsavel:', chamado?.tabulacao?.[0]?.responsavel);
      console.log('cliente (clienteId deve ser null — CPF não encontrado):', JSON.stringify(chamado?.cliente));
    }

    const eventNoAgent = parseTelecom55B2cPayload(basePayload({
      branch_email: 'ninguem-com-esse-email@velotax.com.br',
    }));
    const resultNoAgent = await createTicketFromTelecom55B2cCall(eventNoAgent);
    console.log('resultado (branch_email sem User correspondente, deve ser null):', resultNoAgent);
  }

  if (createdTicketIds.length) {
    await ChamadoN1.deleteMany({ _id: { $in: createdTicketIds } });
    console.log(`\nLimpeza: ${createdTicketIds.length} ticket(s) de teste removido(s).`);
  }

  console.log(`\nResumo: filtros ${allFiltersOk ? 'OK' : 'COM FALHAS'} | categorias ${allCategoriasOk ? 'OK' : 'COM FALHAS'}`);

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('Falha:', err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
