/**
 * colaboradores.routes v1.0.1 — lista cadastro Desk (MONGO_ENV → VeloHubCentral)
 * VERSION: v1.0.1 | DATE: 2026-07-15 | AUTHOR: VeloHub Development Team
 */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { isFuncionariosConnected, tryConnectFuncionarios } from '../config/database';
import {
  findColaboradorByEmail,
  listColaboradoresDesk,
} from '../services/colaboradoresCadastro.service';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const acesso = String(req.query.acesso || '').trim();
    if (acesso.toLowerCase() !== 'desk') {
      return res.status(400).json({
        success: false,
        message: 'Informe acesso=Desk para listar colaboradores do Desk.',
        data: [],
      });
    }

    if (!isFuncionariosConnected()) {
      await tryConnectFuncionarios();
    }
    if (!isFuncionariosConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Cadastro de colaboradores indisponível (configure MONGO_ENV → VeloHubCentral / console_funcionarios).',
        data: [],
      });
    }

    const data = await listColaboradoresDesk();
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[colaboradores] list error:', err);
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Erro ao listar colaboradores',
      data: [],
    });
  }
});

router.get('/by-email', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!isFuncionariosConnected()) {
      await tryConnectFuncionarios();
    }
    if (!isFuncionariosConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Cadastro de colaboradores indisponível (configure MONGO_ENV → VeloHubCentral / console_funcionarios).',
      });
    }

    const email = String(req.query.email || '').trim();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Parâmetro email é obrigatório' });
    }

    const data = await findColaboradorByEmail(email);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Colaborador não encontrado' });
    }
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[colaboradores] by-email error:', err);
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Erro ao buscar colaborador',
    });
  }
});

export default router;
