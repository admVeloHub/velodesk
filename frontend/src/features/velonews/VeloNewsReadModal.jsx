/**
 * VeloNewsReadModal v1.0.0 — leitura de notícia não crítica
 * VERSION: v1.0.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatResponseText } from '../../utils/velonews/textFormatter';
import { processContentHtml } from '../../utils/velonews/processContentHtml';
import { getAllImages } from '../../utils/velonews/mediaContentHelpers';
import { formatVeloNewsTime } from './veloNewsHelpers';
import { useVeloNews } from './VeloNewsProvider';

export default function VeloNewsReadModal() {
  const { readModalNews, closeReadModal } = useVeloNews();

  useEffect(() => {
    if (!readModalNews) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeReadModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [readModalNews, closeReadModal]);

  if (!readModalNews) return null;

  const html = processContentHtml(
    formatResponseText(readModalNews.content || '', 'velonews'),
    readModalNews?.media?.images || []
  );
  const images = getAllImages(readModalNews);

  return createPortal(
    <>
      <button type="button" className="velonews-read-modal__backdrop" aria-label="Fechar" onClick={closeReadModal} />
      <div className="velonews-read-modal" role="dialog" aria-modal="true" aria-labelledby="velonewsReadTitle">
        <header className="velonews-read-modal__header">
          <div>
            {readModalNews.solved ? <span className="solved-badge">Resolvido</span> : null}
            {readModalNews.is_critical === 'Y' ? (
              <span className="velonews-read-modal__badge-critical">Crítica</span>
            ) : null}
            <time>{formatVeloNewsTime(readModalNews.createdAt)}</time>
          </div>
          <button type="button" className="velonews-read-modal__close" onClick={closeReadModal} aria-label="Fechar">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>
        <h2 id="velonewsReadTitle">{readModalNews.title}</h2>
        <div className="velonews-read-modal__content">
          {images.map((url, idx) => (
            <img key={idx} src={url} alt="" className="velonews-read-modal__image" />
          ))}
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <footer className="velonews-read-modal__footer">
          <button type="button" className="ws360-btn ws360-btn--primary" onClick={closeReadModal}>
            Entendi
          </button>
        </footer>
      </div>
    </>,
    document.body
  );
}
