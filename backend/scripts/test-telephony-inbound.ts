/** Teste local da integração Contact Tel (inbound calls + recados) */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { env } from '../src/config/env';
import { TelephonyRecado } from '../src/models/TelephonyRecado';
import { TelephonyCall } from '../src/models/TelephonyCall';
import {
  CONTACT_TEL_COMPLETED_FIXTURE,
  CONTACT_TEL_NO_ANSWER_FIXTURE,
} from '../src/services/telephony-inbound/fixtures/contact-tel.fixture';
import {
  getInboundTelephonyRecados,
  processInboundTelephonyCall,
} from '../src/services/telephony-inbound/telephonyInbound.service';

async function main(): Promise<void> {
  await connectDatabase();

  await TelephonyRecado.deleteMany({ titulo: /^TESTE / });
  await TelephonyCall.deleteMany({
    externalCallId: {
      $in: [
        CONTACT_TEL_COMPLETED_FIXTURE.id,
        CONTACT_TEL_NO_ANSWER_FIXTURE.id,
        'test-call-001',
      ],
    },
  });

  await TelephonyRecado.create({
    recadoId: 'teste-pix-intermitente',
    titulo: 'TESTE PIX intermitente',
    areas: ['conta_e_pix'],
    tipo: 'instabilidade',
    mensagemCliente: 'Informe instabilidade temporária no envio de PIX.',
    orientacaoAtendimento: 'Use somente quando o cliente relatar falha no envio de PIX.',
    politicaChamado: 'nao_abrir',
    criterioChamado: null,
    telefonesOrigemLiberados: [],
    prioridade: 'alta',
    ativo: true,
    criadoPor: 'test-script',
  });

  const completed = await processInboundTelephonyCall(CONTACT_TEL_COMPLETED_FIXTURE);
  const duplicate = await processInboundTelephonyCall(CONTACT_TEL_COMPLETED_FIXTURE);
  const noAnswer = await processInboundTelephonyCall(CONTACT_TEL_NO_ANSWER_FIXTURE);
  const recados = await getInboundTelephonyRecados();

  const savedCompleted = await TelephonyCall.findOne({ externalCallId: CONTACT_TEL_COMPLETED_FIXTURE.id }).lean();
  const savedNoAnswer = await TelephonyCall.findOne({ externalCallId: CONTACT_TEL_NO_ANSWER_FIXTURE.id }).lean();

  const rootPayload = savedCompleted?.rawPayload as Record<string, unknown> | undefined;
  const segmentPayload = Array.isArray(rootPayload?.segments)
    ? rootPayload?.segments[0] as Record<string, unknown>
    : undefined;

  console.log(JSON.stringify({
    secretConfigured: Boolean(env.inboundTelephonyWebhookSecret),
    completed,
    duplicate,
    noAnswer,
    recadosCount: recados.items.length,
    recadosSchemaVersion: recados.schemaVersion,
    savedCompleted: savedCompleted ? {
      provider: savedCompleted.provider,
      status: savedCompleted.status,
      clientPhone: savedCompleted.clientPhone,
      clientCpf: savedCompleted.clientCpf,
      clientName: savedCompleted.clientName,
      agentName: savedCompleted.agentName,
      summary: savedCompleted.summary,
      hasTranscript: Boolean(savedCompleted.transcript),
      hasTransfer: Boolean(savedCompleted.transfer?.destinationType),
      transcriptTurns: savedCompleted.transcriptFull?.length ?? 0,
      recordingStrippedRoot: !('recording_download_url' in (rootPayload ?? {})),
      recordingStrippedSegment: !segmentPayload || !('recording_download_url' in segmentPayload),
    } : null,
    savedNoAnswer: savedNoAnswer ? {
      status: savedNoAnswer.status,
      transcript: savedNoAnswer.transcript,
      summary: savedNoAnswer.summary,
    } : null,
  }, null, 2));

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('Falha:', err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
