/** internalAttachmentScan.routes v1.0.1 — callback do scanner ClamAV (updateOne atômico) */
import { Router, type Request, type Response } from 'express';
import { env } from '../config/env';
import { applyAttachmentScanResult } from '../services/attachmentScanCallback.service';

const router = Router();

function authorizeScanCallback(req: Request): boolean {
  const secret = env.attachmentScanCallbackSecret;
  if (!secret) return false;
  const header = String(req.headers['x-attachment-scan-secret'] || '').trim();
  return header === secret;
}

router.post('/attachment-scan-result', async (req: Request, res: Response) => {
  if (!authorizeScanCallback(req)) {
    return res.status(401).json({ message: 'Não autorizado' });
  }

  const storageKey = String(req.body?.storageKey || '').trim();
  const status = String(req.body?.status || '').trim().toLowerCase();
  const reason = String(req.body?.reason || '').trim() || undefined;

  if (!storageKey || !['clean', 'infected', 'unscannable'].includes(status)) {
    return res.status(400).json({ message: 'storageKey e status (clean|infected|unscannable) são obrigatórios' });
  }

  try {
    const result = await applyAttachmentScanResult({
      storageKey,
      status: status as 'clean' | 'infected' | 'unscannable',
      reason,
    });
    return res.status(200).json({
      success: true,
      updated: result.updated,
      chamadoProtocolo: result.chamadoProtocolo,
    });
  } catch (err) {
    console.error('[attachment-scan-result]', err);
    return res.status(500).json({ message: 'Falha ao registrar resultado do scan' });
  }
});

export default router;
