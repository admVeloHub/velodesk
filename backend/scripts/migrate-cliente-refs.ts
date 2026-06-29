/**
 * migrate-cliente-refs.ts v1.0.0
 * Migra chamados_n1.cliente[] legado (embed completo) → ref enxuta + b2c_cadastros.clientes
 *
 * Uso: npx tsx scripts/migrate-cliente-refs.ts
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase, getCadastrosConnection } from '../src/config/database';
import { env } from '../src/config/env';
import { ChamadoN1 } from '../src/models/ChamadoN1';
import { getClienteModel } from '../src/models/Cliente';
import { normalizeCpf } from '../src/services/cliente.service';

type LegacyCliente = {
  clienteCpf?: string;
  clienteNome?: string;
  clienteEmail?: { lista?: string[] };
  clienteTelefone?: { lista?: string[] };
  clienteId?: mongoose.Types.ObjectId | null;
};

async function upsertLegacyCliente(entry: LegacyCliente) {
  const cpf = normalizeCpf(entry.clienteCpf);
  const nome = String(entry.clienteNome ?? '').trim();
  if (!cpf && !nome) return null;

  const Cliente = getClienteModel();
  if (cpf) {
    const existing = await Cliente.findOne({ 'clienteDados.clienteCpf': cpf });
    if (existing) return existing;
  }

  return Cliente.create({
    clienteDados: [
      {
        clienteCpf: cpf,
        clienteNome: nome,
        clienteEmail: { lista: entry.clienteEmail?.lista ?? [] },
        clienteTelefone: { lista: entry.clienteTelefone?.lista ?? [] },
      },
    ],
    atendimentoHistorico: [],
  });
}

async function main() {
  await connectDatabase();
  getCadastrosConnection();

  const chamados = await ChamadoN1.find({ 'cliente.0': { $exists: true } });
  let migrated = 0;
  let skipped = 0;

  for (const chamado of chamados) {
    const raw = chamado.cliente?.[0] as LegacyCliente | undefined;
    if (!raw) {
      skipped += 1;
      continue;
    }

    const hasLegacyEmbed = Boolean(raw.clienteNome || raw.clienteEmail || raw.clienteTelefone);
    const hasRefOnly = raw.clienteId && raw.clienteCpf && !hasLegacyEmbed;

    if (hasRefOnly) {
      skipped += 1;
      continue;
    }

    let clienteId = raw.clienteId ?? null;

    if (hasLegacyEmbed || raw.clienteCpf) {
      const cadastro = await upsertLegacyCliente(raw);
      if (cadastro) clienteId = cadastro._id;
    }

    const cpf = normalizeCpf(raw.clienteCpf);
    if (!cpf && !clienteId) {
      chamado.cliente = [];
    } else {
      chamado.cliente = [{ clienteCpf: cpf, clienteId }];
      chamado.markModified('cliente');
    }

    await chamado.save();
    migrated += 1;
  }

  console.log(`Migração concluída — db chamados: ${env.mongoDbName}, cadastros: ${env.mongoCadastrosDbName}`);
  console.log(`  Migrados: ${migrated} | Ignorados: ${skipped}`);
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('Falha na migração:', err);
  await disconnectDatabase();
  process.exit(1);
});
