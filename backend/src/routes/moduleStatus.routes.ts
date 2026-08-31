/**
 * moduleStatus.routes v1.0.0 — status dos serviços (Painel 360°), espelha o VeloHub
 * VERSION: v1.0.0 | DATE: 2026-08-31
 */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { isConsoleConfigConnected, tryConnectConsoleConfig } from '../config/database';
import { getModuleStatusItems } from '../services/moduleStatus.service';

const router = Router();

router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    if (!isConsoleConfigConnected()) {
      await tryConnectConsoleConfig();
    }
    if (!isConsoleConfigConnected()) {
      return res.json({ success: true, items: [] });
    }

    const items = await getModuleStatusItems();
    return res.json({ success: true, items });
  } catch (err) {
    console.error('[module-status] falha ao ler status dos serviços:', (err as Error).message);
    return res.json({ success: true, items: [] });
  }
});

export default router;
