/** create-desk-whatsapp-template.ts v1.1.0 — template UTILITY Desk (o Velotax) */
import { env } from '../src/config/env';
import { DESK_ACTIVE_WHATSAPP_TEMPLATE_TWILIO_BODY } from '../src/services/twilio/whatsappActiveOutbound.service';

const TEMPLATE_BODY = DESK_ACTIVE_WHATSAPP_TEMPLATE_TWILIO_BODY;

async function main() {
  const auth = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  const createRes = await fetch('https://content.twilio.com/v1/Content', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      friendly_name: 'desk_atendimento_ativo',
      language: 'pt_BR',
      variables: {
        1: 'Cliente',
        2: 'VD-000000',
        3: 'Estamos entrando em contato sobre sua solicitação.',
      },
      types: {
        'twilio/text': { body: TEMPLATE_BODY },
      },
    }),
  });

  const created = await createRes.json();
  if (!createRes.ok) {
    console.error('Falha ao criar template:', created);
    process.exit(1);
  }

  const sid = created.sid as string;
  console.log('Template criado:', sid);

  const apprRes = await fetch(`https://content.twilio.com/v1/Content/${sid}/ApprovalRequests/whatsapp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'desk_atendimento_ativo', category: 'UTILITY' }),
  });
  const approval = await apprRes.json();
  console.log('Approval:', JSON.stringify(approval, null, 2));
  console.log('\nDefina no Cloud Run / .env:');
  console.log(`TWILIO_WHATSAPP_DESK_ACTIVE_CONTENT_SID=${sid}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
