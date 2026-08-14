/**
 * casosEspeciaisRouting.service v1.1.0 — roteamento + persistência chamados_reclamacoes
 * VERSION: v1.1.0 | DATE: 2026-08-07
 */
import { Types } from 'mongoose';
import type { IChamadoN1, ITabulacao } from '../../models/ChamadoN1';
import { env } from '../../config/env';
import {
  appendRegistroEntry,
  assertChamadoModifiable,
  currentStatus,
  readTabulacaoSnapshot,
} from '../chamado.mapper';
import { applyFuncaoEspecialAssignment } from '../assignmentRouter.service';
import { activateWorkflowForChamado } from '../workflowTicket.service';
import { getWorkflowBySlug } from '../workflowDefinicao.service';
import { createWorkflowNotificacao } from '../workflowNotificacao.service';
import { sendOutboundEmail } from '../email-outbound.service';
import { listAgentesDesk } from '../agenteDesk.service';
import { extractFuncoes } from '../../utils/normalizeFuncao';
import type {
  CasoEspecialOrgao,
  CasoEspecialOrgaoConfig,
  CasoEspecialTriagemPersisted,
} from './casosEspeciais.types';
import { getAgentNomeOficial } from './agentRegistry';
import {
  readInboxDedicadaHint,
  upsertFromChamado,
} from '../reclamacoes/reclamacao.service';

export const CASO_ESPECIAL_ORGAO_CONFIG: Record<
  Exclude<CasoEspecialOrgao, 'indefinido'>,
  CasoEspecialOrgaoConfig
> = {
  reclame_aqui: {
    orgao: 'reclame_aqui',
    funcaoSlug: 'reclame-aqui',
    source: 'reclame-aqui',
    canalLabel: 'Reclame Aqui',
    workflowSlug: 'reclame-aqui-tratativa',
  },
  procon: {
    orgao: 'procon',
    funcaoSlug: 'procon',
    source: 'procon',
    canalLabel: 'Procon',
    workflowSlug: 'procon-tratativa',
  },
  bacen: {
    orgao: 'bacen',
    funcaoSlug: 'bacen',
    source: 'bacen',
    canalLabel: 'Bacen',
    workflowSlug: 'bacen-tratativa',
  },
  consumidor_gov: {
    orgao: 'consumidor_gov',
    funcaoSlug: 'consumidor-gov',
    source: 'consumidor-gov',
    canalLabel: 'Consumidor.gov',
    workflowSlug: 'consumidor-gov-tratativa',
  },
};

function resolveOrgaoConfig(orgao: CasoEspecialOrgao): CasoEspecialOrgaoConfig | null {
  if (orgao === 'indefinido') return null;
  return CASO_ESPECIAL_ORGAO_CONFIG[orgao] ?? null;
}

function stampEspecialChannel(chamado: IChamadoN1, config: CasoEspecialOrgaoConfig): void {
  const registros = chamado.registro ?? [];
  const targetStatus = currentStatus(chamado) || 'novo';
  const metadados: Record<string, unknown> = {
    source: config.source,
    canalEspecial: config.canalLabel,
  };

  const clienteIdx = registros.findIndex(
    (reg) => String(reg.origin ?? '').toLowerCase() === 'cliente',
  );

  if (clienteIdx >= 0) {
    const reg = registros[clienteIdx];
    const existing = reg.metadados && typeof reg.metadados === 'object' ? reg.metadados : {};
    if (String(existing.source ?? '').toLowerCase() !== config.source) {
      reg.metadados = { ...existing, ...metadados };
    }
  } else {
    registros.unshift({
      data: new Date(),
      origin: 'cliente',
      autor: 'Canal especial',
      mensagemPublica: '',
      anexosMensagemPublica: [],
      anotacaoInterna: '',
      anexosAnotacaoInterna: [],
      alteracoes: [],
      metadados,
      status: targetStatus,
    });
    chamado.registro = registros;
  }
}

