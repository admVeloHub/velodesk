/** test-ai-usage v1.0.0 — valida logAiUsage + getAiUsageDailyReport ponta a ponta */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { logAiUsage, getAiUsageDailyReport } from '../src/services/aiUsage.service';
import { AiUsageLog } from '../src/models/AiUsageLog';

async function main(): Promise<void> {
  console.log('--- Teste AI Usage ---');
  await connectDatabase();

  await logAiUsage({
    provider: 'openai',
    model: 'gpt-4.1-mini',
    feature: 'atendimento',
    inputTokens: 1200,
    outputTokens: 350,
    ticketId: 'test-ticket-id',
    protocolo: 'TEST-0001',
  });

  await logAiUsage({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    feature: 'refinar_rascunho',
    inputTokens: 800,
    outputTokens: 200,
  });

  await logAiUsage({
    provider: 'openai',
    model: 'modelo-inexistente-xyz',
    feature: 'auditoria',
    inputTokens: 500,
    outputTokens: 100,
  });

  const count = await AiUsageLog.countDocuments({ protocolo: 'TEST-0001' });
  console.log('Registros de teste com protocolo TEST-0001:', count);

  const report = await getAiUsageDailyReport({ period: 'hoje' });
  console.log('Resumo do dia:', JSON.stringify(report.summary, null, 2));
  console.log('Por feature:', JSON.stringify(report.byFeature, null, 2));
  console.log('Por modelo:', JSON.stringify(report.byModel, null, 2));

  await AiUsageLog.deleteMany({ protocolo: 'TEST-0001' });
  await AiUsageLog.deleteMany({ feature: 'refinar_rascunho', inputTokens: 800, outputTokens: 200 });
  await AiUsageLog.deleteMany({ feature: 'auditoria', modelName: 'modelo-inexistente-xyz' });

  await disconnectDatabase();
  console.log('--- OK ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha:', err);
  process.exit(1);
});
