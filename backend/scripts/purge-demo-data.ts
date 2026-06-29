/**
 * Remove tickets/clientes demo (Maria Silva, CPF teste, etc.) do MongoDB Atlas
 * Uso: npx tsx scripts/purge-demo-data.ts
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { ChamadoN1 } from '../src/models/ChamadoN1';
import { getClienteModel } from '../src/models/Cliente';

const DEMO_CPFS = ['12345678901', '11122233300'];

async function main() {
  await connectDatabase();

  const ticketFilter = {
    $or: [
      { 'cliente.clienteCpf': { $in: DEMO_CPFS } },
      { chamadoTitulo: { $regex: /maria silva|teste persistencia|lentidão internet fibra/i } },
    ],
  };

  const tickets = await ChamadoN1.deleteMany(ticketFilter);
  console.log(`chamados_n1: removidos ${tickets.deletedCount} documento(s)`);

  const Cliente = getClienteModel();
  const clientFilter = {
    $or: [
      { 'clienteDados.clienteCpf': { $in: DEMO_CPFS } },
      { 'clienteDados.clienteNome': { $regex: /maria silva|teste de cadastro/i } },
    ],
  };

  const clients = await Cliente.deleteMany(clientFilter);
  console.log(`clientes: removidos ${clients.deletedCount} documento(s)`);

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase();
  process.exit(1);
});
