/** test-desk-active-whatsapp.ts v1.0.0 */
import { sendWhatsAppForChamado } from '../src/services/twilio/whatsappActiveOutbound.service';
import type { IChamadoN1 } from '../models/ChamadoN1';

const mockChamado = {
  chamadoProtocolo: 'VD-TEST-001',
  chamadoTitulo: 'Cliente Teste',
  cliente: [],
  registro: [],
} as unknown as IChamadoN1;

async function main() {
  const to = process.env.TEST_WHATSAPP_TO ?? '+5515992382865';
  const result = await sendWhatsAppForChamado(mockChamado, {
    text: 'Teste mensagem ativa Desk — implementação aprovada.',
    waChatId: to.replace(/\D/g, ''),
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.sid) process.exit(1);
  await new Promise((r) => setTimeout(r, 8000));
  const { getTwilioClient } = await import('../src/services/twilio/twilioClient.util');
  const msg = await getTwilioClient().messages(result.sid).fetch();
  console.log('status:', msg.status, msg.errorCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