function updateTabulacaoCanal(chamado: IChamadoN1, config: CasoEspecialOrgaoConfig): void {
  // Atualiza a tabulação existente NO LUGAR (nunca acrescenta uma 2ª entrada): todo o resto do
  // sistema (segmentação por canal em permission.service.ts, exibição em chamado.mapper.ts,
  // merge, workflow) lê sempre tabulacao[0] como a tabulação corrente do chamado.
  const idx = chamado.tabulacao?.length ? chamado.tabulacao.length - 1 : 0;
  const last = readTabulacaoSnapshot(chamado.tabulacao?.[idx]);
  const next: ITabulacao = {
    ...last,
    tipoChamado: last.tipoChamado || 'Reclamação',
    motivo: last.motivo || config.canalLabel,
    detalhe: last.detalhe || `Demanda ${config.canalLabel}`,
  };
  if (!chamado.tabulacao?.length) {
    chamado.tabulacao = [next];
  } else {
    chamado.tabulacao[idx] = next;
  }
  chamado.markModified('tabulacao');
}

async function resolveTeamEmails(funcaoSlug: string): Promise<string[]> {
  const agentes = await listAgentesDesk();
  const emails = agentes
    .filter((agente) => {
      if (agente.afastado) return false;
      const funcoes = extractFuncoes(agente.atuacao);
      return agente.funcaoSlug === funcaoSlug || funcoes.includes(funcaoSlug);
    })
    .map((agente) => String(agente.email ?? '').trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(emails)];
}

async function notifyTeam(params: {
  chamado: IChamadoN1;
  config: CasoEspecialOrgaoConfig;
  responsavelEmail: string;
  titulo: string;
  mensagem: string;
  workflowId?: Types.ObjectId;
  workflowSlug?: string;
}): Promise<string[]> {
  const sent: string[] = [];
  const recipients = new Set<string>();

  if (params.responsavelEmail) recipients.add(params.responsavelEmail.toLowerCase());

  const teamEmails = await resolveTeamEmails(params.config.funcaoSlug);
  for (const email of teamEmails) recipients.add(email);

  for (const orgaoKey of ['reclame_aqui', 'procon', 'bacen', 'consumidor_gov'] as const) {
    const cfg = CASO_ESPECIAL_ORGAO_CONFIG[orgaoKey];
    if (cfg.funcaoSlug !== params.config.funcaoSlug) continue;
    const alertList = env.casosEspeciaisAlertEmails[orgaoKey] ?? [];
    for (const email of alertList) recipients.add(email.toLowerCase());
  }

  for (const email of recipients) {
    if (params.workflowId) {
      await createWorkflowNotificacao({
        destinatarioEmail: email,
        ticketId: params.chamado._id!.toString(),
        chamadoProtocolo: params.chamado.chamadoProtocolo,
        workflowId: params.workflowId.toString(),
        workflowSlug: params.workflowSlug || '',
        step: 0,
        passoId: null,
        titulo: params.titulo,
        mensagem: params.mensagem,
      });
      sent.push(`cta:${email}`);
    } else if (env.emailEnabled) {
      await sendOutboundEmail({
        to: email,
        subject: `[VeloDesk] ${params.titulo} — ${params.chamado.chamadoProtocolo}`,
        text: params.mensagem,
        html: `<p>${params.mensagem}</p><p>Protocolo: ${params.chamado.chamadoProtocolo}</p>`,
      });
      sent.push(`email:${email}`);
    }
  }

  return sent;
}

export interface RouteCasoEspecialResult {
  success: boolean;
  responsavelAtribuido?: string;
  notificacoes?: string[];
  workflowActivated?: boolean;
  error?: string;
}

export interface RouteCasoEspecialContext {
  origemEntrada?: string;
}

