/** uploads.routes v1.0.0 — signed URL GCP (bucket configurado posteriormente) */
import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';

const router = Router();

router.post('/signed-url', authMiddleware, async (req, res: Response) => {
  const fileName = String(req.body?.fileName ?? '').trim();
  const contentType = String(req.body?.contentType ?? 'application/octet-stream').trim();

  if (!fileName) {
    return res.status(400).json({ message: 'fileName é obrigatório' });
  }

  if (!env.gcpStorageBucket) {
    return res.status(503).json({
      message: 'Bucket GCP ainda não configurado. Informe GCP_STORAGE_BUCKET para habilitar uploads.',
    });
  }

  // Integração @google-cloud/storage será adicionada quando o bucket for informado.
  return res.status(501).json({
    message: 'Geração de signed URL pendente de configuração do bucket GCP.',
    bucket: env.gcpStorageBucket,
    fileName,
    contentType,
  });
});

export default router;
