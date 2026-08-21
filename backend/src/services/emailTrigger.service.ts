/** emailTrigger.service v1.1.0 — substitui {client_name} antes do assemble */
import type { IChamadoN1 } from '../models/ChamadoN1';
import type { IEmailCriterio } from '../models/EmailConteudo';
import { getEmailDisparoLogModel } from '../models/EmailDisparoLog';
import {
  currentStatus,
  isEspeciaisChamado,
  readChamadoOriginSource,
  resolveCanalLabelFromSource,
} from './chamado.mapper';
import { resolveClientGreetingName } from './clientMessageEnvelope.service';
import { listActiveEmailConteudos } from './emailConteudo.service';
import { EMAIL_SLA_LIMIT_HOURS } from './emailOutbound.constants';
import { assembleClientEmail } from './emailSkeleton.service';
import { sendOutboundEmail } from './email-outbound.service';
import {
  buildOutboundMessageId,
  buildOutboundThreadHeaders,
  buildThreadSubject,
  persistOutboundEmailMeta,
} from './emailThread.service';

export type TriggerPass = 'event' | 'sla';

function resolveChamadoClientName(chamado: IChamadoN1): string {
  const tab = Array.isArray(chamado.tabulacao) ? chamado.tabulacao[chamado.tabulacao.length - 1] : null;
  const fromCliente = (chamado.cliente?.[0] as { clienteNome?: string } | undefined)?.clienteNome;
  return String(fromCliente || chamado.chamadoTitulo || tab?.motivo || '').trim();
}

/** Troca placeholders do admin ({client_name}, {nome_cliente}, etc.) pelo nome do cliente. */
export function substituteEmailTemplatePlaceholders(text: string, clientName?: string): string {
  const raw = String(text ?? '');
  if (!raw) return '';
  const greeting = resolveClientGreetingName(clientName, 'cliente');
  return raw
    .replace(/\{client_name\}/gi, greeting)
    .replace(/\{nome_cliente\}/gi, greeting)
    .replace(/\{nomeCliente\}/gi, greeting)
    .replace(/\{cliente\}/gi, greeting)
    .replace(/\{nome\}/gi, greeting);
}
function hasInternalTrigger(criterios: IEmailCriterio[]): boolean {
  return criterios.some((item) => item.tipo === 'gatilho_interno');
}

function hasSlaTrigger(criterios: IEmailCriterio[]): boolean {
  return criterios.some((item) => item.tipo === 'sla');
}

export function resolveTicketCanal(chamado: IChamadoN1): string {
  const tabs = chamado.tabulacao ?? [];
  const tabCanal = String(tabs[tabs.length - 1]?.canal ?? '').trim();
  if (tabCanal) return tabCanal;
  return resolveCanalLabelFromSource(readChamadoOriginSource(chamado)) || 'Portal';
}

function slaElapsedMs(chamado: IChamadoN1): number | null {
  const status = currentStatus(chamado);
  if (!EMAIL_SLA_LIMIT_HOURS[status]) return null;
  const registros = chamado.registro ?? [];
  const statusSince = registros[registros.length - 1]?.data ?? chamado.createdAt;
  if (!statusSince) return null;
  return Date.now() - new Date(statusSince).getTime();
}

export function resolveSlaFlags(chamado: IChamadoN1): { metade: boolean; estourado: boolean } {
  const status = currentStatus(chamado);
  const limitHours = EMAIL_SLA_LIMIT_HOURS[status];
  if (!limitHours) return { metade: false, estourado: false };
  const elapsed = slaElapsedMs(chamado);
  if (elapsed == null) return { metade: false, estourado: false };
  const limitMs = limitHours * 60 * 60 * 1000;
  return {
    metade: elapsed >= limitMs / 2 && elapsed <= limitMs,
    estourado: elapsed > limitMs,
  };
}

function valuesMatch(criterio: IEmailCriterio | undefined, actual: string): boolean {
  if (!criterio) return true;
  const valores = (criterio.valores || []).map((item) => String(item).trim()).filter(Boolean);
  if (!valores.length) return false;
  return valores.includes(actual);
}

function matchCriterios(
  criterios: IEmailCriterio[],
  ctx: { canal: string; status: string; sla: { metade: boolean; estourado: boolean } },
  pass: TriggerPass,
): string | null {
  if (hasInternalTrigger(criterios)) return null;
  const byTipo = new Map(criterios.map((item) => [item.tipo, item]));
  const slaCriterio = byTipo.get('sla');
  if (pass === 'event' && slaCriterio) return null;
  if (pass === 'sla' && !slaCriterio) return null;

  if (!valuesMatch(byTipo.get('canal'), ctx.canal)) return null;
  if (!valuesMatch(byTipo.get('status'), ctx.status)) return null;

  if (slaCriterio) {
    const wanted = new Set((slaCriterio.valores || []).map((item) => String(item)));
    if (wanted.has('estourado') && ctx.sla.estourado) return 'sla:estourado';
    if (wanted.has('metade') && ctx.sla.metade) return 'sla:metade';
    return null;
  }

  return `status:${ctx.status}`;
}

