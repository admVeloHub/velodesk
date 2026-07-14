/**
 * inboundAgentPipeline.service v1.0.0 — pipeline de agentes no inbound (fail-soft)
 * VERSION: v1.0.0 | DATE: 2026-07-13
 */
import type { IChamadoN1 } from '../../models/ChamadoN1';
import { env } from '../../config/env';
import { currentStatus } from '../chamado.mapper';
import { runAgentPipeline } from './agentOrchestrator.service';
import type { TicketAiMessageInput } from './agentTypes';

function extractClientName(chamado: IChamadoN1): string {
  const reg = chamado.registro?.[0];
  return String(reg?.autor || '').trim();
}

function extractMessagesFromChamado(chamado: IChamadoN1): TicketAiMessageInput[] {
  const messages: TicketAiMessageInput[] = [];
  for (const reg of chamado.registro || []) {
    const pub = String(reg.mensagemPublica || '').trim();
    if (!pub) continue;
    messages.push({
      role: reg.origin === 'cliente' ? 'cliente' : 'agente',
      text: pub,
    });
  }
  return messages;
}

function extractCanal(chamado: IChamadoN1): string {
  const meta = chamado.registro?.[0]?.metadados || {};
  if (meta.source === 'email-inbound') return 'E-mail';
  return 'digital';
}

export async function runInboundAgentPipeline(
  chamado: IChamadoN1,
  context: { source: string },
): Promise<void> {
  if (!env.agentsEnabled) return;

  try {
    const messages = extractMessagesFromChamado(chamado);
    const hasClient = messages.some((m) => m.role === 'cliente');
    if (!hasClient && messages.length === 0) {
      const firstNote = String(chamado.registro?.[0]?.anotacaoInterna || chamado.registro?.[0]?.mensagemPublica || '').trim();
      if (!firstNote) return;
    }

    const pipelineModo = env.agentsAutonomyEnabled ? 'inbound' as const : 'desk' as const;

    const result = await runAgentPipeline({
      ticketId: chamado._id.toString(),
      protocolo: chamado.chamadoProtocolo,
      titulo: chamado.chamadoTitulo,
      canal: extractCanal(chamado),
      status: currentStatus(chamado),
      clientName: extractClientName(chamado),
      nomeOperador: 'Atendimento Velotax',
      contextSource: hasClient ? 'public' : 'internal',
      messages: hasClient ? messages : undefined,
      internalNote: hasClient ? undefined : String(chamado.registro?.[0]?.mensagemPublica || chamado.registro?.[0]?.anotacaoInterna || ''),
      pipelineModo,
    });

    console.info('[inbound-agent-pipeline]', {
      protocolo: chamado.chamadoProtocolo,
      source: context.source,
      success: result.success,
      auditScore: result.auditScore,
      envioAutonomo: result.envioAutonomo,
      decisao: result.auditDecisao,
    });
  } catch (err) {
    console.warn('[inbound-agent-pipeline] fail-soft:', (err as Error).message);
  }
}
