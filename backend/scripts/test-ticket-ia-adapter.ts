/** Teste de regressão do adaptador e canonicalização da IA de tickets. */
import assert from 'node:assert/strict';
import type { IChamadoN1 } from '../src/models/ChamadoN1';
import {
  adaptChamadoToTicketIa,
  buildTicketIaText,
  buildTicketIaMessagesFromChamado,
} from '../src/services/ticketIaAdapter.service';
import {
  canonicalizeTicketIaReason,
  readExportedTicketIaKnowledge,
  resolveTicketIaAlias,
} from '../src/services/ticketIaSettings.service';

function chamado(overrides: Record<string, unknown>): IChamadoN1 {
  return {
    _id: { toString: () => 'ticket-1' },
    chamadoProtocolo: '123',
    chamadoTitulo: 'Ajuda com parcela',
    createdAt: new Date('2026-07-01T10:00:00Z'),
    registro: [],
    tabulacao: [],
    ...overrides,
  } as unknown as IChamadoN1;
}

const direct = adaptChamadoToTicketIa(chamado({
  registro: [
    {
      data: new Date('2026-07-01T10:00:00Z'),
      origin: 'agente',
      mensagemPublica: 'Resposta interna do agente',
      anotacaoInterna: '',
      status: 'novo',
    },
    {
      data: new Date('2026-07-01T11:00:00Z'),
      origin: 'cliente',
      mensagemPublica: 'Não reconheço esta cobrança.',
      anotacaoInterna: '',
      status: 'novo',
    },
  ],
}));
assert.equal(direct?.qualidadeFonte, 'direto_cliente');
assert.equal(direct?.descricaoCliente, 'Não reconheço esta cobrança.');
assert.ok(!buildTicketIaText(direct!).includes('Resposta interna'));

const email = adaptChamadoToTicketIa(chamado({
  registro: [{
    data: new Date(),
    origin: 'cliente',
    mensagemPublica: 'Quero antecipar.\n\nEm seg., 27 de jul. de 2026 às 18:07, suporte escreveu:\n> texto antigo',
    anotacaoInterna: '',
    metadados: { source: 'email-inbound' },
    status: 'novo',
  }],
}));
assert.equal(email?.descricaoCliente, 'Quero antecipar.');
assert.equal(email?.canal, 'email-inbound');

const transcribed = adaptChamadoToTicketIa(chamado({
  tabulacao: [{ detalhe: 'Cliente relata dificuldade no app.' }],
}));
assert.equal(transcribed?.qualidadeFonte, 'resumo_atendente');
assert.match(buildTicketIaText(transcribed!), /não é citação literal/);

const whatsapp = adaptChamadoToTicketIa(chamado({
  registro: [{
    data: new Date('2026-08-12T10:00:00Z'),
    origin: 'cliente',
    mensagemPublica: '',
    anotacaoInterna: '',
    status: 'novo',
    metadados: {
      source: 'whatsapp-thread',
      channel: 'whatsapp',
      whatsappMensagens: [
        {
          id: 'wa-1',
          data: '2026-08-12T10:00:00Z',
          origin: 'agente',
          texto: 'Olá João, aqui é o Velotax.',
        },
        {
          id: 'wa-2',
          data: '2026-08-12T10:05:00Z',
          origin: 'cliente',
          texto: 'Preciso de ajuda com meu boleto.',
        },
      ],
    },
  }],
}));
assert.equal(whatsapp?.qualidadeFonte, 'direto_cliente');
assert.equal(whatsapp?.descricaoCliente, 'Preciso de ajuda com meu boleto.');
assert.equal(whatsapp?.canal, 'whatsapp');

const waThread = buildTicketIaMessagesFromChamado(chamado({
  registro: [{
    data: new Date('2026-08-12T10:00:00Z'),
    origin: 'cliente',
    mensagemPublica: '',
    anotacaoInterna: '',
    status: 'novo',
    metadados: {
      source: 'whatsapp-thread',
      whatsappMensagens: [
        { id: 'wa-1', data: '2026-08-12T10:00:00Z', origin: 'agente', texto: 'Template inicial' },
        { id: 'wa-2', data: '2026-08-12T10:05:00Z', origin: 'cliente', texto: 'Meu IR atrasou' },
      ],
    },
  }],
}));
assert.equal(waThread.length, 2);
assert.equal(waThread[1].role, 'cliente');
assert.equal(waThread[1].channel, 'whatsapp');

const formal = adaptChamadoToTicketIa(chamado({
  registro: [{
    data: new Date(),
    origin: 'cliente',
    mensagemPublica: 'Reclamação formal',
    anotacaoInterna: '',
    metadados: { source: 'reclame-aqui' },
    status: 'novo',
  }],
}));
assert.equal(formal?.formalCaseSource, 'reclame-aqui');

assert.equal(
  resolveTicketIaAlias('2ª via boleto', [{ de: '2ª via boleto', para: 'Segunda via de boleto' }]),
  'Segunda via de boleto',
);
assert.equal(
  canonicalizeTicketIaReason('Segunda via de boletto', ['Segunda via de boleto']),
  'Segunda via de boleto',
);

const knowledge = readExportedTicketIaKnowledge();
assert.ok(knowledge, 'knowledge.json deve estar disponível');
assert.ok((knowledge?.taxonomiaMotivos?.length ?? 0) >= 27);

console.log('ticket-ia-adapter: ok');
