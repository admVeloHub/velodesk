/** import-reclame-aqui-base v1.0.0 — carga inicial Hugme sem tickets */
import { readFileSync, existsSync } from 'fs';
import { connectDatabase, disconnectDatabase, isReclamacoesConnected } from '../src/config/database';
import { importHugmeBuffer } from '../src/services/reclame-aqui/hugmeImport.service';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Uso: npm run import:reclame-aqui-base -- <caminho-planilha.xlsx>');
    process.exit(1);
  }
  if (!existsSync(filePath)) {
    console.error('Arquivo não encontrado:', filePath);
    process.exit(1);
  }

  await connectDatabase();
  if (!isReclamacoesConnected()) {
    console.error('Banco chamados_reclamacoes indisponível');
    process.exit(1);
  }

  const buffer = readFileSync(filePath);
  console.info('[import-reclame-aqui-base] iniciando', filePath);

  const result = await importHugmeBuffer(buffer, {
    modo: 'base_inicial',
    fileName: filePath.split(/[/\\]/).pop() || filePath,
    importedBy: 'cli-import-reclame-aqui-base',
  });

  console.info('[import-reclame-aqui-base] concluído', {
    batchId: result.batchId,
    stats: result.stats,
    parseStats: result.parse.stats,
    missingColumns: result.parse.missingColumns,
    errors: result.errors.length,
  });

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await disconnectDatabase();
  } catch {
    // ignore
  }
  process.exit(1);
});
