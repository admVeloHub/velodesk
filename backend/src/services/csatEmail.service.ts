/**
 * csatEmail.service v1.0.0 — disparo de e-mail CSAT (encerramento + repescagem)
 * VERSION: v1.0.0 | DATE: 2026-08-24
 */
import type { IChamadoN1 } from '../models/ChamadoN1';
import { env } from '../config/env';
import { isEspeciaisChamado, currentStatus } from './chamado.mapper';
import { resolveClienteEmailFromChamado } from './emailNotification.service';
import { resolveChamadoClientName, substituteEmailTemplatePlaceholders } from './emailTrigger.service';
import { getEmailConteudoByNome } from './emailConteudo.service';
import { assembleClientEmail, plainTextToEmailHtml } from './emailSkeleton.service';
import { escapeHtmlAttribute } from './emailHtml.util';
import { sendOutboundEmail } from './email-outbound.service';
import {
  buildOutboundMessageId,
  buildOutboundThreadHeaders,
  buildThreadSubject,
  persistOutboundEmailMeta,
} from './emailThread.service';

/** Monta o bloco HTML das 5 estrelas clicáveis (cada uma é um <a href> com nota na URL). */
function buildCsatStarsHtml(protocolo: string): string {
  const base = env.twilioWebhookPublicBaseUrl.replace(/\/+$/, '');
  const safeProtocolo = encodeURIComponent(protocolo);
  const stars = [1, 2, 3, 4, 5]
    .map((n) => {
      const href = escapeHtmlAttribute(`${base}/csat?protocolo=${safeProtocolo}&nota=${n}`);
      return `<td align="center" valign="top" style="padding:0 4px;">
      <a href="${href}" target="_blank" style="text-decoration:none;display:inline-block;">
        <span style="font-size:32px;line-height:1;color:#FFB800;">★</span>
        <br>
        <span style="font-size:11px;color:#9AA0AE;">${n}</span>
      </a>
    </td>`;
    })
    .join('\n');

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
  <tr><td colspan="5" style="text-align:center;padding:0 0 6px 0;">
    <p style="margin:0;font-size:14px;font-weight:700;color:#272A30;font-family:Arial,sans-serif;">Como foi o seu atendimento?</p>
    <p style="margin:4px 0 12px 0;font-size:12px;color:#9AA0AE;font-family:Arial,sans-serif;">Clique nas estrelas para dar sua nota — de 1 a 5.</p>
  </td></tr>
  <tr>${stars}</tr>
</table>`;
}

async function composeAndSendCsatEmail(
  chamado: IChamadoN1,
  opts: { templateNome: string; isRepescagem: boolean },
): Promise<void> {
  // Guard: canal especial não recebe CSAT
  if (isEspeciaisChamado(chamado)) return;

  // Guards de idempotência
  if (opts.isRepescagem) {
    if (!chamado.csat?.enviado || chamado.csat.respondido || chamado.csat.repescagemEnviada) return;
  } else {
    if (chamado.csat?.enviado) return;
  }

  // Resolve e-mail do cliente
  const to = await resolveClienteEmailFromChamado(chamado);
  if (!to) {
    console.warn('[csatEmail] sem e-mail de cliente para CSAT:', chamado.chamadoProtocolo);
    return;
  }

  // Busca template ativo
  const doc = await getEmailConteudoByNome(opts.templateNome);
  if (!doc) {
    console.warn(`[csatEmail] template "${opts.templateNome}" não encontrado ou inativo`);
    return;
  }

  const clientName = resolveChamadoClientName(chamado);
  const saudacao = substituteEmailTemplatePlaceholders(doc.saudacao || '', clientName);
  const corpoTexto = substituteEmailTemplatePlaceholders(doc.corpo || '', clientName);
  const corpoTextoHtml = plainTextToEmailHtml(corpoTexto);
  const protocolo = String(chamado.chamadoProtocolo ?? '').trim();
  const blocoEstrelasHtml = buildCsatStarsHtml(protocolo);
  const corpo = `${corpoTextoHtml}\n${blocoEstrelasHtml}`;

  const assembled = await assembleClientEmail({
    mode: 'template',
    chamado,
    saudacao,
    corpo,
    corpoAlreadyHtml: true,
  });

  const messageId = buildOutboundMessageId(protocolo);
  const headers = buildOutboundThreadHeaders(chamado, messageId);
  const subject = buildThreadSubject(protocolo);

  const result = await sendOutboundEmail({
    to,
    subject,
    text: assembled.text,
    html: assembled.html,
    headers,
    inlineImages: assembled.inlineImages,
  });

  if (!result.sent) {
    console.warn('[csatEmail] não enviado:', opts.templateNome, result.reason);
    return;
  }

  // Registro de auditoria (mesmo padrão de sendTemplateEmail em emailTrigger.service)
  const status = currentStatus(chamado);
  if (!chamado.registro) chamado.registro = [];
  chamado.registro.push({
    data: new Date(),
    origin: 'sistema',
    autor: 'e-mail padrão',
    mensagemPublica: [saudacao, corpoTexto].filter(Boolean).join('\n\n'),
    anexosMensagemPublica: [],
    anotacaoInterna: `E-mail CSAT enviado: ${opts.templateNome}`,
    anexosAnotacaoInterna: [],
    alteracoes: [],
    metadados: { emailPadraoId: String(doc._id), emailPadraoNome: doc.nome, csatType: opts.isRepescagem ? 'repescagem' : 'inicial' },
    status,
  });

  persistOutboundEmailMeta(chamado, messageId, chamado.registro.length - 1);

  // Atualiza subdocumento csat
  const now = new Date();
  if (opts.isRepescagem) {
    chamado.csat!.repescagemEnviada = true;
    chamado.csat!.repescagemEnviadaEm = now;
  } else {
    chamado.csat = {
      enviado: true,
      enviadoEm: now,
      nota: null,
      comentario: '',
      respondido: false,
      respondidoEm: null,
      repescagemEnviada: false,
      repescagemEnviadaEm: null,
    };
  }

  await chamado.save();

  console.info('[csatEmail] enviado:', {
    protocolo,
    to,
    tipo: opts.isRepescagem ? 'repescagem' : 'inicial',
  });
}

/** Dispara e-mail de CSAT no encerramento do ticket. Fail-soft. */
export async function sendCsatEmailAsync(chamado: IChamadoN1): Promise<void> {
  try {
    await composeAndSendCsatEmail(chamado, {
      templateNome: 'Encerramento mais satisfação',
      isRepescagem: false,
    });
  } catch (err) {
    console.warn('[csatEmail] falha ao enviar CSAT:', (err as Error).message);
  }
}

/** Dispara e-mail de repescagem de CSAT. Fail-soft. */
export async function sendCsatRepescagemEmailAsync(chamado: IChamadoN1): Promise<void> {
  try {
    await composeAndSendCsatEmail(chamado, {
      templateNome: 'Repescagem da satisfação',
      isRepescagem: true,
    });
  } catch (err) {
    console.warn('[csatEmail] falha ao enviar repescagem CSAT:', (err as Error).message);
  }
}
