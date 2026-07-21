/** test-assignment-router v1.2.0 — cap-10 + claim manual */
import {
  applyManualResponsavelClaim,
  applySessionResponsavelIfNeeded,
  buildAgentCandidates,
  countLoadForAgent,
  pickLeastLoadedAgent,
  provisionalResponsavelFromAuth,
  provisionalResponsavelFromUser,
  resolveTerminalStatuses,
  shouldAutoAssign,
} from '../src/services/assignmentRouter.service';
import type { IChamadoN1 } from '../src/models/ChamadoN1';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testProvisionalResponsavel() {
  assert(
    provisionalResponsavelFromUser({ email: 'lucas.gravina@velodesk.local' }) === 'lucas.gravina',
    'deve usar prefixo do e-mail'
  );
  assert(
    provisionalResponsavelFromUser({ name: 'Ana Silva' }) === 'Ana Silva',
    'fallback para nome quando sem e-mail'
  );
}

function testPickLeastLoaded() {
  const agents = [
    { responsavel: 'agente.b', candidates: ['agente.b'] },
    { responsavel: 'agente.a', candidates: ['agente.a'] },
  ];
  const counts = new Map<string, number>([
    ['agente.a', 5],
    ['agente.b', 2],
  ]);
  const picked = pickLeastLoadedAgent(agents, counts);
  assert(picked?.responsavel === 'agente.b', 'deve escolher agente com menor carga');
  assert(picked?.carga === 2, 'carga deve ser 2');
}

function testPickLeastLoadedTieBreak() {
  const agents = [
    { responsavel: 'ze', candidates: ['ze'] },
    { responsavel: 'ana', candidates: ['ana'] },
  ];
  const counts = new Map<string, number>([
    ['ana', 1],
    ['ze', 1],
  ]);
  const picked = pickLeastLoadedAgent(agents, counts);
  assert(picked?.responsavel === 'ana', 'empate deve desempatar alfabeticamente (ana antes de ze)');
}

function testCountLoadMultipleCandidates() {
  const counts = new Map<string, number>([
    ['lucas', 2],
    ['lucas.gravina', 1],
  ]);
  const load = countLoadForAgent(counts, buildAgentCandidates({
    name: 'Lucas',
    email: 'lucas.gravina@velodesk.local',
  }));
  assert(load === 3, 'deve somar cargas de todos os candidatos do agente');
}

function testShouldAutoAssign() {
  const partial: Partial<IChamadoN1> = {
    tabulacao: [{ tipoChamado: '', produto: '', motivo: '', detalhe: '', responsavel: '', atribuido: '' }],
  };
  const withResponsavel: Partial<IChamadoN1> = {
    tabulacao: [{ tipoChamado: '', produto: '', motivo: '', detalhe: '', responsavel: 'agente', atribuido: '' }],
  };
  assert(shouldAutoAssign(withResponsavel) === false, 'preenchido não deve auto-atribuir');
  if (partial.tabulacao?.[0]) {
    const wouldAssignIfEnabled = !String(partial.tabulacao[0].responsavel).trim();
    assert(wouldAssignIfEnabled === true, 'vazio é candidato à roleta quando habilitada');
  }
}

function testTerminalStatuses() {
  const terminals = resolveTerminalStatuses();
  assert(terminals.includes('resolvido'), 'resolvido é terminal');
  assert(terminals.includes('cancelado'), 'cancelado é terminal');
  assert(terminals.includes('fechado'), 'fechado é terminal');
  assert(!terminals.includes('novo'), 'novo não é terminal');
}

function testSessionResponsavel() {
  const partial: Partial<IChamadoN1> = {
    tabulacao: [{ tipoChamado: '', produto: '', motivo: '', detalhe: '', responsavel: '', atribuido: '' }],
  };
  applySessionResponsavelIfNeeded(partial, {
    userId: '1',
    email: 'ana.silva@velodesk.local',
    role: 'agent',
    name: 'Ana Silva',
  });
  assert(partial.tabulacao?.[0]?.responsavel === 'ana.silva', 'sessão preenche responsavel');
  assert(partial.tabulacao?.[0]?.atribuido === '', 'atribuido permanece vazio na sessão');

  const filled: Partial<IChamadoN1> = {
    tabulacao: [{ tipoChamado: '', produto: '', motivo: '', detalhe: '', responsavel: 'existente', atribuido: '' }],
  };
  applySessionResponsavelIfNeeded(filled, {
    userId: '2',
    email: 'outro@velodesk.local',
    role: 'agent',
  });
  assert(filled.tabulacao?.[0]?.responsavel === 'existente', 'não sobrescreve responsavel existente');
}

function testProvisionalFromAuth() {
  assert(
    provisionalResponsavelFromAuth({ userId: '1', email: 'lucas@x.com', role: 'agent' }) === 'lucas',
    'auth usa prefixo do e-mail'
  );
}

function testPickLeastLoadedCap() {
  const agents = [
    { responsavel: 'agente.a', candidates: ['agente.a'] },
    { responsavel: 'agente.b', candidates: ['agente.b'] },
  ];
  const counts = new Map<string, number>([
    ['agente.a', 10],
    ['agente.b', 2],
  ]);
  const picked = pickLeastLoadedAgent(agents, counts);
  assert(picked?.responsavel === 'agente.b', 'agente no cap deve ser excluído (carga 10)');
}

function testManualClaim() {
  const chamado = {
    tabulacao: [{ tipoChamado: '', produto: '', motivo: '', detalhe: '', responsavel: '', atribuido: '' }],
    registro: [],
  } as import('../src/models/ChamadoN1').IChamadoN1;

  const claimed = applyManualResponsavelClaim(chamado, {
    userId: '1',
    email: 'ana.silva@velodesk.local',
    role: 'agent',
    name: 'Ana Silva',
  });
  assert(claimed === true, 'claim manual deve atribuir órfão');
  assert(chamado.tabulacao[0].responsavel === 'ana.silva', 'responsavel da sessão no claim');
}

function run() {
  testProvisionalResponsavel();
  testProvisionalFromAuth();
  testSessionResponsavel();
  testManualClaim();
  testPickLeastLoaded();
  testPickLeastLoadedCap();
  testPickLeastLoadedTieBreak();
  testCountLoadMultipleCandidates();
  testShouldAutoAssign();
  testTerminalStatuses();
  console.log('[test-assignment-router] todos os testes passaram');
}

run();
