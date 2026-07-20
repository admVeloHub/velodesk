import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { ChamadoN1 } from '../src/models/ChamadoN1';
import { Box } from '../src/models/Box';
import { currentStatus, currentResponsavel } from '../src/services/chamado.mapper';

async function main() {
  await connectDatabase();
  const count = await ChamadoN1.countDocuments();
  const boxes = await Box.countDocuments();
  const sample = await ChamadoN1.find().limit(5).lean();

  console.log('chamados_n1 count:', count);
  console.log('boxes count:', boxes);

  for (const c of sample) {
    console.log('---');
    console.log('protocolo:', c.chamadoProtocolo);
    console.log('status:', currentStatus(c as never));
    console.log('responsavel:', currentResponsavel(c as never));
  }

  await disconnectDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
