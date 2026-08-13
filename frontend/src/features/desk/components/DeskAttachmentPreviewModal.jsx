/**
 * DeskAttachmentPreviewModal v1.0.0 — preview no Desk (imagem, áudio, vídeo, PDF)
 * VERSION: v1.0.0 | DATE: 2026-08-13
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { attachmentKindIcon, downloadObjectUrl } from '../../../services/desk/attachmentPreview';

const OFFICE_HINT = 'Este arquivo do Office não pode ser visualizado com segurança no Desk. Baixe apenas se precisar editar ou conferir o conteúdo.';

export default function DeskAttachmentPreviewModal({
  open,
  kind,
  objectUrl,
  filename,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !objectUrl) return null;

  const title = filename || 'Anexo';
  const icon = attachmentKindIcon(kind);

  const handleDownload = () => {
    downloadObjectUrl(objectUrl, title);
  };

  return createPortal(
    <>
      <button
        type="button"
        className="desk-attachment-preview__backdrop"
        aria-label="Fechar visualização do anexo"
        onClick={onClose}
      />
      <div
        className={`desk-attachment-preview desk-attachment-preview--${kind || 'other'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deskAttachmentPreviewTitle"
      >
        <header className="desk-attachment-preview__head">
          <span className="desk-attachment-preview__icon" aria-hidden="true">
            <i className={`ti ${icon}`} />
          </span>
          <h2 className="desk-attachment-preview__title" id="deskAttachmentPreviewTitle">
            {title}
          </h2>
          <button
            type="button"
            className="desk-attachment-preview__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>
        <div className="desk-attachment-preview__stage">
          {kind === 'image' ? (
            <img className="desk-attachment-preview__img" src={objectUrl} alt={title} />
          ) : null}
          {kind === 'audio' ? (
            <audio className="desk-attachment-preview__audio" controls preload="metadata" src={objectUrl}>
              Seu navegador não conseguiu reproduzir este áudio.
            </audio>
          ) : null}
          {kind === 'video' ? (
            <video className="desk-attachment-preview__video" controls preload="metadata" src={objectUrl}>
              Seu navegador não conseguiu reproduzir este vídeo.
            </video>
          ) : null}
          {kind === 'pdf' ? (
            <iframe
              className="desk-attachment-preview__pdf"
              src={objectUrl}
              title={title}
            />
          ) : null}
          {kind === 'office' ? (
            <div className="desk-attachment-preview__office">
              <i className="ti ti-alert-triangle" aria-hidden="true" />
              <p>{OFFICE_HINT}</p>
            </div>
          ) : null}
        </div>
        <footer className="desk-attachment-preview__footer">
          <button
            type="button"
            className="desk-attachment-preview__btn desk-attachment-preview__btn--ghost"
            onClick={onClose}
          >
            Fechar
          </button>
          <button
            type="button"
            className="desk-attachment-preview__btn desk-attachment-preview__btn--primary"
            onClick={handleDownload}
          >
            <i className="ti ti-download" aria-hidden="true" />
            Baixar
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
