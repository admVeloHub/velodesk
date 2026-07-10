/**
 * DeskRightPanel v1.6.0 — responsavel oculto (sessão automática)
 * VERSION: v1.6.0 | DATE: 2026-07-10 | AUTHOR: VeloHub Development Team
 */
import React from 'react';
import { DEFAULT_TIPO } from '../../../services/tabulationConfig';
import { useTabulation } from '../../../context/TabulationContext';
import { DeskStatusCommitButton } from './DeskComposePanel';

function SelectField({ id, label, fieldKey, value, options, readonly, onFieldChange, showPlaceholder = false }) {
  return (
    <div className="rp-field" key={id}>
      <label htmlFor={id}>{label}</label>
      {readonly ? (
        <input type="text" id={id} readOnly value={value || ''} />
      ) : (
        <select id={id} value={value || ''} onChange={(e) => onFieldChange(fieldKey, e.target.value)}>
          {showPlaceholder && <option value="">Selecionar</option>}
          {(options || []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}
    </div>
  );
}

export default function DeskRightPanel({
  ticket,
  client,
  rightFields,
  sendStatus,
  onFieldChange,
  onApplyTabulation,
  onCommitStatus,
  onOpenChat,
  onCloseChat,
  waChatOpen,
  sendDisabled = false,
  sendDisabledTitle,
  iaTabulationDisplay = '',
  iaTabulationLoading = false,
  iaWaitingMessage = '',
  iaTabulationIncomplete = true,
  iaHasSuggestion = false,
  iaShowSection = false,
}) {
  const { loading, getMotivos, getDetalhes, getProdutoNames, getTipoChamadoOptions, getCanalContatoOptions } = useTabulation();

  const thermo = client?.termometro ?? 38;
  const thermoLabel = client?.termometroLabel || (thermo >= 55 ? 'Crítico' : thermo >= 45 ? 'Atenção' : 'Estável');
  const thermoColor = thermo >= 55 ? '#FCC200' : thermo >= 45 ? '#FCC200' : '#15A237';

  const produtoOptions = getProdutoNames();
  const tipoOptions = getTipoChamadoOptions();
  const canalOptions = getCanalContatoOptions();
  const motivoOptions = rightFields.produto ? getMotivos(rightFields.produto) : [];
  const detalheOptions = rightFields.produto && rightFields.motivo
    ? getDetalhes(rightFields.produto, rightFields.motivo)
    : [];

  const tabulationText = iaTabulationLoading || !iaHasSuggestion
    ? (iaWaitingMessage || 'Gerando sugestão com base nos POPs…')
    : (iaTabulationDisplay || 'Tabulação incompleta');

  const canApplyTabulation = iaHasSuggestion && !iaTabulationLoading && !iaTabulationIncomplete;

  return (
    <aside className="crm-right-panel" id="crmRightPanel">
      <div className="crm-right-panel__scroll">
        <section className="rp-section">
          <div className="rp-section__label">Termômetro do cliente</div>
          <div className="thermo-score" id="thermoScore" style={{ color: thermoColor }}>{thermo}</div>
          <div className="thermo-bar"><div className="thermo-fill" id="thermoFill" style={{ width: thermo + '%', background: thermoColor }} /></div>
          <div className="thermo-label" id="thermoLabel" style={{ color: thermoColor }}>{thermoLabel}</div>
        </section>

        <section className="rp-section">
          <div className="rp-section__label">Classificação</div>
          {loading && (
            <p className="rp-field-hint">Carregando opções de tabulação…</p>
          )}
          <SelectField
            id="selCanal"
            label="Canal"
            fieldKey="canal"
            value={rightFields.canal}
            options={canalOptions}
            onFieldChange={onFieldChange}
          />
          <SelectField
            id="selTipo"
            label="Tipo"
            fieldKey="tipo"
            value={rightFields.tipo || DEFAULT_TIPO}
            options={tipoOptions}
            onFieldChange={onFieldChange}
          />
          <SelectField
            id="selProduto"
            label="Produto"
            fieldKey="produto"
            value={rightFields.produto}
            options={produtoOptions}
            showPlaceholder
            onFieldChange={onFieldChange}
          />
          {rightFields.produto && motivoOptions.length > 0 && (
            <SelectField
              id="selMotivo"
              label="Motivo"
              fieldKey="motivo"
              value={rightFields.motivo}
              options={motivoOptions}
              showPlaceholder
              onFieldChange={onFieldChange}
            />
          )}
          {rightFields.motivo && detalheOptions.length > 0 && (
            <SelectField
              id="selDetalhe"
              label="Detalhe"
              fieldKey="detalhe"
              value={rightFields.detalhe}
              options={detalheOptions}
              showPlaceholder
              onFieldChange={onFieldChange}
            />
          )}
        </section>

        {iaShowSection && (
          <section className="rp-section">
            <div className={'ia-tabulation' + (iaTabulationLoading ? ' ia-tabulation--loading' : '')}>
              <div className="ia-tabulation__label">SUGESTÃO IA</div>
              <div className="ia-tabulation__text" id="iaTabulationText">{tabulationText}</div>
              <button
                type="button"
                className="ia-tabulation__btn"
                id="btnApplyTabulation"
                disabled={!canApplyTabulation}
                onClick={onApplyTabulation}
              >
                Aplicar tabulação
              </button>
            </div>
          </section>
        )}
      </div>
      <div className="crm-right-panel__footer">
        <button
          type="button"
          className={'rp-footer-btn rp-footer-btn--secondary' + (waChatOpen ? ' is-active' : '')}
          id="btnOpenChat"
          onClick={waChatOpen ? onCloseChat : onOpenChat}
        >
          <i className="ti ti-message-circle" />
          {waChatOpen ? 'Fechar conversa' : 'Abrir conversa'}
        </button>
        <DeskStatusCommitButton
          sendStatus={sendStatus}
          onCommitStatus={onCommitStatus}
          variant="panel"
          disabled={sendDisabled}
          disabledTitle={sendDisabledTitle}
        />
      </div>
    </aside>
  );
}
