/**
 * PopViewer v1.0.0 — exibição estruturada de um POP (.docx) dentro do quadro de Processos
 * VERSION: v1.0.0 | DATE: 2026-08-14 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadPopImageObjectUrl } from '../../../services/desk/processosCatalog';

/** Seções de referência (menos usadas no dia a dia) ficam recolhidas por padrão. */
const COLLAPSED_BY_DEFAULT = new Set([
  'gestao-de-riscos-e-desvios',
  'documentos-e-registros-relacionados',
  'referencias-normativas',
  'historico-de-revisoes',
]);

function FluxogramaImage({ produtoSlug, popId, image }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [error, setError] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let currentUrl = null;
    setObjectUrl(null);
    setError(false);

    loadPopImageObjectUrl(produtoSlug, popId, image.id)
      .then((url) => {
        if (cancelled) { URL.revokeObjectURL(url); return; }
        currentUrl = url;
        setObjectUrl(url);
      })
      .catch(() => { if (!cancelled) setError(true); });

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [produtoSlug, popId, image.id]);

  if (error) return null;

  return (
    <div className="ia-processos-drawer__fluxograma">
      {objectUrl ? (
        <>
          <button
            type="button"
            className="ia-processos-drawer__fluxograma-trigger"
            onClick={() => setZoomed(true)}
            aria-label="Ampliar fluxograma"
          >
            <img src={objectUrl} alt="Fluxograma do procedimento" />
            <span className="ia-processos-drawer__fluxograma-hint">
              <i className="ti ti-zoom-in" />
              {' '}
              Ampliar
            </span>
          </button>
          {zoomed ? createPortal(
            <div
              className="ia-processos-drawer__lightbox"
              role="dialog"
              aria-modal="true"
              onClick={() => setZoomed(false)}
            >
              <img src={objectUrl} alt="Fluxograma do procedimento (ampliado)" />
              <button
                type="button"
                className="ia-processos-drawer__lightbox-close"
                onClick={() => setZoomed(false)}
                aria-label="Fechar"
              >
                <i className="ti ti-x" />
              </button>
            </div>,
            document.body,
          ) : null}
        </>
      ) : (
        <div className="ia-processos-drawer__fluxograma-loading">Carregando fluxograma…</div>
      )}
    </div>
  );
}

function SectionTable({ table }) {
  return (
    <div className="ia-processos-drawer__table-wrap">
      <table className="ia-processos-drawer__table">
        <thead>
          <tr>
            {table.headers.map((h, i) => <th key={i}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => <td key={j}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionBlocks({ blocks }) {
  return blocks.map((block, i) => {
    if (block.type === 'list') {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag key={i} className="ia-processos-drawer__list">
          {block.items.map((item, j) => <li key={j}>{item}</li>)}
        </Tag>
      );
    }
    return <p key={i} className="ia-processos-drawer__text">{block.text}</p>;
  });
}

function Section({ section }) {
  const collapsedByDefault = COLLAPSED_BY_DEFAULT.has(section.id);
  return (
    <details className="ia-processos-drawer__section" open={!collapsedByDefault}>
      <summary className="ia-processos-drawer__section-title">
        <span className="ia-processos-drawer__section-numero">{section.numero}</span>
        {section.titulo}
        <i className="ti ti-chevron-down ia-processos-drawer__section-chevron" />
      </summary>
      <div className="ia-processos-drawer__section-body">
        {section.table ? <SectionTable table={section.table} /> : <SectionBlocks blocks={section.blocks} />}
      </div>
    </details>
  );
}

export default function PopViewer({ produtoSlug, popId, detail }) {
  const fluxograma = useMemo(
    () => detail.images.find((img) => img.role === 'fluxograma'),
    [detail.images],
  );

  return (
    <div className="ia-processos-drawer__pop">
      <div className="ia-processos-drawer__pop-header">
        {detail.codigo ? <span className="ia-processos-drawer__tag">{detail.codigo}</span> : null}
        <h4 className="ia-processos-drawer__pop-title">
          {detail.titulo}
          {detail.subtitulo ? <span> — {detail.subtitulo}</span> : null}
        </h4>
        <dl className="ia-processos-drawer__meta">
          {detail.revisao ? (
            <div><dt>Revisão</dt><dd>{detail.revisao}</dd></div>
          ) : null}
          {detail.vigencia ? (
            <div><dt>Vigência</dt><dd>{detail.vigencia}</dd></div>
          ) : null}
          {detail.campos.map((campo) => (
            <div key={campo.label}><dt>{campo.label}</dt><dd>{campo.valor}</dd></div>
          ))}
        </dl>
      </div>

      {fluxograma ? (
        <FluxogramaImage produtoSlug={produtoSlug} popId={popId} image={fluxograma} />
      ) : null}

      <div className="ia-processos-drawer__sections">
        {detail.sections.map((section) => <Section key={section.id} section={section} />)}
      </div>
    </div>
  );
}
