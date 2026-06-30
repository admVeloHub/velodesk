/** auth.routes v1.1.0 — login + Google SSO (fase testes Desk) */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { signToken } from '../middleware/auth';
import { isMongoConnected } from '../config/database';
import { resolveDeskAccessRole } from '../config/deskAccessAllowlist';
import { verifyGoogleIdToken } from '../services/googleAuth.service';
import { env } from '../config/env';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Banco de dados indisponível. Aguarde o backend conectar ao MongoDB.' });
    }
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }
    const token = signToken({ userId: user.id, email: user.email, role: user.role, name: user.name });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ message: 'Erro no login' });
  }
});

router.post('/auth/google', async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Banco de dados indisponível. Aguarde o backend conectar ao MongoDB.' });
    }

    const clientId = env.googleClientId;
    if (!clientId) {
      return res.status(503).json({ message: 'GOOGLE_CLIENT_ID não configurado no backend.' });
    }

    const credential = String(req.body?.credential || '').trim();
    if (!credential) {
      return res.status(400).json({ message: 'Credencial Google é obrigatória' });
    }

    const googleUser = await verifyGoogleIdToken(credential, clientId);
    const deskRole = resolveDeskAccessRole(googleUser.email);
    if (!deskRole) {
      return res.status(403).json({ message: 'Usuário sem permissão para acessar o Desk nesta fase de testes.' });
    }

    let user = await User.findOne({ email: googleUser.email });
    if (!user) {
      const hash = await bcrypt.hash(`google-sso:${googleUser.email}`, 10);
      user = await User.create({
        name: googleUser.name,
        email: googleUser.email,
        password: hash,
        role: deskRole,
      });
    } else if (user.role !== deskRole) {
      user.role = deskRole;
      user.name = googleUser.name || user.name;
      await user.save();
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: googleUser.email.split('@')[0],
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: googleUser.email.split('@')[0],
        email: user.email,
        role: user.role,
        deskProfile: deskRole,
        picture: googleUser.picture || null,
        source: 'google-desk',
      },
    });
  } catch (err) {
    console.error('Erro no login Google:', err);
    const message = err instanceof Error ? err.message : 'Erro no login Google';
    res.status(401).json({ message });
  }
});

export default router;
