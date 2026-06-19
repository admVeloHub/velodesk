/**
 * Workspace360NewsModal v1.0.0 — modal com notícia completa
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Workspace360NewsModal({ open, article, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !article) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="ws360-news-modal__backdrop"
        aria-label="Fechar notícia"
        onClick={onClose}
      />
      <div
        className="ws360-news-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws360NewsModalTitle"
      >
        <header className="ws360-news-modal__header">
          <div className="ws360-news-modal__meta">
            <span className="ws360-news-modal__category">{article.category}</span>
            <time className="ws360-news-modal__time">{article.time}</time>
          </div>
          <h2 className="ws360-news-modal__title" id="ws360NewsModalTitle">
            {article.title}
          </h2>
          <button
            type="button"
            className="ws360-news-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>
        <div className="ws360-news-modal__body">
          {article.body.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
        <footer className="ws360-news-modal__footer">
          <button type="button" className="ws360-btn ws360-btn--primary" onClick={onClose}>
            Entendi
          </button>
        </footer>
      </div>
    </>,
    document.body
  );
}
