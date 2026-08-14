/** reclameAquiTicketCreate.service v1.0.0 — cria ticket RA a partir de registro Hugme */
import { Types } from 'mongoose';
import { ChamadoN1 } from '../../models/ChamadoN1';
import type { IChamadoN1 } from '../../models/ChamadoN1';
import { createChamadoFromBody } from '../chamado.mapper';
import { buildFastPathTriagem } from '../agents/casosEspeciaisAgent.service';
import { routeCasoEspecialFormal } from '../agents/casosEspeciaisRouting.service';
import { findByChamadoId } from '../reclamacoes/reclamacao.service';
import { getWorkflowBySlug } from '../workflowDefinicao.service';
import type { IReclameAquiHugmeRegistro } from '../../models/reclamacoes/ReclameAquiHugmeRegistro.schema';

const RA_WORKFLOW_SLUG = 'reclame-aqui-tratativa';

function buildFallbackRaWorkflow(author = 'sistema') {
  const now = new Date().toISOString();
  return {
    templateId: RA_WORKFLOW_SLUG,
    definicaoSlug: RA_WORKFLOW_SLUG,
    title: 'TRATATIVA RECLAME AQUI',
    currentStepId: 'ra-triagem',
    step: 0,
    startedAt: now,
    stepHistory: [{
      stepId: 'ra-triagem',
      status: 'active',
      at: now,
      by: author,
      trigger: 'hugme-import',
    }],
    status: 'active',
    systemMessageInjected: false,
  };
}

async function buildRaWorkflowState(author = 'sistema') {
  const definicao = await getWorkflowBySlug(RA_WORKFLOW_SLUG);
  if (definicao) {
    const passos = [...(definicao.passos || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const first = passos[0];
    const stepId = first?._id?.toString() || 'ra-triagem';
    const now = new Date().toISOString();
    return {
      templateId: definicao.slug,
      definicaoSlug: definicao.slug,
      title: definicao.titulo || 'TRATATIVA RECLAME AQUI',
      currentStepId: stepId,
      step: 0,
      startedAt: now,
      stepHistory: [{
        stepId,
        status: 'active',
        at: now,
        by: author,
        trigger: 'hugme-import',
      }],
      status: 'active',
      systemMessageInjected: false,
    };
  }
  return buildFallbackRaWorkflow(author);
}

function buildReclameAquiMetaFromRegistro(registro: IReclameAquiHugmeRegistro) {
  const protocoloRa = registro.idOrigem ? `RA-ORIG-${registro.idOrigem}` : '';
  return {
    protocoloRa,
    idReclamacaoRa: registro.idHugme || registro.idOrigem,
    statusRa: registro.statusRa || 'nao-respondida',
    dataReclamacao: registro.dataReclamacao?.toISOString?.() || registro.dataReclamacao,
    assunto: registro.assunto,
    descricao: registro.descricao,
    consumidor: registro.consumidor,
    cpf: registro.cpf,
    produto: registro.produto,
    tipo: registro.tipo,
    motivo: registro.motivo,
    passivelNota: Boolean(registro.nota),
  };
}

export function buildTicketPayloadFromHugmeRegistro(
  registro: IReclameAquiHugmeRegistro,
  workflow: Record<string, unknown>,
  author = 'sistema',
) {
  const meta = buildReclameAquiMetaFromRegistro(registro);
  const cpf = String(registro.cpf ?? '').replace(/\D/g, '');

  return {
    chamadoTitulo: String(registro.assunto || '').trim() || 'Reclamação Reclame Aqui',
    title: String(registro.assunto || '').trim() || 'Reclamação Reclame Aqui',
    text: String(registro.descricao || '').trim(),
    description: String(registro.descricao || '').trim(),
    status: 'novo',
    clientName: String(registro.consumidor || '').trim(),
    clientCPF: cpf || undefined,
    author,
    lateralForm: {
      classificacaoTipo: registro.tipo || 'Reclamação',
      tipoChamado: registro.tipo || 'Reclamação',
      produto: registro.produto || '',
      motivo: registro.motivo || registro.assunto || '',
      detalhe: 'Reclamação Reclame Aqui — import Hugme',
      canal: 'Reclame Aqui',
      responsavel: author,
      clienteCpf: cpf,
      cpf,
      clienteNome: registro.consumidor || '',
      clienteTelefone: registro.telefoneWhatsapp ? [registro.telefoneWhatsapp] : [],
      clienteEmail: registro.email ? [registro.email] : [],
      reclameAqui: meta,
      workflow,
    },
  };
}

export interface CreateRaTicketFromHugmeResult {
  chamadoId: Types.ObjectId;
  chamadoProtocolo: string;
  reclamacaoId?: Types.ObjectId;
}

export async function createRaTicketFromHugmeRegistro(
  registro: IReclameAquiHugmeRegistro,
  author = 'sistema',
): Promise<CreateRaTicketFromHugmeResult> {
  const workflow = await buildRaWorkflowState(author);
  const payload = buildTicketPayloadFromHugmeRegistro(registro, workflow, author);
  const partial = await createChamadoFromBody(payload, 'novo');
  const chamado = await ChamadoN1.create(partial) as IChamadoN1;

  const triagem = buildFastPathTriagem('reclame_aqui', ['hugme-import:reclame-aqui', `idOrigem:${registro.idOrigem}`]);
  const persisted = {
    ...triagem,
    signals: ['hugme-import:reclame-aqui'],
    at: new Date().toISOString(),
  };

  await routeCasoEspecialFormal(chamado, persisted, { origemEntrada: 'hugme-import' });

  const reclamacao = await findByChamadoId('reclame_aqui', chamado._id!.toString());

  if (registro.respostaPublica?.trim() && chamado.registro?.[0]) {
    chamado.registro.push({
      data: new Date(),
      origin: 'agente',
      autor: author,
      mensagemPublica: registro.respostaPublica.trim(),
      anexosMensagemPublica: [],
      anotacaoInterna: '',
      anexosAnotacaoInterna: [],
      alteracoes: [],
      metadados: { source: 'hugme-import-resposta' },
      status: 'novo',
    });
    chamado.markModified('registro');
    await chamado.save();
  }

  return {
    chamadoId: chamado._id as Types.ObjectId,
    chamadoProtocolo: String(chamado.chamadoProtocolo ?? ''),
    reclamacaoId: reclamacao?._id as Types.ObjectId | undefined,
  };
}
