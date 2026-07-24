/**
 * ProdSolicAttachments v1.1.0 — miniaturas + file ref para IndexedDB
 * VERSION: v1.1.0 | DATE: 2026-07-23
 */
import React, { useRef } from 'react';
import { toAttachmentMetadata } from '../../../services/cadastral/cadastralRequestStore';
import {
  MAX_ATTACHMENT_IMAGES,
  MAX_ATTACHMENT_VIDEOS,
  validateAttachmentFile,
} from '../../../services/cadastral/cadastralAttachmentStore';

function createAttachmentEntry(file) {
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...toAttachmentMetadata(file),
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

export default function ProdSolicAttachments({
  imagens = [],
  videos = [],
  recusouEvidencias = false,
  onChange,
  showNotification,
}) {
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const attachmentsDisabled = recusouEvidencias;

  const emit = (next) => {
    onChange?.({
      imagens: next.imagens ?? imagens,
      videos: next.videos ?? videos,
      recusouEvidencias: next.recusouEvidencias ?? recusouEvidencias,
    });
  };

  const notify = (message) => {
    if (showNotification) showNotification(message, 'warning');
  };

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const remaining = MAX_ATTACHMENT_IMAGES - imagens.length;
    if (remaining <= 0) {
      notify(`Máximo de ${MAX_ATTACHMENT_IMAGES} imagens.`);
      event.target.value = '';
      return;
    }

    const accepted = [];
    files.slice(0, remaining).forEach((file) => {
      const err = validateAttachmentFile(file, { isVideo: false });
      if (err) {
        notify(err);
        return;
      }
      accepted.push(createAttachmentEntry(file));
    });

    if (files.length > remaining) {
      notify(`Somente ${remaining} imagem(ns) adicionada(s) (limite ${MAX_ATTACHMENT_IMAGES}).`);
    }

    if (accepted.length) emit({ imagens: [...imagens, ...accepted] });
    event.target.value = '';
  };

  const handleVideoSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const remaining = MAX_ATTACHMENT_VIDEOS - videos.length;
    if (remaining <= 0) {
      notify(`Máximo de ${MAX_ATTACHMENT_VIDEOS} vídeos.`);
      event.target.value = '';
      return;
    }

    const accepted = [];
    files.slice(0, remaining).forEach((file) => {
      const err = validateAttachmentFile(file, { isVideo: true });
      if (err) {
        notify(err);
        return;
      }
      accepted.push(createAttachmentEntry(file));
    });

    if (files.length > remaining) {
      notify(`Somente ${remaining} vídeo(s) adicionado(s) (limite ${MAX_ATTACHMENT_VIDEOS}).`);
    }

    if (accepted.length) emit({ videos: [...videos, ...accepted] });
    event.target.value = '';
  };

  const removeImage = (id) => {
    const removed = imagens.find((f) => f.id === id);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    emit({ imagens: imagens.filter((f) => f.id !== id) });
  };

  const removeVideo = (id) => {
    const removed = videos.find((f) => f.id === id);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    emit({ videos: videos.filter((f) => f.id !== id) });
  };

  const toggleRecusa = () => {
    const nextRecusa = !recusouEvidencias;
    if (nextRecusa) {
      imagens.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
      videos.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
      emit({ recusouEvidencias: true, imagens: [], videos: [] });
      return;
    }
    emit({ recusouEvidencias: false });
  };

  const hasFiles = imagens.length > 0 || videos.length > 0;

  return (
    <div className="prod-solic-attachments">
      <span className="prod-solic-form__label prod-solic-attachments__label">Anexos</span>

      <div className="prod-solic-attachments__toolbar">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="prod-solic-attachments__input-hidden"
          onChange={handleImageSelect}
          disabled={attachmentsDisabled}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          multiple
          className="prod-solic-attachments__input-hidden"
          onChange={handleVideoSelect}
          disabled={attachmentsDisabled}
        />

        <button
          type="button"
          className="prod-solic-attachments__btn prod-solic-attachments__btn--image"
          disabled={attachmentsDisabled}
          onClick={() => imageInputRef.current?.click()}
        >
          <i className="ti ti-photo" aria-hidden="true" />
          Selecionar imagens
        </button>
        <button
          type="button"
          className="prod-solic-attachments__btn prod-solic-attachments__btn--video"
          disabled={attachmentsDisabled}
          onClick={() => videoInputRef.current?.click()}
        >
          <i className="ti ti-video" aria-hidden="true" />
          Selecionar vídeos
        </button>

        <label className="prod-solic-form__check prod-solic-attachments__recusa">
          <input
            type="checkbox"
            checked={recusouEvidencias}
            onChange={toggleRecusa}
          />
          <span>Cliente Recusou Evidencias</span>
        </label>
      </div>

      {hasFiles ? (
        <div className="prod-solic-attachments__gallery">
          {imagens.map((file) => (
            <div key={file.id} className="prod-solic-attachments__thumb-wrap">
              {file.previewUrl ? (
                <img
                  src={file.previewUrl}
                  alt={file.name}
                  className="prod-solic-attachments__thumb"
                />
              ) : (
                <div className="prod-solic-attachments__thumb prod-solic-attachments__thumb--placeholder">
                  <i className="ti ti-photo" aria-hidden="true" />
                </div>
              )}
              <span className="prod-solic-attachments__thumb-name">{file.name}</span>
              <button
                type="button"
                className="prod-solic-attachments__chip-remove"
                aria-label={`Remover ${file.name}`}
                onClick={() => removeImage(file.id)}
              >
                <i className="ti ti-x" />
              </button>
            </div>
          ))}
          {videos.map((file) => (
            <div key={file.id} className="prod-solic-attachments__thumb-wrap prod-solic-attachments__thumb-wrap--video">
              <div className="prod-solic-attachments__thumb prod-solic-attachments__thumb--video">
                <i className="ti ti-video" aria-hidden="true" />
              </div>
              <span className="prod-solic-attachments__thumb-name">{file.name}</span>
              <button
                type="button"
                className="prod-solic-attachments__chip-remove"
                aria-label={`Remover ${file.name}`}
                onClick={() => removeVideo(file.id)}
              >
                <i className="ti ti-x" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Remove preview URLs ao desmontar ou resetar */
export function revokeAttachmentPreviews(imagens = [], videos = []) {
  [...imagens, ...videos].forEach((f) => {
    if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl);
  });
}

/** @deprecated use persistAttachmentEntries — metadados sem blob */
export function stripAttachmentsForSave(imagens = [], videos = []) {
  return {
    anexosImagens: imagens.map(({ id, name, size, mimeType }) => ({ id, name, size, mimeType })),
    anexosVideos: videos.map(({ id, name, size, mimeType }) => ({ id, name, size, mimeType })),
  };
}
