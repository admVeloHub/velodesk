/** auth.routes v1.0.3 — register removido (usuários via seed/admin externo) */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { signToken } from '../middleware/auth';
import { isMongoConnected } from '../config/database';

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

export default router;
