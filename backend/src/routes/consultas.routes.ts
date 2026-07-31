/** consultas.routes v1.0.0 — proxy aba Consultas (Customer Data API B+) */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  checkCustomerDataHealth,
  fetchConsulta360,
  fetchProductSnapshot,
  isCustomerDataApiConfigured,
} from '../services/customerDataApi.service';
import { ConsultaCpfError, resolveConsultaContext } from '../services/consultaCpfResolver.service';
import { isConsultaProductSlug } from '../services/consultaProductMap';

const router = Router();

function readTicketRef(body: Record<string, unknown>): { ticketId?: string; protocolo?: string } {
  return {
    ticketId: String(body.ticketId ?? body.id ?? '').trim() || undefined,
    protocolo: String(body.protocolo ?? body.chamadoProtocolo ?? '').trim() || undefined,
  };
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

  const ref = readTicketRef(req.body ?? {});
  if (!ref.ticketId && !ref.protocolo) {
    return res.status(400).json({ message: 'ticketId ou protocolo é obrigatório.' });
  }

  try {
    const ctx = await resolveConsultaContext(ref);
    const payload = await fetchConsulta360(ctx);
    res.json(payload);
  } catch (err) {
    if (err instanceof ConsultaCpfError) {
      return res.status(err.status).json({ message: err.message, code: 'missing_cpf' });
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

  const ref = readTicketRef(req.body ?? {});
  if (!ref.ticketId && !ref.protocolo) {
    return res.status(400).json({ message: 'ticketId ou protocolo é obrigatório.' });
  }

  try {
    const ctx = await resolveConsultaContext(ref);
    const snapshot = await fetchProductSnapshot(slug, ctx.cpf, ctx.protocolo);
    res.json({
      slug,
      cpfFormatted: ctx.cpfFormatted,
      ...snapshot,
      loaded: true,
    });
  } catch (err) {
    if (err instanceof ConsultaCpfError) {
      return res.status(err.status).json({ message: err.message, code: 'missing_cpf' });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[consultas] POST /product/${slug} falhou:`, message);
    res.status(502).json({ message: message || 'Não foi possível consultar o produto.' });
  }
});

export default router;
