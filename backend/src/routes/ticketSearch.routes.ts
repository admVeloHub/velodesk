/**
 * Rotas de busca avançada de tickets
 * VERSION: v1.3.0 | DATE: 2026-08-18
 * — by-cpf / desk-bar incluem chamados_reclamacoes
 */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { isMongoConnected } from '../config/database';
import {
  clampSearchLimit,
  normalizeSearchCriterios,
  searchTickets,
  searchTicketsByCpf,
  searchTicketsByCpfDeskBar,
} from '../services/ticketSearch.service';

const router = Router();

function parseCriteriosFromRequest(req: Request) {
  if (req.method === 'POST' && req.body && typeof req.body === 'object') {
    return normalizeSearchCriterios((req.body as Record<string, unknown>).criterios);
  }
  const raw = req.query.criterios;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return normalizeSearchCriterios(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return normalizeSearchCriterios(raw);
  }
  return [];
}

function parseLimitFromRequest(req: Request) {
  if (req.method === 'POST' && req.body && typeof req.body === 'object') {
    return clampSearchLimit((req.body as Record<string, unknown>).limit);
  }
  return clampSearchLimit(req.query.limit);
}

async function handleSearch(req: Request, res: Response) {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ success: false, message: 'MongoDB indisponível' });
    }
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const criterios = parseCriteriosFromRequest(req);
    if (!criterios.length) {
      return res.status(400).json({
        success: false,
        message: 'Informe ao menos um critério de busca',
        tickets: [],
        total: 0,
      });
    }

    const limit = parseLimitFromRequest(req);
    const result = await searchTickets(req.user, { criterios, limit });

    return res.json({
      success: true,
      tickets: result.tickets,
      total: result.total,
      limit: result.limit,
      source: 'ticket_search',
    });
  } catch (err) {
    console.error('[ticket-search] falhou:', err);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar tickets',
      tickets: [],
      total: 0,
    });
  }
}

router.get('/by-cpf/:cpf', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ success: false, message: 'MongoDB indisponível' });
    }
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const result = await searchTicketsByCpf(req.user, String(req.params.cpf || ''));
    return res.json({
      success: true,
      tickets: result.tickets,
      total: result.total,
      cpf: result.cpf,
      source: 'ticket_search_by_cpf',
    });
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    const message = err instanceof Error ? err.message : 'Erro ao buscar tickets por CPF';
    if (status >= 400 && status < 500) {
      return res.status(status).json({ success: false, message, tickets: [], total: 0 });
    }
    console.error('[ticket-search/by-cpf] falhou:', err);
    return res.status(500).json({ success: false, message: 'Erro ao buscar tickets por CPF', tickets: [], total: 0 });
  }
});

/** Barra de busca do Desk — ignora visão meus-chamados (lookup operacional por CPF). */
router.get('/desk-bar/cpf/:cpf', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ success: false, message: 'MongoDB indisponível' });
    }
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const result = await searchTicketsByCpfDeskBar(req.user, String(req.params.cpf || ''));
    return res.json({
      success: true,
      tickets: result.tickets,
      total: result.total,
      cpf: result.cpf,
      source: 'ticket_search_desk_bar_cpf',
    });
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    const message = err instanceof Error ? err.message : 'Erro ao buscar tickets por CPF';
    if (status >= 400 && status < 500) {
      return res.status(status).json({ success: false, message, tickets: [], total: 0 });
    }
    console.error('[ticket-search/desk-bar/cpf] falhou:', err);
    return res.status(500).json({ success: false, message: 'Erro ao buscar tickets por CPF', tickets: [], total: 0 });
  }
});

router.get('/', authMiddleware, handleSearch);
router.post('/', authMiddleware, handleSearch);

export default router;
