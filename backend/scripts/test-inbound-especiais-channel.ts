/** test-inbound-especiais-channel v1.2.0 — classifier + query filters + CGOV/Bacen priority */
process.env.INBOUND_EMAIL_PROCON_RECIPIENTS = 'procon@empresa.com.br';
process.env.INBOUND_EMAIL_PROCON_SENDER_PATTERNS = '@procon.sp.gov.br,@procon.';
process.env.INBOUND_EMAIL_CONSUMIDOR_GOV_RECIPIENTS = 'consumidor.gov@empresa.com.br';
process.env.INBOUND_EMAIL_CONSUMIDOR_GOV_SENDER_PATTERNS = '@consumidor.gov.br';
process.env.INBOUND_EMAIL_BACEN_RECIPIENTS = 'bacen-rdr@empresa.com.br';
process.env.INBOUND_EMAIL_BACEN_SENDER_PATTERNS = '@velotax.com.br';

import { classifyInboundEspeciaisChannel } from '../src/services/inbound-email/inboundChannelClassifier.service';
import type { InboundEmailPayload } from '../src/services/inbound-email/types';
import {
  parseConsumidorGovInboundEmail,
} from '../src/services/inbound-email/parseConsumidorGovEmail.service';
import {
  parseBacenRdrInboundEmail,
} from '../src/services/inbound-email/parseBacenRdrEmail.service';
import {
  buildChamadoQueryFilter,
  bacenChannelMongoFilter,
  excludeEspeciaisChannelsMongoFilter,
  proconChannelMongoFilter,
} from '../src/services/chamado.mapper';
import { shouldAutoAssign } from '../src/services/assignmentRouter.service';
import {
  buildBacenStructuredTicketBody,
  buildCgovStructuredTicketBody,
} from '../src/services/email-inbound.service';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function buildPayload(fromEmail: string, to: string[]): InboundEmailPayload {
  return {
    messageId: '<test@example.com>',
    subject: 'Demanda teste',
    from: { email: fromEmail, name: 'Remetente' },
    to,
    textBody: 'Corpo',
    htmlBody: '',
    attachments: [],
    receivedAt: new Date(),
  };
}

function testClassifierMatch() {
  assert(
    classifyInboundEspeciaisChannel(buildPayload('ouvidoria@procon.sp.gov.br', ['procon@empresa.com.br'])) === 'procon',
    'deve classificar Procon com destino + remetente',
  );
  assert(
    classifyInboundEspeciaisChannel(buildPayload('cliente@gmail.com', ['procon@empresa.com.br'])) === null,
    'destino Procon sem remetente válido não deve classificar',
  );
  assert(
    classifyInboundEspeciaisChannel(buildPayload('usuario@consumidor.gov.br', ['consumidor.gov@empresa.com.br'])) === 'consumidor-gov',
    'deve classificar Consumidor.Gov',
  );
}

function testCgovPriorityClassifier() {
  const payload: InboundEmailPayload = {
    ...buildPayload('encaminhador@empresa.com.br', ['consumidor.gov@empresa.com.br']),
    subject: 'PRIORIZAR - CGOV',
  };
  assert(
    classifyInboundEspeciaisChannel(payload) === 'consumidor-gov',
    'PRIORIZAR-CGOV no destino CG deve classificar sem remetente institucional',
  );
}

function testCgovStructuredTicketBodyUsesReclamante() {
  const sampleBody = `Dados do Reclamante
Nome\tAna Paula Ribeiro
CPF\t123.456.789-00
E-mail\tana@example.com
Telefone\t11999998888
Localidade\tSão Paulo - SP

Dados da Reclamação
Protocolo: 20260700015790834
Assunto\tCobrança após cancelamento
Problema\tCobrança indevida
Abertura\t12/08/2026
Prazo\t20/08/2026

Descrição da Reclamação
Descrição
Cobrança após cancelamento do serviço.`;

  const parsed = parseConsumidorGovInboundEmail(sampleBody);
  assert(parsed.isValid(), 'parse auxiliar deve ser válido');

  const payload: InboundEmailPayload = {
    messageId: '<cgov-builder@example.com>',
    subject: 'PRIORIZAR - CGOV',
    from: { email: 'forward@empresa.com.br', name: 'Encaminhador Interno' },
    to: ['consumidor.gov@empresa.com.br'],
    textBody: sampleBody,
    htmlBody: '',
    attachments: [],
    receivedAt: new Date(),
  };

  const body = buildCgovStructuredTicketBody(parsed, payload, [], true);
  assert(body.clientName === 'Ana Paula Ribeiro', 'clientName deve ser o reclamante');
  assert(body.clientCPF === '12345678900', 'clientCPF deve vir do parse');
  assert((body.lateralForm as { consumidorGov?: { consumidor?: string } }).consumidorGov?.consumidor === 'Ana Paula Ribeiro', 'consumidorGov.consumidor deve ser reclamante');
  assert(body.text === 'Cobrança após cancelamento do serviço.', 'text deve ser só a descrição');
  assert(body.priority === 'alta', 'prioridade alta quando isPriority=true');
}

function testBacenPriorityClassifier() {
  const payload: InboundEmailPayload = {
    ...buildPayload('encaminhador@empresa.com.br', ['bacen-rdr@empresa.com.br']),
    subject: 'PRIORIZAR -  BACEN/ RDR',
  };
  assert(
    classifyInboundEspeciaisChannel(payload) === 'bacen',
    'PRIORIZAR-BACEN/RDR no destino Bacen deve classificar sem remetente institucional',
  );
}

