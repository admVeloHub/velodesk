import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { ChamadoN1 } from '../src/models/ChamadoN1';
import { currentStatus, currentResponsavel, buildChamadoQueryFilter, buildResponsavelCandidates } from '../src/services/chamado.mapper';

async function main() {
  await connectDatabase();
  const all = await ChamadoN1.find().lean();
  const byStatus: Record<string, number> = {};
  const byResponsavel: Record<string, number> = {};

  for (const c of all) {
    const st = currentStatus(c as never);
    const resp = currentResponsavel(c as never) || '(vazio)';
    byStatus[st] = (byStatus[st] || 0) + 1;
    byResponsavel[resp] = (byResponsavel[resp] || 0) + 1;
  }

  console.log('Total:', all.length);
  console.log('Por status:', byStatus);
  console.log('Por responsavel:', byResponsavel);

  const authUser = { userId: 'test', email: 'victor.silva@velotax.com.br', role: 'agent', name: 'victor.silva' };
  const candidates = buildResponsavelCandidates(authUser as never);
  console.log('candidates victor:', candidates);

  for (const status of ['novo', 'em-aberto', 'em-andamento', 'pendente', 'resolvido']) {
    const filter = buildChamadoQueryFilter(status, 'meus-chamados', candidates);
    const count = await ChamadoN1.countDocuments(filter);
    console.log(`meus-chamados / ${status}:`, count);
  }

  await disconnectDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
