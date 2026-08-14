/** processos.routes v1.0.0 — catálogo de POPs (.docx) por produto, para o quadro de Processos */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getPop, getPopImage, listPops, listProdutos } from '../services/processos/popCatalog.service';

const router = Router();

router.get('/produtos', authMiddleware, (_req: Request, res: Response) => {
  try {
    res.json(listProdutos());
  } catch (err) {
    console.error('[processos] GET /produtos:', err);
    res.status(500).json({ message: 'Não foi possível listar os produtos.' });
  }
});

router.get('/produtos/:produto/pops', authMiddleware, async (req: Request, res: Response) => {
  try {
    const pops = await listPops(String(req.params.produto));
    res.json(pops);
  } catch (err) {
    console.error('[processos] GET /produtos/:produto/pops:', err);
    res.status(500).json({ message: 'Não foi possível listar os POPs do produto.' });
  }
});

router.get('/produtos/:produto/pops/:pop', authMiddleware, async (req: Request, res: Response) => {
  try {
    const detail = await getPop(String(req.params.produto), String(req.params.pop));
    if (!detail) return res.status(404).json({ message: 'POP não encontrado.' });
    res.json(detail);
  } catch (err) {
    console.error('[processos] GET /produtos/:produto/pops/:pop:', err);
    res.status(500).json({ message: 'Não foi possível carregar o POP.' });
  }
});

router.get(
  '/produtos/:produto/pops/:pop/imagens/:imagem',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const image = await getPopImage(
        String(req.params.produto),
        String(req.params.pop),
        String(req.params.imagem),
      );
      if (!image) return res.status(404).end();
      res.set('Content-Type', image.contentType);
      res.set('Cache-Control', 'private, max-age=86400, immutable');
      res.send(image.buffer);
    } catch (err) {
      console.error('[processos] GET .../imagens/:imagem:', err);
      res.status(500).end();
    }
  },
);

export default router;
