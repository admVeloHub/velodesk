/**
 * ProdSolicAttachments — anexos de imagem/vídeo para Erros/Bugs
 */
import React, { useRef } from 'react';
import { toAttachmentMetadata } from '../../../services/cadastral/cadastralRequestStore';

function createAttachmentEntry(file) {
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...toAttachmentMetadata(file),
    previewUrl: URL.createObjectURL(file),
  };
}

export default function ProdSolicAttachments({
  imagens = [],
  videos = [],
  recusouEvidencias = false,
  onChange,
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

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const next = [...imagens, ...files.map(createAttachmentEntry)];
    emit({ imagens: next });
    event.target.value = '';
  };

  const handleVideoSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const next = [...videos, ...files.map(createAttachmentEntry)];
    emit({ videos: next });
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
        <ul className="prod-solic-attachments__list">
          {imagens.map((file) => (
            <li key={file.id} className="prod-solic-attachments__chip">
              <i className="ti ti-photo" aria-hidden="true" />
              <span className="prod-solic-attachments__chip-name">{file.name}</span>
              <button
                type="button"
                className="prod-solic-attachments__chip-remove"
                aria-label={`Remover ${file.name}`}
                onClick={() => removeImage(file.id)}
              >
                <i className="ti ti-x" />
              </button>
            </li>
          ))}
          {videos.map((file) => (
            <li key={file.id} className="prod-solic-attachments__chip prod-solic-attachments__chip--video">
              <i className="ti ti-video" aria-hidden="true" />
              <span className="prod-solic-attachments__chip-name">{file.name}</span>
              <button
                type="button"
                className="prod-solic-attachments__chip-remove"
                aria-label={`Remover ${file.name}`}
                onClick={() => removeVideo(file.id)}
              >
                <i className="ti ti-x" />
              </button>
            </li>
          ))}
        </ul>
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

/** Metadados para persistência (sem previewUrl/id) */
export function stripAttachmentsForSave(imagens = [], videos = []) {
  return {
    anexosImagens: imagens.map(({ name, size, mimeType }) => ({ name, size, mimeType })),
    anexosVideos: videos.map(({ name, size, mimeType }) => ({ name, size, mimeType })),
  };
}
