/**
 * ProcessosPopover v2.4.0 — resumo estruturado (POPs); PDF só no botão Ver Pop Completo
 * VERSION: v2.4.0 | DATE: 2026-08-19
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchPop,
  fetchPops,
  fetchProdutos,
  matchTabulacaoMotivoToPopItem,
  matchTabulacaoProdutoToPop,
  openPopCompletoInNewTab,
} from '../../../services/desk/processosCatalog';
import PopViewer from './PopViewer';

const RIGHT_PANEL_ID = 'crmRightPanel';
const DRAWER_MAX_WIDTH = 480;
const DRAWER_MIN_WIDTH = 300;
const DRAWER_GAP = 16;

function useProcessosDrawerPosition(open) {
  const [layout, setLayout] = useState(null);

  useEffect(() => {
    if (!open) {
      setLayout(null);
      return undefined;
    }

    const update = () => {
      const panel = document.getElementById(RIGHT_PANEL_ID);
      if (!panel) return;

      const panelRect = panel.getBoundingClientRect();
      const sidebar = document.querySelector('.velo-nav-rail, .sidebar, #velodeskSidebar, .ws360-sidebar');
      const sidebarRight = sidebar instanceof Element
        ? sidebar.getBoundingClientRect().right
        : 56;

      const availableWidth = panelRect.left - sidebarRight - DRAWER_GAP;
      const width = Math.min(
        DRAWER_MAX_WIDTH,
        Math.max(DRAWER_MIN_WIDTH, availableWidth),
      );

      setLayout({
        panel: {
          position: 'fixed',
          top: `${panelRect.top}px`,
          height: `${panelRect.height}px`,
          right: `${window.innerWidth - panelRect.left}px`,
          width: `${width}px`,
        },
        backdrop: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: `${window.innerWidth - panelRect.left}px`,
          bottom: 0,
        },
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  return layout;
}

export default function ProcessosPopover({
  open,
  onClose,
  tabulacaoProduto,
  tabulacaoMotivo = '',
}) {
  const drawerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [produtoSlug, setProdutoSlug] = useState('');
  const [produtoAutoMatched, setProdutoAutoMatched] = useState(false);
  const [pops, setPops] = useState([]);
  const [popId, setPopId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loadingPops, setLoadingPops] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [openingCompleto, setOpeningCompleto] = useState(false);
  const [error, setError] = useState('');

  const layout = useProcessosDrawerPosition(open);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setProdutoSlug('');
      setProdutoAutoMatched(false);
      setPopId('');
      setPops([]);
      setDetail(null);
      setError('');
      return undefined;
    }

    const raf = requestAnimationFrame(() => setVisible(true));

    fetchProdutos()
      .then((lista) => {
        setProdutos(lista);
        const match = matchTabulacaoProdutoToPop(tabulacaoProduto, lista);
        if (match) {
          setProdutoSlug(match.slug);
          setProdutoAutoMatched(true);
        }
      })
      .catch(() => setError('Não foi possível carregar os produtos.'));

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, tabulacaoProduto]);

  useEffect(() => {
    setPopId('');
    setDetail(null);
    if (!produtoSlug) { setPops([]); return; }

    setLoadingPops(true);
    setError('');
    fetchPops(produtoSlug)
      .then(setPops)
      .catch(() => setError('Não foi possível carregar os POPs deste produto.'))
      .finally(() => setLoadingPops(false));
  }, [produtoSlug]);

  useEffect(() => {
    if (!produtoSlug || !pops.length || !String(tabulacaoMotivo || '').trim()) return undefined;
    const match = matchTabulacaoMotivoToPopItem(tabulacaoMotivo, pops);
    if (match) setPopId(match.id);
    return undefined;
  }, [produtoSlug, pops, tabulacaoMotivo]);

  useEffect(() => {
    setDetail(null);
    if (!produtoSlug || !popId) return;

    setLoadingDetail(true);
    setError('');
    fetchPop(produtoSlug, popId)
      .then(setDetail)
      .catch(() => setError('Não foi possível carregar o conteúdo do POP.'))
      .finally(() => setLoadingDetail(false));
  }, [produtoSlug, popId]);

  const handleVerPopCompleto = useCallback(async () => {
    if (!produtoSlug || !popId || openingCompleto) return;
    setOpeningCompleto(true);
    setError('');
    try {
      await openPopCompletoInNewTab(produtoSlug, popId);
    } catch (err) {
      setError(err?.message || 'Não foi possível abrir o POP completo.');
    } finally {
      setOpeningCompleto(false);
    }
  }, [produtoSlug, popId, openingCompleto]);

  if (!open || !layout) return null;

  const selectedPop = pops.find((pop) => pop.id === popId);

  return createPortal(
    <div className="ia-processos-drawer" id="processosDrawer">
      <button
        type="button"
        className={'ia-processos-drawer__backdrop' + (visible ? ' is-visible' : '')}
        style={layout.backdrop}
        aria-label="Fechar consulta de processos"
        onClick={onClose}
      />

      <aside
        ref={drawerRef}
        className={'ia-processos-drawer__panel' + (visible ? ' is-visible' : '')}
        style={layout.panel}
        role="dialog"
        aria-labelledby="processosDrawerTitle"
        aria-modal="true"
      >
        <button
          type="button"
          className="ia-processos-drawer__close"
          onClick={onClose}
          aria-label="Fechar"
        >
          <i className="ti ti-x" />
        </button>

        <div className="ia-processos-drawer__header">
          <h3 className="ia-processos-drawer__title" id="processosDrawerTitle">Consulta Operacional</h3>
        </div>

        <div className="ia-processos-drawer__fields ia-processos-drawer__fields--grid">
          {produtoAutoMatched ? (
            <div className="ia-processos-drawer__field ia-processos-drawer__field--produto-locked">
              <label className="ia-processos-drawer__label">Produto</label>
              <div className="ia-processos-drawer__produto-locked">
                <span>{produtos.find((p) => p.slug === produtoSlug)?.label}</span>
                <button
                  type="button"
                  className="ia-processos-drawer__produto-trocar"
                  onClick={() => setProdutoAutoMatched(false)}
                >
                  trocar
                </button>
              </div>
            </div>
          ) : (
            <div className="ia-processos-drawer__field">
              <label className="ia-processos-drawer__label" htmlFor="processosSelProduto">Produto</label>
              <select
                id="processosSelProduto"
                className="ia-processos-drawer__select"
                value={produtoSlug}
                onChange={(e) => setProdutoSlug(e.target.value)}
              >
                <option value="">Selecionar produto</option>
                {produtos.map((p) => (
                  <option key={p.slug} value={p.slug}>{p.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="ia-processos-drawer__field">
            <label className="ia-processos-drawer__label" htmlFor="processosSelPop">POP</label>
            <select
              id="processosSelPop"
              className="ia-processos-drawer__select"
              value={popId}
              disabled={!produtoSlug || loadingPops || pops.length === 0}
              onChange={(e) => setPopId(e.target.value)}
            >
              <option value="">
                {!produtoSlug
                  ? 'Selecione um produto primeiro'
                  : loadingPops
                    ? 'Carregando…'
                    : pops.length === 0
                      ? 'Nenhum POP cadastrado'
                      : 'Selecionar POP'}
              </option>
              {pops.map((pop) => (
                <option key={pop.id} value={pop.id}>{pop.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="ia-processos-drawer__body">
          {error ? <p className="ia-processos-drawer__hint ia-processos-drawer__hint--error">{error}</p> : null}
          {!error && loadingDetail ? <p className="ia-processos-drawer__hint">Carregando POP…</p> : null}
          {!error && !loadingDetail && detail ? (
            <>
              <PopViewer
                produtoSlug={produtoSlug}
                popId={popId}
                detail={{
                  ...detail,
                  titulo: detail.titulo || selectedPop?.label || '',
                }}
              />
              {detail.completoDisponivel ? (
                <div className="ia-processos-drawer__content-footer">
                  <button
                    type="button"
                    className="ia-processos-drawer__completo-btn"
                    disabled={openingCompleto}
                    onClick={handleVerPopCompleto}
                  >
                    <i className="ti ti-external-link" aria-hidden="true" />
                    {openingCompleto ? 'Abrindo…' : 'Ver Pop Completo'}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
          {!error && !loadingDetail && !detail && !popId ? (
            <p className="ia-processos-drawer__hint">
              Escolha o produto e o POP para visualizar o procedimento operacional completo.
            </p>
          ) : null}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
