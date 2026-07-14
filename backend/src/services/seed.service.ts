/** seed.service v1.5.1 — purge demo legado + dev seed admin + tabulacao_campos */
import bcrypt from 'bcryptjs';
import { ChamadoN1 } from '../models/ChamadoN1';
import { User } from '../models/User';
import { getClienteModel } from '../models/Cliente';
import { getTabulacaoProdutoModel } from '../models/TabulacaoProduto';
import {
  DEFAULT_TABULACAO_PRODUTOS,
  invalidateTabulationCache,
} from './tabulation.service';
import { seedWorkflowTestTickets } from './workflowTestSeed.service';
import { env } from '../config/env';

const DEMO_CPFS = ['12345678901', '11122233300'];

/** Remove resíduos do seed antigo (Maria Silva, CPF teste, etc.) em chamados_n1 e clientes */
export async function purgeLegacyDemoData() {
  const ticketFilter = {
    $or: [
      { 'cliente.clienteCpf': { $in: DEMO_CPFS } },
      { chamadoTitulo: { $regex: /maria silva|teste persistencia|lentidão internet fibra/i } },
      { chamadoTitulo: 'Lentidão Internet Fibra' },
    ],
  };

  const beforeCount = await ChamadoN1.countDocuments(ticketFilter);
  const tickets = await ChamadoN1.deleteMany(ticketFilter);
  const afterCount = await ChamadoN1.countDocuments(ticketFilter);

  console.log(
    `Purge v1.4.0: chamados demo antes=${beforeCount} removidos=${tickets.deletedCount} restantes=${afterCount}`
  );

  const Cliente = getClienteModel();
  const clientFilter = {
    $or: [
      { 'clienteDados.clienteCpf': { $in: DEMO_CPFS } },
      { 'clienteDados.clienteNome': { $regex: /maria silva|teste de cadastro/i } },
    ],
  };

  const clients = await Cliente.deleteMany(clientFilter);
  if (clients.deletedCount > 0) {
    console.log(`Purge v1.4.0: removidos ${clients.deletedCount} cliente(s) demo de b2c_cadastros`);
  }
}

export async function seedDevelopmentData() {
  if (env.nodeEnv !== 'development') return;

  const admin = await User.findOne({ email: 'admin@velodesk.local' });
  if (!admin) {
    const hash = await bcrypt.hash('admin123', 10);
    await User.create({
      name: 'Admin Velodesk',
      email: 'admin@velodesk.local',
      password: hash,
      role: 'supervisor',
    });
    console.log('Seed: usuário admin@velodesk.local / admin123');
  }

  await seedTabulationConfig();
  await seedWorkflowTestData();
}

async function seedWorkflowTestData() {
  const { created, skipped } = await seedWorkflowTestTickets();
  if (created > 0) {
    console.log(`Seed: ${created} ticket(s) de teste de workflow criado(s) (WF-TEST-*)`);
  } else if (skipped > 0) {
    console.log(`Seed: ${skipped} ticket(s) de teste de workflow sincronizado(s) (WF-TEST-*)`);
  }
}

async function seedTabulationConfig() {
  const Produto = getTabulacaoProdutoModel();
  const produtoCount = await Produto.countDocuments();
  if (produtoCount === 0) {
    await Produto.insertMany(
      DEFAULT_TABULACAO_PRODUTOS.map((item) => ({
        ...item,
        ativo: true,
        updatedBy: 'seed',
      }))
    );
    console.log(`Seed: ${DEFAULT_TABULACAO_PRODUTOS.length} produto(s) de tabulação criados`);
  }

  invalidateTabulationCache();
}
