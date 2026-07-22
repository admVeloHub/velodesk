/** test-gestao-detail v1.0.0 — valida getCasoEspecialDetail, getCasosEspeciais e o relatório de IA estendido */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { getCasosEspeciais, getCasoEspecialDetail, getVolumeSeries } from '../src/services/gestaoInsights.service';
import { getAiUsageDailyReport, getAiUsageTotals } from '../src/services/aiUsage.service';

async function main(): Promise<void> {
  console.log('--- Teste Gestão detalhe ---');
  await connectDatabase();

  const casos = await getCasosEspeciais({ period: 'mes' });
  console.log('Casos especiais (mês):', JSON.stringify(casos, null, 2));

  const detail = await getCasoEspecialDetail('bacen', { period: 'mes', compare: 'mom' });
  console.log('Detalhe Bacen (mom):', JSON.stringify(detail, null, 2));

  const detailYoy = await getCasoEspecialDetail('reclameAqui', { period: 'hoje', compare: 'yoy' });
  console.log('Detalhe Reclame Aqui (yoy, hoje):', JSON.stringify(detailYoy, null, 2));

  const notFound = await getCasoEspecialDetail('inexistente', {});
  console.log('Órgão inexistente ->', notFound);

  const aiTotals = await getAiUsageTotals();
  console.log('AI usage totals:', JSON.stringify(aiTotals, null, 2));

  const aiReport = await getAiUsageDailyReport({ period: 'mes', compare: 'mom' });
  console.log('AI usage report byColaborador:', JSON.stringify(aiReport.byColaborador, null, 2));
  console.log('AI usage report byProduto:', JSON.stringify(aiReport.byProduto, null, 2));
  console.log('AI usage report comparison:', JSON.stringify(aiReport.comparison, null, 2));

  console.log('--- Teste granularidade mês fechado ---');
  const volumeMes = await getVolumeSeries({ granularity: 'mes' });
  console.log('Volume (mês):', JSON.stringify(volumeMes, null, 2));

  const casoDetailMes = await getCasoEspecialDetail('procon', { granularity: 'mes', compare: 'yoy' });
  console.log('Detalhe Procon (mês, yoy):', JSON.stringify(casoDetailMes, null, 2));

  const aiReportMes = await getAiUsageDailyReport({ granularity: 'mes', compare: 'yoy' });
  console.log('AI usage report (mês) series:', JSON.stringify(aiReportMes.series, null, 2));
  console.log('AI usage report (mês) comparison:', JSON.stringify(aiReportMes.comparison, null, 2));

  await disconnectDatabase();
  console.log('--- OK ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha:', err);
  process.exit(1);
});
