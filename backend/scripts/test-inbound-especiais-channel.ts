/** test-inbound-especiais-channel v1.0.0 — classifier + query filters */
process.env.INBOUND_EMAIL_PROCON_RECIPIENTS = 'procon@empresa.com.br';
process.env.INBOUND_EMAIL_PROCON_SENDER_PATTERNS = '@procon.sp.gov.br,@procon.';
process.env.INBOUND_EMAIL_CONSUMIDOR_GOV_RECIPIENTS = 'consumidor.gov@empresa.com.br';
process.env.INBOUND_EMAIL_CONSUMIDOR_GOV_SENDER_PATTERNS = '@consumidor.gov.br';

import { classifyInboundEspeciaisChannel } from '../src/services/inbound-email/inboundChannelClassifier.service';
import type { InboundEmailPayload } from '../src/services/inbound-email/types';
import {
  buildChamadoQueryFilter,
  excludeEspeciaisChannelsMongoFilter,
  proconChannelMongoFilter,
} from '../src/services/chamado.mapper';
import { shouldAutoAssign } from '../src/services/assignmentRouter.service';

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
  assert(typeof excludeEspeciaisChannelsMongoFilter().$nor !== 'undefined', 'exclude filter deve ter $nor');
}

async function main() {
  testClassifierMatch();
  testMeusChamadosExcludesEspeciais();
  testProconQueueFilter();
  testShouldAutoAssignSkipsEspeciais();
  testMongoHelpersShape();
  console.log('test-inbound-especiais-channel: OK (5 checks)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
