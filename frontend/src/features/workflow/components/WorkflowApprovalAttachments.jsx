/**
 * WorkflowApprovalAttachments v1.0.0 — galeria de anexos Erros/Bugs no card Produtos
 * VERSION: v1.0.0 | DATE: 2026-07-23
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveAttachmentPreviewUrl } from '../../../services/cadastral/cadastralAttachmentStore';

function useAttachmentPreviews(attachments) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const imagens = useMemo(
    () => (Array.isArray(attachments?.imagens) ? attachments.imagens : []),
    [attachments?.imagens],
  );
  const videos = useMemo(
    () => (Array.isArray(attachments?.videos) ? attachments.videos : []),
    [attachments?.videos],
  );

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];

    const load = async () => {
      setLoading(true);
      try {
        const imageItems = await Promise.all(
          imagens.map(async (ref) => {
            const url = await resolveAttachmentPreviewUrl(ref);
            if (url?.startsWith('blob:')) objectUrls.push(url);
            return { ...ref, kind: 'image', previewUrl: url };
          }),
        );
        const videoItems = await Promise.all(
          videos.map(async (ref) => {
            const url = await resolveAttachmentPreviewUrl(ref);
            if (url?.startsWith('blob:')) objectUrls.push(url);
            return { ...ref, kind: 'video', previewUrl: url };
          }),
        );
        if (!cancelled) {
          setItems([...imageItems, ...videoItems]);
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (!imagens.length && !videos.length) {
      setItems([]);
      setLoading(false);
      return undefined;
    }

    void load();

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagens, videos]);

  return { items, loading, imagens, videos };
}

export default function WorkflowApprovalAttachments({ attachments }) {
  const { items, loading, imagens, videos } = useAttachmentPreviews(attachments);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const imageItems = useMemo(
    () => items.filter((item) => item.kind === 'image' && item.previewUrl),
    [items],
  );

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  useEffect(() => {
    if (lightboxIndex == null) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowRight') {
        setLightboxIndex((current) => {
          if (current == null || !imageItems.length) return current;
          return (current + 1) % imageItems.length;
        });
      }
      if (event.key === 'ArrowLeft') {
        setLightboxIndex((current) => {
          if (current == null || !imageItems.length) return current;
          return (current - 1 + imageItems.length) % imageItems.length;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, closeLightbox, imageItems.length]);

  if (attachments?.recusouEvidencias && !imagens.length && !videos.length) {
    return (
      <div className="wf-approval-produtos-attachments wf-approval-produtos-attachments--empty">
        <p className="wf-approval-produtos-attachments__notice">
          <i className="ti ti-alert-circle" aria-hidden="true" />
          Cliente recusou enviar evidências.
        </p>
      </div>
    );
  }

  if (!imagens.length && !videos.length) return null;

  return (
    <div className="wf-approval-produtos-attachments">
      <div className="wf-approval-produtos-attachments__head">
        <span className="wf-approval-produtos-attachments__title">
          <i className="ti ti-paperclip" aria-hidden="true" />
          Evidências anexadas
        </span>
        {loading ? (
          <span className="wf-approval-produtos-attachments__loading">Carregando…</span>
        ) : null}
      </div>

      {imageItems.length ? (
        <div className="wf-approval-produtos-attachments__grid" role="list">
          {imageItems.map((item, index) => (
            <button
              key={item.id || `${item.name}-${index}`}
              type="button"
              className="wf-approval-produtos-attachments__thumb"
              role="listitem"
              aria-label={`Abrir imagem ${item.name}`}
              onClick={() => setLightboxIndex(index)}
            >
              <img src={item.previewUrl} alt={item.name || 'Evidência'} />
            </button>
          ))}
        </div>
      ) : null}

      {items.filter((item) => item.kind === 'video').length ? (
        <ul className="wf-approval-produtos-attachments__videos">
          {items.filter((item) => item.kind === 'video').map((item, index) => (
            <li key={item.id || `${item.name}-${index}`} className="wf-approval-produtos-attachments__video">
              {item.previewUrl ? (
                <video controls preload="metadata" src={item.previewUrl} aria-label={item.name} />
              ) : (
                <span className="wf-approval-produtos-attachments__video-name">
                  <i className="ti ti-video" aria-hidden="true" />
                  {item.name}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {lightboxIndex != null && imageItems[lightboxIndex] ? (
        <div
          className="wf-approval-produtos-attachments__lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Visualização de imagem"
          onClick={closeLightbox}
        >
          <button
            type="button"
            className="wf-approval-produtos-attachments__lightbox-close"
            aria-label="Fechar"
            onClick={closeLightbox}
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
          {imageItems.length > 1 ? (
            <>
              <button
                type="button"
                className="wf-approval-produtos-attachments__lightbox-nav wf-approval-produtos-attachments__lightbox-nav--prev"
                aria-label="Imagem anterior"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightboxIndex((current) => (current - 1 + imageItems.length) % imageItems.length);
                }}
              >
                <i className="ti ti-chevron-left" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="wf-approval-produtos-attachments__lightbox-nav wf-approval-produtos-attachments__lightbox-nav--next"
                aria-label="Próxima imagem"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightboxIndex((current) => (current + 1) % imageItems.length);
                }}
              >
                <i className="ti ti-chevron-right" aria-hidden="true" />
              </button>
            </>
          ) : null}
          <img
            src={imageItems[lightboxIndex].previewUrl}
            alt={imageItems[lightboxIndex].name || 'Evidência'}
            className="wf-approval-produtos-attachments__lightbox-img"
            onClick={(event) => event.stopPropagation()}
          />
          <p className="wf-approval-produtos-attachments__lightbox-caption">
            {imageItems[lightboxIndex].name}
          </p>
        </div>
      ) : null}
    </div>
  );
}
