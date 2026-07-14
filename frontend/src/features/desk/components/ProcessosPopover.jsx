/**
 * ProcessosPopover v1.2.0 — drawer POP via portal (à esquerda do painel direito)
 * VERSION: v1.2.0 | DATE: 2026-07-10 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTabulation } from '../../../context/TabulationContext';
import { getDetalheOptionsForProduto, getProcessoInfo } from '../../../services/desk/processDefinitions';

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

function InfoSection({ title, children }) {
  if (!children) return null;
  return (
    <section className="ia-processos-drawer__section">
      <h4 className="ia-processos-drawer__section-title">{title}</h4>
      {children}
    </section>
  );
}

function BulletList({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="ia-processos-drawer__list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function ProcessosPopover({ open, onClose }) {
  const { config, getProdutoNames } = useTabulation();
  const drawerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [produto, setProduto] = useState('');
  const [detalheId, setDetalheId] = useState('');

  const layout = useProcessosDrawerPosition(open);

  const produtoOptions = getProdutoNames();
  const detalheOptions = useMemo(
    () => getDetalheOptionsForProduto(config, produto),
    [config, produto],
  );

  const selectedDetalhe = detalheOptions.find((item) => item.id === detalheId) || null;
  const processoInfo = useMemo(
    () => (produto && selectedDetalhe ? getProcessoInfo(produto, selectedDetalhe) : null),
    [produto, selectedDetalhe],
  );

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setProduto('');
      setDetalheId('');
      return undefined;
    }

    const raf = requestAnimationFrame(() => setVisible(true));

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !layout) return null;

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
          <span className="ia-processos-drawer__eyebrow">Consulta operacional</span>
          <h3 className="ia-processos-drawer__title" id="processosDrawerTitle">Processos (POP)</h3>
        </div>

        <div className="ia-processos-drawer__fields ia-processos-drawer__fields--grid">
          <div className="ia-processos-drawer__field">
            <label className="ia-processos-drawer__label" htmlFor="processosSelProduto">Produto</label>
            <select
              id="processosSelProduto"
              className="ia-processos-drawer__select"
              value={produto}
              onChange={(e) => {
                setProduto(e.target.value);
                setDetalheId('');
              }}
            >
              <option value="">Selecionar produto</option>
              {produtoOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="ia-processos-drawer__field">
            <label className="ia-processos-drawer__label" htmlFor="processosSelDetalhe">Detalhe</label>
            <select
              id="processosSelDetalhe"
              className="ia-processos-drawer__select"
              value={detalheId}
              disabled={!produto || detalheOptions.length === 0}
              onChange={(e) => setDetalheId(e.target.value)}
            >
              <option value="">
                {!produto
                  ? 'Selecione um produto primeiro'
                  : detalheOptions.length === 0
                    ? 'Nenhum detalhe cadastrado'
                    : 'Selecionar detalhe'}
              </option>
              {detalheOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="ia-processos-drawer__body">
          {processoInfo ? (
            <>
              <div className="ia-processos-drawer__result">
                <div className="ia-processos-drawer__result-title">{processoInfo.title}</div>
                <p className="ia-processos-drawer__resumo">{processoInfo.resumo}</p>

                <dl className="ia-processos-drawer__meta">
                  <div>
                    <dt>Produto</dt>
                    <dd>{processoInfo.produto}</dd>
                  </div>
                  <div>
                    <dt>Motivo</dt>
                    <dd>{processoInfo.motivo || '—'}</dd>
                  </div>
                  <div>
                    <dt>Detalhe</dt>
                    <dd>{processoInfo.detalhe || '—'}</dd>
                  </div>
                  <div>
                    <dt>Tipo de chamado</dt>
                    <dd>{processoInfo.tipo}</dd>
                  </div>
                  <div>
                    <dt>SLA</dt>
                    <dd>{processoInfo.sla}</dd>
                  </div>
                  <div>
                    <dt>Responsável</dt>
                    <dd>{processoInfo.responsavel}</dd>
                  </div>
                  {processoInfo.workflow ? (
                    <div className="ia-processos-drawer__meta-span">
                      <dt>Workflow vinculado</dt>
                      <dd>{processoInfo.workflow}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <InfoSection title="Sobre o produto">
                <p className="ia-processos-drawer__text">{processoInfo.produtoDescricao}</p>
                {processoInfo.publicoAlvo ? (
                  <p className="ia-processos-drawer__text">
                    <strong>Público:</strong>
                    {' '}
                    {processoInfo.publicoAlvo}
                  </p>
                ) : null}
                {processoInfo.canaisAtendimento?.length ? (
                  <p className="ia-processos-drawer__tags">
                    {processoInfo.canaisAtendimento.map((canal) => (
                      <span key={canal} className="ia-processos-drawer__tag">{canal}</span>
                    ))}
                  </p>
                ) : null}
              </InfoSection>

              {processoInfo.sobreDetalhe ? (
                <InfoSection title="Sobre o detalhe selecionado">
                  <p className="ia-processos-drawer__text">{processoInfo.sobreDetalhe}</p>
                </InfoSection>
              ) : null}

              <InfoSection title="Elegibilidade">
                <BulletList items={processoInfo.elegibilidade} />
              </InfoSection>

              <InfoSection title="Documentos necessários">
                <BulletList items={processoInfo.documentos} />
              </InfoSection>

              <InfoSection title="Procedimento — passo a passo">
                <ol className="ia-processos-drawer__steps">
                  {processoInfo.passos?.map((passo) => (
                    <li key={passo}>{passo}</li>
                  ))}
                </ol>
              </InfoSection>

              {processoInfo.workflowEtapas?.length ? (
                <InfoSection title="Etapas do workflow">
                  <BulletList items={processoInfo.workflowEtapas} />
                </InfoSection>
              ) : null}

              {processoInfo.comunicacaoCliente ? (
                <InfoSection title="Comunicação ao cliente">
                  <p className="ia-processos-drawer__text">{processoInfo.comunicacaoCliente}</p>
                </InfoSection>
              ) : null}

              {processoInfo.restricoes?.length ? (
                <InfoSection title="Restrições">
                  <BulletList items={processoInfo.restricoes} />
                </InfoSection>
              ) : null}

              {processoInfo.observacoes ? (
                <p className="ia-processos-drawer__obs">
                  <strong>Observação interna:</strong>
                  {' '}
                  {processoInfo.observacoes}
                </p>
              ) : null}
            </>
          ) : (
            <p className="ia-processos-drawer__hint">
              Escolha o produto e o detalhe para visualizar o procedimento operacional completo.
            </p>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
