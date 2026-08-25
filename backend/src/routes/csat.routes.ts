/** csat.routes v1.1.0 — registra evento na aba Eventos ao receber a nota */
import { Router, type Request, type Response } from 'express';
import { ChamadoN1 } from '../models/ChamadoN1';
import { currentStatus } from '../services/chamado.mapper';

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

    const comentarioTexto = String(comentario ?? '').trim().slice(0, 1000);
    chamado.csat.nota = notaNum;
    chamado.csat.comentario = comentarioTexto;
    chamado.csat.respondido = true;
    chamado.csat.respondidoEm = new Date();

    // Evento na aba "Eventos" do ticket — mesmo padrão do "E-mail CSAT enviado:
    // ...", só leitura/anotação interna. Mantém o status atual (não altera o
    // andamento do chamado).
    if (!chamado.registro) chamado.registro = [];
    chamado.registro.push({
      data: new Date(),
      origin: 'sistema',
      autor: 'Pesquisa de satisfação',
      mensagemPublica: '',
      anexosMensagemPublica: [],
      anotacaoInterna: comentarioTexto
        ? `Avaliação CSAT recebida: nota ${notaNum}/5 — "${comentarioTexto}"`
        : `Avaliação CSAT recebida: nota ${notaNum}/5`,
      anexosAnotacaoInterna: [],
      alteracoes: [],
      metadados: { csatNota: notaNum, csatComentario: comentarioTexto },
      status: currentStatus(chamado),
    });

    await chamado.save();

    return res.json({ ok: true });
  } catch (err) {
    console.error('[csat] erro ao registrar nota:', (err as Error).message);
    return res.status(500).json({ message: 'Erro interno.' });
  }
});

export default router;
