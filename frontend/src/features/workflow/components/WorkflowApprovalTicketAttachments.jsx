/**
 * WorkflowApprovalTicketAttachments v1.0.0 — anexos do ticket no console /workflow
 * VERSION: v1.0.0 | DATE: 2026-08-19
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  attachmentKindIcon,
  classifyAttachmentKind,
  downloadObjectUrl,
  loadAttachmentForPreview,
  shouldOpenPreviewModal,
} from '../../../services/desk/attachmentPreview';
import DeskAttachmentPreviewModal from '../../desk/components/DeskAttachmentPreviewModal';

export default function WorkflowApprovalTicketAttachments({ attachments = [] }) {
  const items = Array.isArray(attachments) ? attachments.filter((item) => item?.url) : [];
  const [loadingUrl, setLoadingUrl] = useState('');
  const [errorUrl, setErrorUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);
  previewRef.current = preview;

  useEffect(() => () => {
    if (previewRef.current?.objectUrl) URL.revokeObjectURL(previewRef.current.objectUrl);
  }, []);

  const closePreview = useCallback(() => {
    setPreview((current) => {
      if (current?.objectUrl) URL.revokeObjectURL(current.objectUrl);
      return null;
    });
  }, []);

  const openAttachment = useCallback(async (item) => {
    const url = item.url;
    setErrorUrl('');
    setLoadingUrl(url);
    try {
      const loaded = await loadAttachmentForPreview(url, item.contentType);
      if (shouldOpenPreviewModal(loaded.kind)) {
        setPreview((current) => {
          if (current?.objectUrl) URL.revokeObjectURL(current.objectUrl);
          return loaded;
        });
        return;
      }
      downloadObjectUrl(loaded.objectUrl, loaded.filename);
      window.setTimeout(() => URL.revokeObjectURL(loaded.objectUrl), 60_000);
    } catch (err) {
      setErrorUrl(url);
      console.warn('[WorkflowApprovalTicketAttachments] anexo:', err?.message || err);
    } finally {
      setLoadingUrl('');
    }
  }, []);

  if (!items.length) return null;

  return (
    <>
      <ul className="wf-approval-ticket-attachments__list">
        {items.map((item) => {
          const url = item.url;
          const isLoading = loadingUrl === url;
          const hasError = errorUrl === url;
          const pending = item.scanStatus === 'pending';
          const blocked = item.scanStatus === 'infected' || item.scanStatus === 'unscannable';
          const kind = classifyAttachmentKind(item.contentType, item.label);
          const label = item.label || 'Anexo';

          return (
            <li key={url} className="wf-approval-ticket-attachments__item">
              <button
                type="button"
                className={`wf-approval-ticket-attachments__link${hasError || blocked ? ' wf-approval-ticket-attachments__link--error' : ''}${pending ? ' wf-approval-ticket-attachments__link--pending' : ''}`}
                disabled={isLoading || pending || blocked}
                onClick={() => { openAttachment(item); }}
                title={label}
              >
                <i
                  className={`ti ${blocked ? 'ti-shield-x' : attachmentKindIcon(kind)}`}
                  aria-hidden="true"
                />
                <span className="wf-approval-ticket-attachments__name">
                  {blocked ? 'Anexo bloqueado' : pending ? 'Verificando…' : isLoading ? 'Abrindo…' : label}
                </span>
              </button>
              {hasError ? (
                <span className="wf-approval-ticket-attachments__error" role="alert">
                  Anexo indisponível no servidor.
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <DeskAttachmentPreviewModal
        open={Boolean(preview)}
        kind={preview?.kind}
        objectUrl={preview?.objectUrl}
        filename={preview?.filename}
        onClose={closePreview}
      />
    </>
  );
}
