/** seed.service v1.6.0 — purge mock unificado + seed workflow config */
import bcrypt from 'bcryptjs';
import { ChamadoN1 } from '../models/ChamadoN1';
import { User } from '../models/User';
import { getClienteModel } from '../models/Cliente';
import { getTabulacaoProdutoModel } from '../models/TabulacaoProduto';
import {
  DEFAULT_TABULACAO_PRODUTOS,
  invalidateTabulationCache,
} from './tabulation.service';
import { WORKFLOW_TEST_PROTOCOL_PREFIX } from './workflowTestSeed.service';
import { seedWorkflowConfig } from './workflowConfigSeed.service';
import { seedFuncoesPermissoes } from './funcaoPermissao.service';
import { migrateGrupoToFuncao } from './migrateGrupoToFuncao.service';
import { migrateEscalonarPermissao } from './migrateEscalonarPermissao.service';
import { env } from '../config/env';

const DEMO_CPFS = ['12345678901', '11122233300'];

const TEST_CLIENT_CPFS = [
  '90100000001', '90100000002', '90100000003', '90100000004', '90100000005',
  '90100000006', '90100000007', '90100000008', '90100000009',
];

const ALL_DEMO_CPFS = [...DEMO_CPFS, ...TEST_CLIENT_CPFS];

/** Remove tickets e clientes mock (legado + WF-TEST + [TESTE]) */
export async function purgeAllMockTickets(): Promise<{ tickets: number; clients: number }> {
  const ticketFilter = {
    $or: [
      { chamadoProtocolo: { $regex: `^${WORKFLOW_TEST_PROTOCOL_PREFIX}` } },
      { chamadoTitulo: { $regex: /^\[TESTE\]/i } },
      { 'cliente.clienteCpf': { $in: ALL_DEMO_CPFS } },
      { chamadoTitulo: { $regex: /maria silva|teste persistencia|lentidão internet fibra/i } },
      { chamadoTitulo: 'Lentidão Internet Fibra' },
      { 'registro.metadados.seedSource': 'workflow-test-seed' },
    ],
  };

  const tickets = await ChamadoN1.deleteMany(ticketFilter);

  const Cliente = getClienteModel();
  const clients = await Cliente.deleteMany({
    $or: [
      { 'clienteDados.clienteCpf': { $in: ALL_DEMO_CPFS } },
      { 'clienteDados.clienteNome': { $regex: /maria silva|teste de cadastro/i } },
      { 'clienteDados.clienteEmail.lista': { $regex: /@email-teste\.com$/i } },
    ],
  });

  console.log(
    `Purge mock tickets: chamados removidos=${tickets.deletedCount ?? 0}, clientes removidos=${clients.deletedCount ?? 0}`,
  );

  return {
    tickets: tickets.deletedCount ?? 0,
    clients: clients.deletedCount ?? 0,
  };
}

/** @deprecated use purgeAllMockTickets */
export async function purgeLegacyDemoData() {
  await purgeAllMockTickets();
}

export async function runDeskConfigMigrations(): Promise<void> {
  await migrateEscalonarPermissao();
  await migrateGrupoToFuncao();
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
  await seedFuncoesPermissoes();
  await seedWorkflowConfig();
  await runDeskConfigMigrations();
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
      })),
    );
    console.log(`Seed: ${DEFAULT_TABULACAO_PRODUTOS.length} produto(s) de tabulação criados`);
  }

  invalidateTabulationCache();
}
