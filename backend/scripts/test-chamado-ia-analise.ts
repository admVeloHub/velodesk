/** test-chamado-ia-analise v1.0.0 — valida getRiscosCasoEspecial e elegibilidade sem gastar tokens de IA */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { ChamadoN1 } from '../src/models/ChamadoN1';
import { ChamadoIaAnalise } from '../src/models/ChamadoIaAnalise';
import { getRiscosCasoEspecial, hashTextoClassificacao, isElegivelParaAnaliseIa } from '../src/services/chamadoIaAnalise.service';
import { currentStatus, GESTAO_TERMINAL_STATUSES } from '../src/services/chamado.mapper';

async function main(): Promise<void> {
  console.log('--- Teste chamadoIaAnalise ---');
  await connectDatabase();

  const riscos = await getRiscosCasoEspecial(10);
  console.log('Riscos de caso especial (deve ser [] — cache ainda vazio):', JSON.stringify(riscos, null, 2));

  const amostra = await ChamadoN1.find({}).limit(20).exec();
  console.log(`Amostra de ${amostra.length} chamados — elegibilidade para análise de IA:`);
  for (const chamado of amostra) {
    const elegivel = isElegivelParaAnaliseIa(chamado);
    console.log(`  #${chamado.chamadoProtocolo || chamado._id} — elegível: ${elegivel}`);
  }

  // Simula um resultado de classificação (sem gastar tokens de IA) para validar o join + filtros
  // usados por getRiscosCasoEspecial (status ativo, não terminal, não Reclame Aqui formal).
  const ativo = amostra.find((c) => !GESTAO_TERMINAL_STATUSES.includes(currentStatus(c) as never));
  if (ativo) {
    await ChamadoIaAnalise.findOneAndUpdate(
      { chamadoId: ativo._id },
      {
        chamadoId: ativo._id,
        chamadoProtocolo: ativo.chamadoProtocolo || '',
        motivo: 'Teste automatizado',
        motivoNovo: true,
        sentimentoClasse: 'critico',
        casoGrave: { tipo: 'Bacen', trecho: 'trecho de teste — vou acionar o Bacen' },
        textoHash: hashTextoClassificacao('teste'),
        contextoVersao: 1,
        modelo: 'teste-manual',
        origem: 'auto',
        needsReanalysis: false,
        analisadoEm: new Date(),
      },
      { upsert: true, new: true },
    );

    const riscosComTeste = await getRiscosCasoEspecial(10);
    console.log('Riscos após inserir 1 caso de teste (deve ter 1 item):', JSON.stringify(riscosComTeste, null, 2));

    await ChamadoIaAnalise.deleteOne({ chamadoId: ativo._id });
    console.log('Registro de teste removido.');
  } else {
    console.log('Nenhum chamado ativo (não terminal) encontrado na amostra para simular o teste de risco.');
  }

  console.log('--- OK ---');
}

main()
  .catch((err) => {
    console.error('Erro no teste:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
