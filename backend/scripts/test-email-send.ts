/** test-email-send.ts v1.0.0 — envia e-mail de teste via Gmail API (desk_config) */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { loadEmailTransport, isEmailTransportReady, getEffectiveFromAddress } from '../src/services/emailTransport.service';
import { sendOutboundEmail } from '../src/services/email-outbound.service';

async function main() {
  const to = String(process.env.TEST_EMAIL_TO ?? '').trim().toLowerCase();
  if (!to.includes('@')) {
    console.error('Defina TEST_EMAIL_TO com o e-mail de destino.');
    console.error('Ex.: $env:TEST_EMAIL_TO="seu@email.com"; npm run test:email-send');
    process.exit(1);
  }

  await connectDatabase();
  await loadEmailTransport();

  if (!isEmailTransportReady()) {
    console.error('Gmail API não pronto. Verifique:');
    console.error('  1) EMAIL_ENABLED=true no .env');
    console.error('  2) npm run seed:email-transport com SA + conta delegada');
    console.error('  3) Delegação no Workspace Admin (escopo gmail.send)');
    process.exit(1);
  }

  const from = getEffectiveFromAddress();
  console.log(`Enviando teste de ${from} → ${to} ...`);

  const result = await sendOutboundEmail({
    to,
    subject: '[VeloDesk] Teste de envio',
    text: 'Se você recebeu este e-mail, o outbound Gmail do VeloDesk está funcionando.',
    html: '<p>Se você recebeu este e-mail, o <strong>outbound Gmail do VeloDesk</strong> está funcionando.</p>',
  });

  if (!result.sent) {
    console.error('Falha:', result.reason);
    process.exit(1);
  }

  console.log('OK — e-mail enviado. Confira a caixa de entrada (e spam).');
  await disconnectDatabase();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