export async function routeCasoEspecialFormal(
  chamado: IChamadoN1,
  triagem: CasoEspecialTriagemPersisted,
  routeCtx: RouteCasoEspecialContext = {},
): Promise<RouteCasoEspecialResult> {
  try {
    assertChamadoModifiable(chamado);

    const config = resolveOrgaoConfig(triagem.orgao);
    if (!config) {
      return { success: false, error: 'Órgão indefinido — roteamento não aplicado' };
    }

    stampEspecialChannel(chamado, config);
    updateTabulacaoCanal(chamado, config);

    const assigned = await applyFuncaoEspecialAssignment(chamado, config.funcaoSlug, {
      source: 'casos-especiais',
    });

    let workflowId: Types.ObjectId | undefined;
    let workflowSlug = '';
    let workflowActivated = false;

    if (config.workflowSlug) {
      const definicao = await getWorkflowBySlug(config.workflowSlug);
      if (definicao && definicao.ativo !== false) {
        workflowActivated = await activateWorkflowForChamado(chamado, definicao, getAgentNomeOficial(4));
        if (workflowActivated) {
          workflowId = definicao._id as Types.ObjectId;
          workflowSlug = definicao.slug;
        }
      }
    }

    const responsavel = String(
      chamado.tabulacao?.[chamado.tabulacao.length - 1]?.responsavel ?? '',
    ).trim();

    const agentes = await listAgentesDesk();
    const responsavelEmail = agentes.find(
      (a) => a.colaboradorNome === responsavel || a.email.split('@')[0] === responsavel,
    )?.email ?? agentes.find((a) => {
      const funcoes = extractFuncoes(a.atuacao);
      return a.funcaoSlug === config.funcaoSlug || funcoes.includes(config.funcaoSlug);
    })?.email ?? '';

    const titulo = `Caso ${config.canalLabel} — triagem automática`;
    const mensagem = `Ticket ${chamado.chamadoProtocolo} classificado como caso formal (${config.canalLabel}). ${triagem.justificativa}`;

    const notificacoes = await notifyTeam({
      chamado,
      config,
      responsavelEmail,
      titulo,
      mensagem,
      workflowId,
      workflowSlug,
    });

    appendRegistroEntry(chamado, {
      autor: getAgentNomeOficial(4),
      anotacaoInterna: `Roteamento automático — ${config.canalLabel}: ${triagem.evidencia || triagem.justificativa}`,
      metadados: {
        skipAgentPipeline: true,
        agentCasosEspeciaisTriagem: {
          ...triagem,
          skipAgentPipeline: true,
          routed: true,
          at: triagem.at,
        },
      },
      alteracoes: [{
        canalEspecial: config.canalLabel,
        responsavel: responsavel || undefined,
        funcaoSlug: config.funcaoSlug,
      }],
    });

    await chamado.save();

    await upsertFromChamado(chamado, { ...triagem, signals: triagem.signals ?? [] }, {
      origemEntrada: routeCtx.origemEntrada || 'casos-especiais',
      inboxDedicada: readInboxDedicadaHint(chamado),
      workflowSlug: workflowSlug || config.workflowSlug || undefined,
    });

    console.info('[casos-especiais-routing]', {
      protocolo: chamado.chamadoProtocolo,
      orgao: config.orgao,
      responsavel,
      assigned,
      workflowActivated,
    });

    return {
      success: true,
      responsavelAtribuido: responsavel,
      notificacoes,
      workflowActivated,
    };
  } catch (err) {
    console.error('[casos-especiais-routing]', err);
    return { success: false, error: (err as Error).message };
  }
}

export function persistCasosEspeciaisTriagemOnly(
  chamado: IChamadoN1,
  triagem: CasoEspecialTriagemPersisted,
  options: { skipAgentPipeline?: boolean } = {},
): void {
  appendRegistroEntry(chamado, {
    autor: getAgentNomeOficial(4),
    anotacaoInterna: `Triagem casos especiais (${triagem.classificacao}): ${triagem.justificativa}`,
    metadados: {
      skipAgentPipeline: options.skipAgentPipeline === true,
      agentCasosEspeciaisTriagem: triagem,
    },
    alteracoes: [{ classificacao: triagem.classificacao, orgao: triagem.orgao }],
  });
}
