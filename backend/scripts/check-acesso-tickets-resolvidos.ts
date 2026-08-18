/** check-acesso-tickets-resolvidos.ts — diagnostico: quais funcoes tem acesso.tickets-resolvidos */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { getDeskFuncaoPermissaoModel } from '../src/models/DeskFuncaoPermissao';

async function main(): Promise<void> {
  await connectDatabase();
  const Model = getDeskFuncaoPermissaoModel();
  const docs = await Model.find({}).lean();
  console.log(`Total de funcoes no banco: ${docs.length}`);
  for (const doc of docs) {
    const acesso = (doc.permissoes as any)?.acesso;
    console.log(`--- slug=${doc.slug} nome=${doc.nome} portalVisivel=${JSON.stringify(doc.portalVisivel)} ---`);
    console.log('  acesso existe?', acesso !== undefined && acesso !== null);
    console.log('  acesso completo:', JSON.stringify(acesso));
  }
  await disconnectDatabase();
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha:', err);
  process.exit(1);
});
