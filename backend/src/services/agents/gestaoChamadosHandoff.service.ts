/**
 * gestaoChamadosHandoff.service v1.0.0 — handoff crítico do Agente 2 para Gestão
 * VERSION: v1.0.0 | DATE: 2026-07-13
 */
import { ChamadoN1 } from '../../models/ChamadoN1';
import type { IChamadoN1 } from '../../models/ChamadoN1';
import { AgentGestaoAlert } from '../../models/AgentGestaoAlert';
import { env } from '../../config/env';
import { applyAssignmentToChamado } from '../assignmentRouter.service';
import { currentStatus } from '../chamado.mapper';
import type { GestaoHandoffInput, GestaoHandoffResult, NivelCriticidade } from './agentTypes';
import { sendOutboundEmail } from '../email-outbound.service';

function resolveEscalonar(
  nivel: NivelCriticidade,
  palavrasCriticas: string[] = [],
  produto?: string,
): string {
  const text = [...palavrasCriticas, produto || ''].join(' ').toLowerCase();
  if (nivel === 'critica') {
    if (/financeiro|estorno|cobrança|cobranca|inadimpl/.test(text)) return 'financeiro';
    return 'n2';
  }
  if (nivel === 'alta') {
    if (/financeiro|estorno/.test(text)) return 'financeiro';
    return 'suporte';
  }
  return '';
}

function resolveStatusForHandoff(nivel: NivelCriticidade, current: string): string {
  if (nivel === 'critica') return 'em-andamento';
  if (nivel === 'alta' && current === 'novo') return 'em-aberto';
  return current;
}

async function sendGestaoEmailAlert(
  protocolo: string,
  resumo: string,
  severidade: string,
): Promise<boolean> {
  const recipients = env.gestaoAlertEmails;
  if (!recipients.length || !env.emailEnabled) return false;

  const subject = `[VeloDesk] Alerta ${severidade.toUpperCase()} — Protocolo ${protocolo}`;
  const html = `<p><strong>Severidade:</strong> ${severidade}</p><p>${resumo}</p><p>Protocolo: ${protocolo}</p>`;

  let sent = false;
  for (const to of recipients) {
    const result = await sendOutboundEmail({ to, subject, text: resumo, html });
    if (result.sent) sent = true;
  }
  return sent;
}

async function sendGestaoWhatsappAlert(message: string): Promise<boolean> {
  if (!env.enableWhatsapp || !env.gestaoAlertWhatsapp) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const whatsapp = require('../../whatsapp/whatsappModule.js');
    if (typeof whatsapp.sendWhatsAppMessage === 'function') {
      await whatsapp.sendWhatsAppMessage(env.gestaoAlertWhatsapp, message);
      return true;
    }
  } catch (err) {
    console.warn('[agent-gestao-handoff] WhatsApp indisponível:', (err as Error).message);
  }
  return false;
}

export async function executeGestaoHandoff(input: GestaoHandoffInput): Promise<GestaoHandoffResult> {
  try {
    const chamado = await ChamadoN1.findById(input.ticketId);
    if (!chamado) {
      return { success: false, error: 'Chamado não encontrado' };
    }

    const notificacoes: string[] = [];
    let responsavelAtribuido = '';

    const assigned = await applyAssignmentToChamado(chamado, { source: 'app-integrado', canal: 'IA' });
    if (assigned) {
      responsavelAtribuido = String(chamado.tabulacao?.[0]?.responsavel || '').trim();
      notificacoes.push('atribuicao_roulette');
    }

    const escalonar = resolveEscalonar(input.nivelCriticidade, input.palavrasCriticas, input.produto);
    const statusAtual = currentStatus(chamado);
    const statusNovo = resolveStatusForHandoff(input.nivelCriticidade, statusAtual);

    const alteracoes: Record<string, unknown> = {
      agentHandoff: true,
      nivelCriticidade: input.nivelCriticidade,
      origem: input.origem || 'agente_auditoria',
      auditScore: input.auditScore,
      palavrasCriticas: input.palavrasCriticas || [],
    };
    if (escalonar) alteracoes.escalonar = escalonar;
    if (statusNovo !== statusAtual) alteracoes.status = statusNovo;

    chamado.registro.push({
      data: new Date(),
      origin: 'agente',
      autor: 'Agente Gestão',
      mensagemPublica: '',
      anexosMensagemPublica: [],
      anotacaoInterna: `Handoff crítico (${input.nivelCriticidade}): ${(input.palavrasCriticas || []).join(', ') || 'sem palavras-chave'}`,
      anexosAnotacaoInterna: [],
      alteracoes: [alteracoes],
      metadados: {
        agentGestaoHandoff: true,
        prioridadeCritica: input.nivelCriticidade,
        categoriaAtendimento: input.categoriaAtendimento,
      },
      status: statusNovo,
    });

    await chamado.save();

    const resumo = `Handoff crítico — ${input.categoriaAtendimento || 'Atendimento'} — ${(input.palavrasCriticas || []).join(', ') || 'risco elevado'}`;
    const alert = await AgentGestaoAlert.create({
      tipo: 'handoff_critico',
      severidade: input.nivelCriticidade,
      protocolo: input.protocolo,
      ticketId: input.ticketId,
      resumo,
      detalhes: {
        palavrasCriticas: input.palavrasCriticas,
        escalonar,
        responsavelAtribuido,
        auditScore: input.auditScore,
      },
      lido: false,
    });

    if (input.nivelCriticidade === 'critica' || input.nivelCriticidade === 'alta') {
      const emailSent = await sendGestaoEmailAlert(input.protocolo, resumo, input.nivelCriticidade);
      if (emailSent) notificacoes.push('email');
    }
    if (input.nivelCriticidade === 'critica') {
      const waMsg = `[VeloDesk CRÍTICO] Protocolo ${input.protocolo}: ${resumo}`;
      const waSent = await sendGestaoWhatsappAlert(waMsg);
      if (waSent) notificacoes.push('whatsapp');
    }
    if (input.nivelCriticidade !== 'baixa') {
      notificacoes.push('workspace360_cta');
    }

    console.info('[agent-gestao-handoff]', {
      protocolo: input.protocolo,
      nivel: input.nivelCriticidade,
      escalonar,
      responsavel: responsavelAtribuido,
    });

    return {
      success: true,
      responsavelAtribuido,
      escalonar: escalonar || undefined,
      statusAtualizado: statusNovo,
      notificacoesEnviadas: notificacoes,
      alertId: alert._id.toString(),
    };
  } catch (err) {
    console.error('[agent-gestao-handoff]', err);
    return { success: false, error: (err as Error).message };
  }
}

export async function listGestaoAlerts(limit = 50, onlyUnread = false) {
  const filter = onlyUnread ? { lido: false } : {};
  return AgentGestaoAlert.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
}

export async function markGestaoAlertRead(alertId: string) {
  return AgentGestaoAlert.findByIdAndUpdate(alertId, { lido: true }, { new: true });
}
