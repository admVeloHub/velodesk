/** list-desk-wa-outbound.ts v1.1.0 — pagina outbound Desk (sem códigos verificação) */
import { getTwilioClient } from '../src/services/twilio/twilioClient.util';

async function main() {
  const client = getTwilioClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const desk: Array<{
    date?: Date;
    status?: string;
    errorCode?: number | null;
    to?: string;
    sid?: string;
    body?: string;
  }> = [];

  let page = await client.messages.page({
    from: 'whatsapp:+17406933944',
    dateSentAfter: since,
    pageSize: 100,
  });

  while (page) {
    for (const m of page.instances) {
      if (String(m.body ?? '').includes('código de verificação')) continue;
      desk.push({
        date: m.dateCreated,
        status: m.status,
        errorCode: m.errorCode,
        to: m.to,
        sid: m.sid,
        body: String(m.body ?? '').slice(0, 120),
      });
    }
    if (desk.length >= 30 || !page.nextPageUrl) break;
    page = await page.nextPage();
  }

  desk.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  console.log(`Desde ${since.toISOString()} — ${desk.length} mensagens Desk (paginado)`);
  for (const m of desk.slice(0, 25)) {
    console.log(
      [
        m.date?.toISOString(),
        m.status,
        `err=${m.errorCode ?? '-'}`,
        m.to,
        `sid=${m.sid}`,
        m.body || '(corpo vazio — provável template)',
      ].join(' | '),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
