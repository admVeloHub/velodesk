/** csat.routes v1.0.0 — endpoint público de recebimento de nota CSAT */
import { Router, type Request, type Response } from 'express';
import { ChamadoN1 } from '../models/ChamadoN1';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { protocolo, nota, comentario } = req.body ?? {};

    const notaNum = Number(nota);
    if (!Number.isInteger(notaNum) || notaNum < 1 || notaNum > 5) {
      return res.status(400).json({ message: 'Nota inválida (esperado inteiro de 1 a 5).' });
    }

    const proto = String(protocolo ?? '').trim();
    if (!proto) {
      return res.status(400).json({ message: 'Protocolo obrigatório.' });
    }

    const chamado = await ChamadoN1.findOne({ chamadoProtocolo: proto });
    if (!chamado || !chamado.csat?.enviado) {
      return res.status(404).json({ message: 'Avaliação não encontrada.' });
    }

    // Idempotente: se já respondeu, não sobrescreve
    if (chamado.csat.respondido) {
      return res.json({ ok: true });
    }

    chamado.csat.nota = notaNum;
    chamado.csat.comentario = String(comentario ?? '').trim().slice(0, 1000);
    chamado.csat.respondido = true;
    chamado.csat.respondidoEm = new Date();
    await chamado.save();

    return res.json({ ok: true });
  } catch (err) {
    console.error('[csat] erro ao registrar nota:', (err as Error).message);
    return res.status(500).json({ message: 'Erro interno.' });
  }
});

export default router;
