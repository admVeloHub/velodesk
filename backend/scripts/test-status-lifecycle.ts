/**
 * test-status-lifecycle v1.0.0 — ciclo pendente/resolvido/fechado + inbound + job 48h
 * Rode: npx tsx scripts/test-status-lifecycle.ts
 */
import type { IChamadoN1 } from '../src/models/ChamadoN1';
import {
  appendMessage,
  appendStatusTransition,
  assertChamadoModifiable,
  ChamadoClosedError,
  currentStatus,
  getResolvedAt,
  isChamadoFechado,
  isResolvedWithinReopenWindow,
  lastStatusFilter,
  resolveInboundClientReplyStatus,
  shouldSpawnNewTicketOnInbound,
  statusFromBoxName,
  boxNameFromStatus,
  RESOLVED_REOPEN_WINDOW_MS,
} from '../src/services/chamado.mapper';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function mockChamado(status: string, statusAt = new Date()): IChamadoN1 {
  return {
    registro: [
      {
        data: statusAt,
        origin: 'agente',
        autor: 'teste',
        mensagemPublica: 'msg',
        anexosMensagemPublica: [],
        anotacaoInterna: '',
        anexosAnotacaoInterna: [],
        alteracoes: [{ status }],
        metadados: {},
        status,
      },
    ],
    tabulacao: [],
    cliente: [],
  } as unknown as IChamadoN1;
}

function testHelpersBasics() {
  const fechado = mockChamado('fechado');
  assert(isChamadoFechado(fechado) === true, 'isChamadoFechado deve detectar fechado');
  assert(currentStatus(fechado) === 'fechado', 'currentStatus fechado');

  let threw = false;
  try {
    assertChamadoModifiable(fechado);
  } catch (err) {
    threw = true;
    assert(err instanceof ChamadoClosedError, 'deve lançar ChamadoClosedError');
    assert((err as ChamadoClosedError).status === 409, 'status HTTP 409');
  }
  assert(threw, 'assertChamadoModifiable em fechado deve falhar');

  const aberto = mockChamado('em-andamento');
  assertChamadoModifiable(aberto);
  assert(isChamadoFechado(aberto) === false, 'aberto não é fechado');
}

function testResolvedWindow() {
  const now = Date.now();
  const recent = mockChamado('resolvido', new Date(now - 2 * 60 * 60 * 1000));
  assert(isResolvedWithinReopenWindow(recent, RESOLVED_REOPEN_WINDOW_MS, now) === true, 'resolvido <48h reabre');
  assert(shouldSpawnNewTicketOnInbound(recent, RESOLVED_REOPEN_WINDOW_MS, now) === false, 'não spawn <48h');

  const old = mockChamado('resolvido', new Date(now - 50 * 60 * 60 * 1000));
  assert(isResolvedWithinReopenWindow(old, RESOLVED_REOPEN_WINDOW_MS, now) === false, 'resolvido ≥48h não reabre');
  assert(shouldSpawnNewTicketOnInbound(old, RESOLVED_REOPEN_WINDOW_MS, now) === true, 'spawn ≥48h');

  const closed = mockChamado('fechado');
  assert(shouldSpawnNewTicketOnInbound(closed) === true, 'fechado spawn novo');

  const cancelado = mockChamado('cancelado');
  assert(shouldSpawnNewTicketOnInbound(cancelado) === true, 'cancelado spawn novo');

  const pendente = mockChamado('pendente');
  assert(shouldSpawnNewTicketOnInbound(pendente) === false, 'pendente anexa no mesmo');
}

function testInboundStatusOverride() {
  const pendente = mockChamado('pendente');
  appendMessage(pendente, 'resposta cliente', false, 'them', [], { source: 'test' }, 'em-aberto');
  assert(currentStatus(pendente) === 'em-aberto', 'pendente + inbound → em-aberto');

  const emAndamento = mockChamado('em-andamento');
  appendMessage(emAndamento, 'resposta cliente', false, 'them', [], { source: 'test' }, 'em-aberto');
  assert(currentStatus(emAndamento) === 'em-aberto', 'em-andamento + inbound → em-aberto');

  const now = Date.now();
  const resolvido = mockChamado('resolvido', new Date(now - 60 * 60 * 1000));
  appendMessage(resolvido, 'cliente voltou', false, 'them', [], { source: 'test' }, 'em-aberto');
  assert(currentStatus(resolvido) === 'em-aberto', 'resolvido <48h + inbound → em-aberto');
  assert(getResolvedAt(resolvido) != null, 'getResolvedAt preserva histórico resolvido');
}

function testInboundResolvido48hIntegration() {
  const now = Date.now();

  const recent = mockChamado('resolvido', new Date(now - 60 * 60 * 1000));
  assert(shouldSpawnNewTicketOnInbound(recent, RESOLVED_REOPEN_WINDOW_MS, now) === false, 'resolvido <48h anexa no mesmo');
  assert(resolveInboundClientReplyStatus(recent) === 'em-aberto', 'resolvido <48h → em-aberto (Cliente respondeu)');

  const old = mockChamado('resolvido', new Date(now - 50 * 60 * 60 * 1000));
  assert(shouldSpawnNewTicketOnInbound(old, RESOLVED_REOPEN_WINDOW_MS, now) === true, 'resolvido ≥48h gera ticket novo');
}

function testJobCloseTransition() {
  const now = new Date();
  const oldResolved = mockChamado(
    'resolvido',
    new Date(now.getTime() - 50 * 60 * 60 * 1000),
  );
  appendStatusTransition(oldResolved, 'fechado', {
    autor: 'sistema',
    metadados: { source: 'close-resolved-job' },
  });
  assert(currentStatus(oldResolved) === 'fechado', 'job: resolvido ≥48h → fechado');
  assert(isChamadoFechado(oldResolved) === true, 'após job está fechado');

  let threw = false;
  try {
    assertChamadoModifiable(oldResolved);
  } catch {
    threw = true;
  }
  assert(threw, 'PUT/commit em fechado → 409 (assert)');
}

function testBoxResolvidosIncludesFechado() {
  assert(boxNameFromStatus('fechado') === 'Resolvido', 'fechado fica na box Resolvido');
  assert(statusFromBoxName('Resolvido') === 'resolvido', 'box Resolvido resolve para status resolvido');
  const filter = lastStatusFilter('resolvido') as { $expr: { $in: [unknown, string[]] } };
  const variants = filter.$expr.$in[1];
  assert(variants.includes('resolvido'), 'filtro inclui resolvido');
  assert(variants.includes('fechado'), 'filtro inclui fechado na fila Resolvidos');
  assert(variants.includes('cancelado'), 'filtro inclui cancelado na fila Resolvidos');
}

function main() {
  testHelpersBasics();
  testResolvedWindow();
  testInboundStatusOverride();
  testInboundResolvido48hIntegration();
  testJobCloseTransition();
  testBoxResolvidosIncludesFechado();
  console.log('OK test-status-lifecycle — todos os cenários passaram');
}

main();
