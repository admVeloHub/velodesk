/** grant-tickets-resolvidos-access.ts — libera o novo modulo 'tickets-resolvidos' para
 * financeiro/produtos/gestao diretamente no banco (documentos ja configurados manualmente
 * via o editor de Modulos de Acesso nao recebem o backfill de novos ids automaticamente). */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { getDeskFuncaoPermissaoModel } from '../src/models/DeskFuncaoPermissao';

const SLUGS_TO_GRANT = ['financeiro', 'produtos', 'gestao'];

async function main(): Promise<void> {
  await connectDatabase();
  const Model = getDeskFuncaoPermissaoModel();

  for (const slug of SLUGS_TO_GRANT) {
    const res = await Model.updateOne(
      { slug },
      { $set: { 'permissoes.acesso.tickets-resolvidos': true } },
    );
    console.log(`slug=${slug} matched=${res.matchedCount} modified=${res.modifiedCount}`);
  }

  const docs = await Model.find({ slug: { $in: SLUGS_TO_GRANT } }).lean();
  for (const doc of docs) {
    console.log(`--- slug=${doc.slug} acesso=${JSON.stringify((doc.permissoes as any)?.acesso)}`);
  }

  await disconnectDatabase();
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha:', err);
  process.exit(1);
});
