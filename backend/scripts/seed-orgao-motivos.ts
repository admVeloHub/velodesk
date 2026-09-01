/**
 * seed-orgao-motivos v1.0.0 — popula motivos Procon/Bacen (e RA se vazio) em tabulacao_opcoes
 * VERSION: v1.0.0 | DATE: 2026-08-20
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import {
  ensureOrgaoMotivoCategorias,
  getOpcoesByCategoria,
  MOTIVO_PROCON_BACEN_SEED,
} from '../src/services/tabulationOpcoes.service';
import { TABULACAO_OPCOES_CATEGORIAS } from '../src/models/TabulacaoOpcoes';

async function main() {
  await connectDatabase();

  const { seeded } = await ensureOrgaoMotivoCategorias();
  if (seeded.length) {
    console.log(`Seed aplicado: ${seeded.join(', ')}`);
  } else {
    console.log('Nenhuma categoria vazia — documentos já existiam com opções.');
  }

  for (const categoria of [
    TABULACAO_OPCOES_CATEGORIAS.MOTIVO_PROCON,
    TABULACAO_OPCOES_CATEGORIAS.MOTIVO_BACEN,
  ]) {
    const doc = await getOpcoesByCategoria(categoria, false);
    const valores = (doc?.opcoes || []).map((item) => item.valor);
    console.log(`\n${categoria} (${valores.length} motivos):`);
    valores.forEach((valor, idx) => console.log(`  ${idx + 1}. ${valor}`));

    const expected = MOTIVO_PROCON_BACEN_SEED.length;
    if (valores.length < expected) {
      console.warn(`  AVISO: esperado ${expected}, encontrado ${valores.length}`);
    }
  }

  await disconnectDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
