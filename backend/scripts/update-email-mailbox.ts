/** update-email-mailbox.ts v1.0.0 — troca remetente/delegação em desk_config.email_transport */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { env } from '../src/config/env';
import { getEmailTransportModel } from '../src/models/EmailTransportConfig';

async function main() {
  const mailbox = String(process.env.DESK_EMAIL_FROM ?? process.argv[2] ?? '').trim().toLowerCase();
  if (!mailbox.includes('@')) {
    console.error('Uso: DESK_EMAIL_FROM=suporte@velotax.com.br npm run update:email-mailbox');
    process.exit(1);
  }

  await connectDatabase();
  const Model = getEmailTransportModel();
  const doc = await Model.findOneAndUpdate(
    { configKey: env.deskEmailTransportDocumentId },
    { $set: { defaultFromEmail: mailbox, delegatedUserEmail: mailbox } },
    { new: true },
  );

  if (!doc) {
    console.error('Documento email_transport não encontrado — rode seed:email-transport primeiro');
    process.exit(1);
  }

  console.log(`OK — defaultFromEmail=${doc.defaultFromEmail} delegatedUserEmail=${doc.delegatedUserEmail}`);

  await disconnectDatabase();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
