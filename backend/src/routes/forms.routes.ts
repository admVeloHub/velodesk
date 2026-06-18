import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { Form } from '../models/Form';

const router = Router();

router.get('/', authMiddleware, async (_req, res: Response) => {
  const forms = await Form.find().sort({ createdAt: -1 });
  res.json(forms);
});

export default router;
