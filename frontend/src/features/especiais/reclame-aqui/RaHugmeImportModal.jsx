/**
 * RaHugmeImportModal — upload, preview e importação em lote da planilha Hugme
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNotifications } from '../../../context/NotificationContext';
import {
  HUGME_ACCEPT,
  downloadErrorReport,
  importHugmeFileViaApi,
  parseHugmeFile,
} from '../../../services/especiais/hugmeImportService';
import { refreshReclamacoesFromApi } from '../../../services/especiais/reclameAquiStore';

const IMPORT_MODES = {
  base_inicial: {
    id: 'base_inicial',
    label: 'Base completa (somente armazenar)',
    hint: 'Primeira carga histórica — grava no banco sem abrir tickets.',
  },
  incremental: {
    id: 'incremental',
    label: 'Atualização 7 meses (armazenar + tickets)',
    hint: 'Atualiza registros existentes e abre ticket RA apenas para linhas sem ticket.',
  },
};

const STEPS = { upload: 'upload', preview: 'preview', importing: 'importing', done: 'done' };

function StatusBadge({ status }) {
  const map = {
    valid: { label: 'Pronto', cls: 'ra-hugme-badge--valid' },
    invalid: { label: 'Inválido', cls: 'ra-hugme-badge--invalid' },
    duplicate: { label: 'Duplicado', cls: 'ra-hugme-badge--duplicate' },
    created: { label: 'Criado', cls: 'ra-hugme-badge--valid' },
    failed: { label: 'Erro', cls: 'ra-hugme-badge--invalid' },
  };
  const item = map[status] || { label: status, cls: '' };
  return <span className={`ra-hugme-badge ${item.cls}`}>{item.label}</span>;
}

export default function RaHugmeImportModal({ open, onClose, onComplete }) {
  const { showNotification } = useNotifications();
  const fileInputRef = useRef(null);
  const fileRef = useRef(null);
  const [importMode, setImportMode] = useState('base_inicial');
  const [step, setStep] = useState(STEPS.upload);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState(null);
  const stepRef = useRef(step);
  stepRef.current = step;

  const reset = useCallback(() => {
    setStep(STEPS.upload);
    setFileName('');
    setPreview(null);
    setParseError('');
    setParsing(false);
    setProgress({ current: 0, total: 0 });
    setImportResult(null);
    setImportMode('base_inicial');
    fileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && stepRef.current !== STEPS.importing) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleFile = async (file) => {
    if (!file) return;
    fileRef.current = file;
    setParsing(true);
    setParseError('');
    setFileName(file.name);
    try {
      // Libera a UI antes de parsear planilhas grandes (1600+ linhas)
      await new Promise((resolve) => setTimeout(resolve, 0));
      const result = await parseHugmeFile(file);
      if (!result?.rows?.length) {
        throw new Error('Nenhuma reclamação encontrada na planilha. Verifique se é o export Hugme "Base Completa".');
      }
      setPreview(result);
      setStep(STEPS.preview);
      if (result.missingColumns.length) {
        showNotification(
          `Colunas não identificadas: ${result.missingColumns.join(', ')}. Verifique o cabeçalho da planilha.`,
          'warning',
        );
      }
    } catch (err) {
      setParseError(err?.message || 'Não foi possível ler a planilha.');
      setPreview(null);
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer?.files?.[0];
    handleFile(file);
  };

  const handleImport = async () => {
    const file = fileRef.current;
    if (!file || !preview?.rows?.length) return;
    const validRows = preview.rows.filter((r) => r.status === 'valid');
    if (!validRows.length) {
      showNotification('Nenhuma linha válida para importar.', 'error');
      return;
    }

    setStep(STEPS.importing);
    setProgress({ current: 0, total: validRows.length });

    try {
      const result = await importHugmeFileViaApi(file, importMode);
      setImportResult(result);
      setStep(STEPS.done);
      if (importMode === 'incremental') {
        try {
          await refreshReclamacoesFromApi();
        } catch {
          // fail-soft
        }
      }
      onComplete?.(result);
      const msg = importMode === 'base_inicial'
        ? `${result.stored} registro(s) armazenado(s) no banco${result.failed ? `, ${result.failed} erro(s)` : ''}.`
        : `${result.stored} registro(s) atualizado(s), ${result.created} ticket(s) criado(s)${result.failed ? `, ${result.failed} erro(s)` : ''}.`;
      showNotification(msg, result.failed ? 'warning' : 'success');
    } catch (err) {
      showNotification(err?.response?.data?.message || err?.message || 'Falha na importação.', 'error');
      setStep(STEPS.preview);
    }
  };

  const handleDownloadErrors = () => {
    const failed = importResult?.errors?.length
      ? importResult.errors.map((item) => ({
        rowIndex: item.rowIndex,
        consumidor: item.idOrigem,
        status: 'failed',
        errors: [item.message],
      }))
      : preview?.rows?.filter((r) => r.status !== 'valid') || [];
    if (!failed.length) return;
    downloadErrorReport(failed);
  };

  const canClose = step !== STEPS.importing;

  if (!open) return null;

  const previewRows = preview?.rows?.slice(0, 50) || [];
  const hasMorePreview = (preview?.rows?.length || 0) > 50;

  return createPortal(
    <>
      <button
        type="button"
        className="queue-box-modal__backdrop"
        aria-label="Fechar importação"
        onClick={canClose ? onClose : undefined}
        disabled={!canClose}
      />
      <div
        className="queue-box-modal queue-box-modal--wide ra-hugme-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="raHugmeModalTitle"
      >
        <header className="queue-box-modal__header">
          <div className="queue-box-modal__head-main">
            <span className="queue-box-modal__icon" aria-hidden="true">
              <i className="ti ti-file-spreadsheet" />
            </span>
            <div>
              <h2 className="queue-box-modal__title" id="raHugmeModalTitle">
                Importar planilha Hugme
              </h2>
              <p className="queue-box-modal__subtitle">
                {step === STEPS.done
                  ? 'Importação concluída'
                  : importMode === 'base_inicial'
                    ? 'Armazene a base Hugme completa no banco de dados'
                    : 'Atualize a base e abra tickets RA para novas reclamações'}
              </p>
            </div>
          </div>
          {canClose ? (
            <button
              type="button"
              className="queue-box-modal__close"
              onClick={onClose}
              aria-label="Fechar"
            >
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          ) : null}
        </header>

        <div className="queue-box-modal__body ra-hugme-modal__body">
          {step === STEPS.upload && (
            <>
              <fieldset className="ra-hugme-mode">
                <legend className="ra-hugme-mode__legend">Tipo de importação</legend>
                {Object.values(IMPORT_MODES).map((mode) => (
                  <label key={mode.id} className="ra-hugme-mode__option">
                    <input
                      type="radio"
                      name="hugmeImportMode"
                      value={mode.id}
                      checked={importMode === mode.id}
                      onChange={() => setImportMode(mode.id)}
                    />
                    <span>
                      <strong>{mode.label}</strong>
                      <small>{mode.hint}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div
                className="upload-area ra-hugme-upload"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                <i className="ti ti-cloud-upload ra-hugme-upload__icon" aria-hidden="true" />
                <p className="ra-hugme-upload__title">
                  {parsing ? 'Lendo planilha…' : 'Arraste a planilha ou clique para selecionar'}
                </p>
                <p className="ra-hugme-upload__hint">Formatos: .xlsx, .xls, .csv</p>
                {fileName ? <p className="ra-hugme-upload__file">{fileName}</p> : null}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={HUGME_ACCEPT}
                className="ra-hugme-upload__input"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {parseError ? <p className="ra-hugme-error">{parseError}</p> : null}
            </>
          )}

          {step === STEPS.preview && preview && (
            <>
              <div className="ra-hugme-stats">
                <span><strong>{preview.stats.total}</strong> linhas</span>
                <span className="ra-hugme-stats__valid"><strong>{preview.stats.valid}</strong> prontas</span>
                <span className="ra-hugme-stats__warn"><strong>{preview.stats.duplicate}</strong> duplicadas</span>
                <span className="ra-hugme-stats__err"><strong>{preview.stats.invalid}</strong> inválidas</span>
              </div>

              <div className="ra-hugme-preview-wrap">
                <table className="ra-hugme-preview">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>Status</th>
                      <th>Consumidor</th>
                      <th>Assunto</th>
                      <th>ID RA</th>
                      <th>Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row.rowIndex} className={`ra-hugme-preview__row--${row.status}`}>
                        <td>{row.rowIndex}</td>
                        <td><StatusBadge status={row.status} /></td>
                        <td>{row.form.consumidor || '—'}</td>
                        <td>{row.form.assunto || row.form.descricao || '—'}</td>
                        <td>{row.form.idReclamacaoRa || row.form.protocoloRa || '—'}</td>
                        <td>{row.errors?.join('; ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMorePreview ? (
                <p className="ra-hugme-preview-more">
                  Exibindo 50 de {preview.rows.length} linhas.
                </p>
              ) : null}
            </>
          )}

          {step === STEPS.importing && (
            <div className="ra-hugme-progress">
              <p className="ra-hugme-progress__label">
                Importando… {progress.current} de {progress.total}
              </p>
              <div className="ra-hugme-progress__track">
                <div
                  className="ra-hugme-progress__bar"
                  style={{
                    width: progress.total
                      ? `${Math.round((progress.current / progress.total) * 100)}%`
                      : '0%',
                  }}
                />
              </div>
              <p className="ra-hugme-progress__hint">Não feche esta janela durante a importação.</p>
            </div>
          )}

          {step === STEPS.done && importResult && (
            <div className="ra-hugme-result">
              <div className="ra-hugme-stats">
                <span className="ra-hugme-stats__valid">
                  <strong>{importResult.stored ?? importResult.created}</strong> armazenados
                </span>
                {importMode === 'incremental' ? (
                  <span className="ra-hugme-stats__valid">
                    <strong>{importResult.created}</strong> tickets
                  </span>
                ) : null}
                <span className="ra-hugme-stats__warn">
                  <strong>{importResult.skipped}</strong> ignorados
                </span>
                <span className="ra-hugme-stats__err">
                  <strong>{importResult.failed}</strong> erros
                </span>
              </div>
              {(importResult.errors?.length > 0) ? (
                <button
                  type="button"
                  className="btn-secondary ra-hugme-download-btn"
                  onClick={handleDownloadErrors}
                >
                  <i className="ti ti-download" aria-hidden="true" /> Baixar relatório de erros
                </button>
              ) : null}
            </div>
          )}
        </div>

        <footer className="queue-box-modal__footer">
          {step === STEPS.upload && (
            <button type="button" className="btn-secondary queue-box-modal__btn" onClick={onClose}>
              Cancelar
            </button>
          )}

          {step === STEPS.preview && (
            <>
              <button
                type="button"
                className="btn-secondary queue-box-modal__btn"
                onClick={() => { reset(); }}
              >
                Trocar arquivo
              </button>
              <button
                type="button"
                className="btn-primary queue-box-modal__btn"
                onClick={handleImport}
                disabled={!preview?.stats?.valid}
              >
                {importMode === 'base_inicial'
                  ? `Armazenar ${preview.stats.valid} registro(s)`
                  : `Importar ${preview.stats.valid} linha(s)`}
              </button>
            </>
          )}

          {step === STEPS.done && (
            <button type="button" className="btn-primary queue-box-modal__btn" onClick={onClose}>
              Fechar
            </button>
          )}
        </footer>
      </div>
    </>,
    document.body,
  );
}
