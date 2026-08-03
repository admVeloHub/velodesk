/** consultas.routes v1.0.1 — códigos de erro distintos + CPF em rascunho */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  checkCustomerDataHealth,
  fetchConsulta360,
  fetchProductSnapshot,
  isCustomerDataApiConfigured,
} from '../services/customerDataApi.service';
import { ConsultaCpfError, resolveConsultaContext, type ResolveConsultaInput } from '../services/consultaCpfResolver.service';
import { isConsultaProductSlug } from '../services/consultaProductMap';
import { normalizeCpf } from '../services/cliente.service';

const router = Router();

function readConsultaInput(body: Record<string, unknown>): ResolveConsultaInput {
  const ticketId = String(body.ticketId ?? body.id ?? '').trim() || undefined;
  const lateral = (body.lateralForm ?? {}) as Record<string, unknown>;
  const cpf = normalizeCpf(
    body.cpf
    ?? body.clientCPF
    ?? lateral.clienteCpf
    ?? lateral.cpf,
  ) || undefined;

  return {
    ticketId,
    protocolo: String(body.protocolo ?? body.chamadoProtocolo ?? '').trim() || undefined,
    cpf,
    isDraft: Boolean(body.isDraft) || String(ticketId ?? '').startsWith('draft-'),
    ticketProduct: String(body.ticketProduct ?? lateral.produto ?? body.produto ?? '').trim() || undefined,
  };
}

function respondConsultaError(res: Response, err: ConsultaCpfError) {
  return res.status(err.status).json({ message: err.message, code: err.code });
}

router.get('/health', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const health = await checkCustomerDataHealth();
    res.json(health);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ message: message || 'Erro ao verificar integração de consultas.' });
  }
});

router.post('/360', authMiddleware, async (req: Request, res: Response) => {
  if (!isCustomerDataApiConfigured()) {
    return res.status(503).json({
      message: 'Integração de consultas não configurada. Defina x-api-key na fonte da verdade.',
    });
  }

  const input = readConsultaInput(req.body ?? {});
  if (!input.ticketId && !input.protocolo && !input.cpf) {
    return res.status(400).json({ message: 'ticketId, protocolo ou cpf é obrigatório.' });
  }

  try {
    const ctx = await resolveConsultaContext(input);
    const payload = await fetchConsulta360(ctx);
    res.json(payload);
  } catch (err) {
    if (err instanceof ConsultaCpfError) {
      return respondConsultaError(res, err);
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[consultas] POST /360 falhou:', message);
    res.status(502).json({ message: message || 'Não foi possível consultar os dados do cliente.' });
  }
});

router.post('/product/:slug', authMiddleware, async (req: Request, res: Response) => {
  if (!isCustomerDataApiConfigured()) {
    return res.status(503).json({
      message: 'Integração de consultas não configurada. Defina x-api-key na fonte da verdade.',
    });
  }

  const slug = String(req.params.slug ?? '').trim();
  if (!isConsultaProductSlug(slug)) {
    return res.status(400).json({ message: 'Produto de consulta inválido.' });
  }

  const input = readConsultaInput(req.body ?? {});
  if (!input.ticketId && !input.protocolo && !input.cpf) {
    return res.status(400).json({ message: 'ticketId, protocolo ou cpf é obrigatório.' });
  }

  try {
    const ctx = await resolveConsultaContext(input);
    const snapshot = await fetchProductSnapshot(slug, ctx.cpf, ctx.protocolo);
    res.json({
      slug,
      cpfFormatted: ctx.cpfFormatted,
      ...snapshot,
      loaded: true,
    });
  } catch (err) {
    if (err instanceof ConsultaCpfError) {
      return respondConsultaError(res, err);
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[consultas] POST /product/${slug} falhou:`, message);
    res.status(502).json({ message: message || 'Não foi possível consultar o produto.' });
  }
});

export default router;
