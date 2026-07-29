/**
 * Exemplo de seed para o projeto DESTINO — importa knowledge.json no Supabase.
 * Copie este arquivo + knowledge.json para o outro repositório e ajuste as chaves.
 *
 * USO (no projeto destino):
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node seed-ticket-ia.example.js
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const knowledge = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'knowledge.json'), 'utf-8'),
);

const KEY_PREFIX = 'ticket_ia_'; // renomeie de octadesk_ia_ para ticket_ia_

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const aliasesRaw = knowledge.motivoAliases.map((a) => `${a.de} => ${a.para}`).join('\n');
  const taxonomiaRaw = knowledge.taxonomiaMotivos.join('\n');

  const rows = [
    { key: `${KEY_PREFIX}contexto_empresa`, value: knowledge.contextoEmpresa },
    { key: `${KEY_PREFIX}instrucoes_outros`, value: knowledge.instrucoesOutros },
    { key: `${KEY_PREFIX}taxonomia_motivos`, value: taxonomiaRaw },
    { key: `${KEY_PREFIX}motivo_aliases`, value: aliasesRaw },
    { key: `${KEY_PREFIX}max_tickets`, value: String(knowledge.metadata.defaults.maxTicketsPorChamada) },
    { key: `${KEY_PREFIX}contexto_versao`, value: '1' },
  ];

  const { error } = await supabase.from('system_settings').upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(error.message);

  console.log('Seed concluído:');
  console.log(`  ${knowledge.taxonomiaMotivos.length} motivos na taxonomia`);
  console.log(`  ${knowledge.motivoAliases.length} aliases`);
  console.log(`  ${knowledge.exemplosContexto.length} exemplos de contexto (importe separadamente se houver)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
