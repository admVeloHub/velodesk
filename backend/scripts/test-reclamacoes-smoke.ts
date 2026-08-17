/** test-reclamacoes-smoke v1.0.0 — orgao routes, models, upsert guard */
import {
  parseReclamacaoOrgaoRoute,
  orgaoToRoute,
  reclamacaoToPortalDto,
} from '../src/services/reclamacoes/reclamacao.service';
import type { IReclamacao } from '../src/models/reclamacoes/reclamacaoModels';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testOrgaoRoutes() {
  assert(parseReclamacaoOrgaoRoute('procon') === 'procon', 'procon route');
  assert(parseReclamacaoOrgaoRoute('consumidor-gov') === 'consumidor_gov', 'consumidor-gov route');
  assert(parseReclamacaoOrgaoRoute('reclame-aqui') === 'reclame_aqui', 'reclame-aqui route');
  assert(parseReclamacaoOrgaoRoute('bacen') === 'bacen', 'bacen route');
  assert(orgaoToRoute('procon') === 'procon', 'orgao to route procon');
}

function testPortalDto() {
  const dto = reclamacaoToPortalDto({
    _id: 'abc',
    orgao: 'procon',
    chamadoId: '507f1f77bcf86cd799439011',
    chamadoProtocolo: '12345678',
    consumidor: 'Teste',
    assunto: 'Assunto',
    descricao: 'Desc',
    statusCanal: 'nao-respondida',
    workflowAtivo: false,
    aberta: true,
    meta: { statusPc: 'nao-respondida' },
    inboxDedicada: true,
  } as unknown as IReclamacao);
  assert(dto.id === 'abc', 'dto id');
  assert(dto.statusPc === 'nao-respondida', 'dto statusPc');
  assert(dto.ticketId === '507f1f77bcf86cd799439011', 'dto chamadoId map');
}

function testInboundAgent4Gatekeeper() {
  const inboundPath = path.join(__dirname, '../src/services/email-inbound.service.ts');
  const src = fs.readFileSync(inboundPath, 'utf8');
  assert(!src.includes('if (!especiaisChannel)'), 'inbound não deve pular hooks por canal');
  assert(!src.includes('activateEspeciaisWorkflow('), 'inbound não deve ativar workflow direto');
  assert(src.includes('canalProvavel'), 'inbound deve gravar hint canalProvavel');
  assert(src.includes('runInboundPostCreateHooks(chamado'), 'inbound deve chamar hooks sempre');
}

function testRoutingPersistHook() {
  const routingPath = path.join(__dirname, '../src/services/agents/casosEspeciaisRouting.service.ts');
  const src = fs.readFileSync(routingPath, 'utf8');
  assert(src.includes('upsertFromChamado'), 'routing deve persistir reclamação');
  assert(!src.includes("'consumidor-gov-tratativa'"), 'sem workflow dedicado por órgão');
  assert(src.includes('tryActivateWorkflowOnTabulation'), 'ticket segue elegível a workflow real via tabulação');
  assert(src.includes('createCasoEspecialNotificacao'), 'notificação via sininho, não CTA de workflow');
}

function testTriggerReclamacaoGuard() {
  const triggerPath = path.join(__dirname, '../src/services/agents/casosEspeciaisTrigger.service.ts');
  const src = fs.readFileSync(triggerPath, 'utf8');
  assert(src.includes('findReclamacaoByChamadoIdAnyOrgao'), 'trigger deve checar reclamação existente');
  assert(src.includes('syncFromChamado'), 'trigger deve sync em ticket já validado');
}

async function main() {
  testOrgaoRoutes();
  testPortalDto();
  testInboundAgent4Gatekeeper();
  testRoutingPersistHook();
  testTriggerReclamacaoGuard();
  console.log('test-reclamacoes-smoke: OK (5 suites)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
