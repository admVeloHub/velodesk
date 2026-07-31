/**
 * VeloNewsCriticalModal v1.1.0 — modal crítico (paridade VeloHub — Ciente + Fechar)
 * VERSION: v1.1.0 | DATE: 2026-07-31 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatResponseText } from '../../utils/velonews/textFormatter';
import { processContentHtml } from '../../utils/velonews/processContentHtml';
import { getAllImages } from '../../utils/velonews/mediaContentHelpers';
import { CriticalModalManager } from './criticalModalManager';
import VelonewsCommentThread from './VelonewsCommentThread';
import { useVeloNews } from './VeloNewsProvider';

export default function VeloNewsCriticalModal() {
  const {
    criticalModalNews,
    closeCriticalModal,
    handleAcknowledge,
  } = useVeloNews();

  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [currentNews, setCurrentNews] = useState(null);
  const [expandedImage, setExpandedImage] = useState(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    setCurrentNews(criticalModalNews);
    setIsAcknowledged(false);
    setShowComments(false);
    setClosing(false);
  }, [criticalModalNews]);

  if (!criticalModalNews || !currentNews) return null;

  const shouldShowRemindButton = CriticalModalManager.shouldShowRemindButton();

  const handleClose = async () => {
    if (closing) return;
    setClosing(true);
    let acknowledged = false;
    try {
      if (isAcknowledged) {
        CriticalModalManager.setAcknowledged(criticalModalNews.title);
        if (criticalModalNews._id) {
          acknowledged = await handleAcknowledge(criticalModalNews._id);
        }
      }
    } catch (err) {
      console.error('Erro ao enviar confirmação de ciência:', err);
    } finally {
      closeCriticalModal(acknowledged ? { suppressBubbleRestore: true } : undefined);
      setClosing(false);
    }
  };

  const handleRemindLater = () => {
    CriticalModalManager.setRemindLater();
    closeCriticalModal();
  };

  const allImages = getAllImages(currentNews);
  const html = processContentHtml(
    formatResponseText(currentNews.content || '', 'velonews'),
    currentNews?.media?.images || []
  );

  return createPortal(
    <>
      <div className="velonews-critical-modal__backdrop" onClick={closeCriticalModal} aria-hidden="true" />
      <div
        className={'velonews-critical-modal' + (showComments ? ' velonews-critical-modal--with-comments' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="velonewsCriticalTitle"
      >
        <div className="velonews-critical-modal__main">
          <header className="velonews-critical-modal__header">
            <h2 id="velonewsCriticalTitle">{currentNews.title}</h2>
            <button
              type="button"
              className="velonews-critical-modal__comments-toggle"
              onClick={() => setShowComments((v) => !v)}
            >
              {showComments ? 'Ocultar comentários' : 'Comentários'}
            </button>
          </header>
          <div className="velonews-critical-modal__content">
            {allImages.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                className="velonews-critical-modal__image-btn"
                onClick={() => setExpandedImage(imgUrl)}
              >
                <img src={imgUrl} alt="" />
              </button>
            ))}
            <div
              className="velonews-critical-modal__body"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
          <footer className="velonews-critical-modal__footer">
            <button
              type="button"
              className="velonews-critical-modal__close-btn"
              disabled={!isAcknowledged || closing}
              onClick={handleClose}
            >
              {closing ? 'Registrando…' : 'Fechar'}
            </button>
            <div className="velonews-critical-modal__ack">
              <div className="velonews-critical-modal__ack-row">
                <input
                  id="velonews-acknowledge"
                  type="checkbox"
                  checked={isAcknowledged}
                  onChange={() => setIsAcknowledged((v) => !v)}
                />
                <label htmlFor="velonews-acknowledge">Ciente</label>
              </div>
              {shouldShowRemindButton ? (
                <button type="button" className="velonews-critical-modal__remind" onClick={handleRemindLater}>
                  Me lembre mais tarde
                </button>
              ) : null}
            </div>
          </footer>
        </div>
        {showComments ? (
          <VelonewsCommentThread
            newsId={currentNews._id}
            thread={currentNews.thread || []}
            onCommentAdded={(updatedThread) => {
              setCurrentNews((prev) => ({ ...prev, thread: updatedThread }));
            }}
          />
        ) : null}
      </div>
      {expandedImage ? (
        <div className="velonews-critical-modal__lightbox" onClick={() => setExpandedImage(null)}>
          <button type="button" className="velonews-critical-modal__lightbox-close" aria-label="Fechar">
            &times;
          </button>
          <img src={expandedImage} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      ) : null}
    </>,
    document.body
  );
}
