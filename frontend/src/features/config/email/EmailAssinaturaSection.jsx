/**
 * EmailAssinaturaSection v1.2.0 — preview com despedida injetada
 * VERSION: v1.2.0 | DATE: 2026-08-20
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { emailOutboundApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';
import ComposeRichEditor from '../../desk/components/ComposeRichEditor';
import ComposeFormatToolbar, { useComposeFormat } from '../../desk/components/ComposeFormatToolbar';
import { wrapPreviewDocument, buildFarewellPreviewHtml } from './emailPreviewHtml';

const MAX_BYTES = 4 * 1024 * 1024;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

function bufferToDataUrl(buffer, contentType) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return `data:${contentType || 'image/png'};base64,${btoa(binary)}`;
}

async function hydrateSignatureHtml(html, imagens) {
  let next = String(html || '');
  const keys = Array.from(next.matchAll(/desk-sig:([a-zA-Z0-9._-]+)/g)).map((match) => match[1]);
  const unique = Array.from(new Set(keys));
  for (const key of unique) {
    try {
      const res = await emailOutboundApi.signatureAsset(key);
      const contentType = res?.headers?.['content-type'] || imagens.find((item) => item.objectKey === key)?.contentType || 'image/png';
      const dataUrl = bufferToDataUrl(res.data, contentType);
      next = next.split(`desk-sig:${key}`).join(dataUrl);
      const imgRe = new RegExp(`<img([^>]*data-gcs-key="${key}"[^>]*)>`, 'gi');
      next = next.replace(imgRe, (full) => (
        full.includes('data-gcs-key') ? full : full.replace('<img', `<img data-gcs-key="${key}"`)
      ));
    } catch {
      /* preview parcial se o GCS falhar */
    }
  }
  return next;
}

function persistableHtml(html, imagens) {
  const known = new Set((imagens || []).map((item) => item.objectKey));
  const div = document.createElement('div');
  div.innerHTML = String(html || '');
  div.querySelectorAll('img').forEach((img) => {
    const key = img.getAttribute('data-gcs-key') || '';
    if (!key || !known.has(key)) {
      img.remove();
      return;
    }
    img.setAttribute('src', `desk-sig:${key}`);
    img.setAttribute('data-gcs-key', key);
  });
  return { html: div.innerHTML, imagens: (imagens || []).filter((item) => known.has(item.objectKey) && div.querySelector(`img[data-gcs-key="${item.objectKey}"]`)) };
}

export default function EmailAssinaturaSection() {
  const { showNotification } = useNotifications();
  const editorRef = useRef(null);
  const [html, setHtml] = useState('');
  const [imagens, setImagens] = useState([]);
  const [layout, setLayout] = useState({ headerHtml: '', farewellHtml: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const format = useComposeFormat({
    richEditorRef: editorRef,
    mode: 'rich',
    value: html,
    onValueChange: setHtml,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assinatura, nextLayout] = await Promise.all([
        emailOutboundApi.getAssinatura(),
        emailOutboundApi.layout(),
      ]);
      setImagens(assinatura.imagens || []);
      const hydrated = await hydrateSignatureHtml(assinatura.html || '', assinatura.imagens || []);
      setHtml(hydrated);
      setLayout({
        headerHtml: nextLayout.headerHtml,
        farewellHtml: nextLayout.farewellHtml || '',
      });
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Erro ao carregar a assinatura.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleImageSelected = async (file) => {
    if (!file?.type?.startsWith('image/')) {
      showNotification('Selecione um arquivo de imagem (PNG, JPG, GIF ou WebP).', 'warning');
      return;
    }
    if (file.size > MAX_BYTES) {
      showNotification('Imagem muito grande. Tamanho máximo: 4 MB.', 'warning');
      return;
    }
    try {
      const uploaded = await emailOutboundApi.uploadAssinaturaImagem(file);
      const dataUrl = await fileToDataUrl(file);
      const inserted = editorRef.current?.insertImage?.(dataUrl, file.name);
      if (!inserted) {
        showNotification('Não foi possível inserir a imagem no editor.', 'warning');
        return;
      }
      requestAnimationFrame(() => {
        const root = document.getElementById('emailAssinaturaEditor');
        const imgs = root ? Array.from(root.querySelectorAll('img')) : [];
        const last = imgs[imgs.length - 1];
        if (last) last.setAttribute('data-gcs-key', uploaded.objectKey);
        setHtml(editorRef.current?.getHtml?.() || html);
      });
      setImagens((prev) => [...prev, uploaded]);
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Não foi possível enviar a imagem.', 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentHtml = editorRef.current?.getHtml?.() || html;
      const payload = persistableHtml(currentHtml, imagens);
      await emailOutboundApi.saveAssinatura(payload);
      showNotification('Assinatura salva.', 'success');
      await load();
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Não foi possível salvar a assinatura.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const previewHtml = wrapPreviewDocument(`
    <p style="margin:0 0 12px 0;font-size:14px;color:#333;">Prévia da assinatura como ela entra no e-mail.</p>
    ${buildFarewellPreviewHtml(layout.farewellHtml)}
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">${html}</div>
  `, layout.headerHtml || '');

  if (loading) return <p className="config-placeholder-msg">Carregando assinatura…</p>;

  return (
    <div className="config-email-assinatura">
      <div className="config-email-assinatura__editor">
        <p className="config-placeholder-msg">A assinatura entra no final de todos os e-mails ao cliente. Imagens vão para o armazenamento da operação.</p>
        <ComposeFormatToolbar
          applyAction={format.applyAction}
          activeFormats={format.activeFormats}
          embedded
          onImageSelected={handleImageSelected}
        />
        <ComposeRichEditor
          id="emailAssinaturaEditor"
          ref={editorRef}
          value={html}
          placeholder="Digite a assinatura…"
          onChange={(next) => setHtml(next.html)}
          onKeyDown={format.handleKeyDown}
          onFormatStateChange={format.handleFormatStateChange}
        />
        <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Salvando…' : 'Salvar assinatura'}
        </button>
      </div>
      <div className="config-email-assinatura__preview">
        <h4>Como aparece no e-mail</h4>
        <iframe
          title="Prévia da assinatura"
          className="config-email-preview-frame"
          sandbox=""
          srcDoc={previewHtml}
        />
      </div>
    </div>
  );
}