function testBacenStructuredTicketBodyUsesDemandante() {
  const sampleBody = `Dados do Demandante
Nome\tCAMILA ANGELO NOGUEIRA LOPES
Documento\t01265323208
Endereço\tPedro Alvares Cabral, 464, RIO BRANCO , AC
Telefone(s)\t(68) 99211-0513
E-mail\tcamila@example.com
Id Bacen\t20261074668
Dados da Reclamação
Id(20261074668)
Descrição
EXTERNA - SISCAP em 23/07/2026 11:44

Tipo: Reclamação
Mensagem: Cobrança após cancelamento do serviço.

Por gentileza verificar a possibilidade de atender a demandante abaixo:

Nome: CAMILA ANGELO NOGUEIRA LOPES
CPF: 01265323208
Contrato: 5248479`;

  const parsed = parseBacenRdrInboundEmail(sampleBody);
  assert(parsed.isValid(), 'parse auxiliar bacen deve ser válido');

  const payload: InboundEmailPayload = {
    messageId: '<bacen-builder@example.com>',
    subject: 'PRIORIZAR -  BACEN/ RDR',
    from: { email: 'forward@empresa.com.br', name: 'Encaminhador Interno' },
    to: ['bacen-rdr@empresa.com.br'],
    textBody: sampleBody,
    htmlBody: '',
    attachments: [],
    receivedAt: new Date(),
  };

  const body = buildBacenStructuredTicketBody(parsed, payload, [], true);
  assert(body.clientName === 'CAMILA ANGELO NOGUEIRA LOPES', 'clientName deve ser demandante');
  assert(body.clientCPF === '01265323208', 'clientCPF deve vir do parse');
  const bacen = (body.lateralForm as { bacen?: Record<string, unknown> }).bacen;
  assert(bacen?.consumidor === 'CAMILA ANGELO NOGUEIRA LOPES', 'bacen.consumidor deve ser demandante');
  assert(bacen?.orgaoBacen === 'Bacen — RDR', 'orgao bacen RDR');
  assert(bacen?.statusBc === 'nao-respondida', 'status bacen');
  assert(String(body.text).includes('Cobrança após cancelamento'), 'text deve ser descrição completa');
  assert(body.priority === 'alta', 'prioridade alta quando isPriority=true');
}

function testMeusChamadosExcludesEspeciais() {
  const filter = buildChamadoQueryFilter('novo', 'meus-chamados', ['agente@test.com']);
  const json = JSON.stringify(filter);
  assert(json.includes('$nor'), 'meus-chamados deve excluir canais Especiais via $nor');
}

function testProconQueueFilter() {
  const filter = buildChamadoQueryFilter('novo', 'procon');
  const json = JSON.stringify(filter);
  assert(json.includes('procon'), 'fila procon deve filtrar canal Procon');
}

function testShouldAutoAssignSkipsEspeciais() {
  const partial = {
    registro: [{
      origin: 'cliente',
      metadados: { source: 'procon', procon: { assunto: 'Teste' } },
      mensagemPublica: 'x',
      anexosMensagemPublica: [],
      anotacaoInterna: '',
      anexosAnotacaoInterna: [],
      alteracoes: [],
      status: 'novo',
    }],
    tabulacao: [{ responsavel: '' }],
  };
  assert(shouldAutoAssign(partial as never) === false, 'Procon não deve entrar na roleta');
}

function testMongoHelpersShape() {
  assert(typeof proconChannelMongoFilter().$or !== 'undefined', 'proconChannelMongoFilter deve ter $or');
  assert(typeof bacenChannelMongoFilter().$or !== 'undefined', 'bacenChannelMongoFilter deve ter $or');
  assert(typeof excludeEspeciaisChannelsMongoFilter().$nor !== 'undefined', 'exclude filter deve ter $nor');
}

function testEmailInboundNoDirectWorkflow() {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const inboundPath = path.join(__dirname, '../src/services/email-inbound.service.ts');
  const src = fs.readFileSync(inboundPath, 'utf8');
  assert(!src.includes('activateEspeciaisWorkflow'), 'sem workflow direto no inbound');
  assert(src.includes('runInboundPostCreateHooks(chamado'), 'hooks sempre após create');
  assert(src.includes('canalProvavel'), 'classificador vira hint canalProvavel no create');
  assert(src.includes('buildCgovStructuredTicketBody'), 'builder CGOV estruturado presente');
  assert(src.includes('buildBacenStructuredTicketBody'), 'builder Bacen estruturado presente');
  assert(src.includes('cgovStructuredInbound'), 'flag cgovStructuredInbound presente');
  assert(src.includes('bacenStructuredInbound'), 'flag bacenStructuredInbound presente');
  assert(src.includes('findChamadoByBacenIdDemanda'), 'dedupe bacen por idDemanda');
  assert(src.includes('ensureStructuredBacenReclamacao'), 'upsert reclamacao bacen determinístico');
}

async function main() {
  testClassifierMatch();
  testCgovPriorityClassifier();
  testBacenPriorityClassifier();
  testCgovStructuredTicketBodyUsesReclamante();
  testBacenStructuredTicketBodyUsesDemandante();
  testMeusChamadosExcludesEspeciais();
  testProconQueueFilter();
  testShouldAutoAssignSkipsEspeciais();
  testMongoHelpersShape();
  testEmailInboundNoDirectWorkflow();
  console.log('test-inbound-especiais-channel: OK (11 checks)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
