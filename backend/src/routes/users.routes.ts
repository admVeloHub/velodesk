import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { User } from '../models/User';

const router = Router();

router.get('/', authMiddleware, async (_req, res: Response) => {
  const users = await User.find().select('-password').sort({ name: 1 });
  res.json(users);
});

export default router;