async function alreadySent(chamadoId: string, conteudoId: string, eventKey: string): Promise<boolean> {
  const Log = getEmailDisparoLogModel();
  const existing = await Log.findOne({ chamadoId, conteudoId, eventKey }).lean().exec();
  return Boolean(existing);
}

async function markSent(chamado: IChamadoN1, conteudoId: string, eventKey: string): Promise<boolean> {
  const Log = getEmailDisparoLogModel();
  try {
    await Log.create({
      chamadoId: chamado._id,
      protocolo: chamado.chamadoProtocolo,
      conteudoId,
      eventKey,
      sentAt: new Date(),
    });
    return true;
  } catch (err) {
    if (/duplicate|E11000/i.test((err as Error).message)) return false;
    throw err;
  }
}

async function sendTemplateEmail(chamado: IChamadoN1, doc: {
  _id: unknown;
  nome: string;
  saudacao?: string;
  corpo?: string;
}): Promise<boolean> {
  const { resolveClienteEmailFromChamado } = await import('./emailNotification.service');
  const to = await resolveClienteEmailFromChamado(chamado);
  if (!to) return false;

  const clientName = resolveChamadoClientName(chamado);
  const saudacao = substituteEmailTemplatePlaceholders(doc.saudacao ?? '', clientName);
  const corpo = substituteEmailTemplatePlaceholders(doc.corpo ?? '', clientName);

  const assembled = await assembleClientEmail({
    mode: 'template',
    chamado,
    saudacao,
    corpo,
  });

  const protocolo = chamado.chamadoProtocolo;
  const messageId = buildOutboundMessageId(protocolo);
  const headers = buildOutboundThreadHeaders(chamado, messageId);
  const result = await sendOutboundEmail({
    to,
    subject: buildThreadSubject(protocolo),
    text: assembled.text,
    html: assembled.html,
    headers,
    inlineImages: assembled.inlineImages,
  });

  if (!result.sent) {
    console.warn('[emailTrigger] não enviado:', doc.nome, result.reason);
    return false;
  }

  const status = currentStatus(chamado);
  if (!chamado.registro) chamado.registro = [];
  chamado.registro.push({
    data: new Date(),
    origin: 'sistema',
    autor: 'e-mail padrão',
    mensagemPublica: [saudacao, corpo].filter(Boolean).join('\n\n'),
    anexosMensagemPublica: [],
    anotacaoInterna: `E-mail padrão enviado: ${doc.nome}`,
    anexosAnotacaoInterna: [],
    alteracoes: [],
    metadados: { emailPadraoId: String(doc._id), emailPadraoNome: doc.nome },
    status,
  });
  persistOutboundEmailMeta(chamado, messageId, chamado.registro.length - 1);
  await chamado.save();
  return true;
}

export async function evaluateEmailTriggers(chamado: IChamadoN1, pass: TriggerPass): Promise<number> {
  if (isEspeciaisChamado(chamado)) return 0;

  const docs = await listActiveEmailConteudos();
  if (!docs.length) return 0;

  const ctx = {
    canal: resolveTicketCanal(chamado),
    status: currentStatus(chamado),
    sla: resolveSlaFlags(chamado),
  };

  let sent = 0;
  for (const doc of docs) {
    const criterios = doc.gatilho?.criterios || [];
    const eventKey = matchCriterios(criterios, ctx, pass);
    if (!eventKey) continue;

    const conteudoId = String(doc._id);
    if (await alreadySent(String(chamado._id), conteudoId, eventKey)) continue;
    const reserved = await markSent(chamado, conteudoId, eventKey);
    if (!reserved) continue;

    const ok = await sendTemplateEmail(chamado, doc);
    if (ok) {
      sent += 1;
    } else {
      const Log = getEmailDisparoLogModel();
      await Log.deleteOne({ chamadoId: chamado._id, conteudoId, eventKey }).exec();
    }
  }
  return sent;
}

export async function evaluateEmailTriggersAsync(chamado: IChamadoN1, pass: TriggerPass = 'event'): Promise<void> {
  try {
    await evaluateEmailTriggers(chamado, pass);
  } catch (err) {
    console.warn('[emailTrigger]', (err as Error).message);
  }
}
