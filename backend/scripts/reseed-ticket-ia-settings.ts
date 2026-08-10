/**
 * Atualiza a taxonomia/aliases/contexto/instruções da IA de motivos a partir do pacote
 * exportado do WFM (exports/ticket-ia-knowledge/knowledge.json), SEM tocar em exemplos —
 * exemplos few-shot (TicketIaExemplo) continuam nascendo só da correção manual aqui no
 * Velodesk (correctChamadoIaReason). Rode de novo sempre que o WFM avançar de versão.
 *
 * USO: npx tsx scripts/reseed-ticket-ia-settings.ts
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { readExportedTicketIaKnowledge, updateTicketIaSettings } from '../src/services/ticketIaSettings.service';
import { TicketIaSettings } from '../src/models/TicketIaSettings';

async function main(): Promise<void> {
  await connectDatabase();

  const knowledge = readExportedTicketIaKnowledge();
  if (!knowledge) {
    throw new Error('Não achei exports/ticket-ia-knowledge/knowledge.json. Rode o export no wfm_atendimento e copie o pacote antes.');
  }

  const before = await TicketIaSettings.findOne({ key: 'default' }).lean();

  const updated = await updateTicketIaSettings({
    contextoEmpresa: knowledge.contextoEmpresa,
    instrucoesOutros: knowledge.instrucoesOutros,
    taxonomiaMotivos: knowledge.taxonomiaMotivos,
    motivoAliases: knowledge.motivoAliases,
  }, 'reseed-script');

  console.log(JSON.stringify({
    knowledgeExportedAt: knowledge.metadata?.exportedAt,
    knowledgeContextoVersao: knowledge.metadata?.contextoVersao,
    before: before ? {
      contextoVersao: before.contextoVersao,
      taxonomiaMotivos: before.taxonomiaMotivos.length,
      motivoAliases: before.motivoAliases.length,
    } : null,
    after: {
      contextoVersao: updated.contextoVersao,
      taxonomiaMotivos: updated.taxonomiaMotivos.length,
      motivoAliases: updated.motivoAliases.length,
    },
    obs: 'Exemplos (ticket_ia_exemplos) NÃO foram alterados — continuam vindo só da correção manual no Velodesk.',
  }, null, 2));

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('Falha no reseed:', err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
