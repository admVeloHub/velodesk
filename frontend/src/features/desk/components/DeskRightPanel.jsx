/**
 * DeskRightPanel v1.7.0 — campo Responsável acima de Canal
 * VERSION: v1.7.0 | DATE: 2026-07-22
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_TIPO, hasApplyableTabulation, parseTabulationDisplay } from '../../../services/tabulationConfig';
import { useTabulation } from '../../../context/TabulationContext';
import { useDeskAgents } from '../../../hooks/useDeskAgents';
import { DeskStatusCommitButton } from './DeskComposePanel';
import TicketOperationProgress from './TicketOperationProgress';
import ProcessosPopover from './ProcessosPopover';
import { AGENT_FORWARD_OPTIONS, DESK_THERMOMETER_UI_ENABLED } from '../../../services/desk/constants';
import { isTicketInWorkflow } from '../../../services/desk/utils';
import { getAutoCloseOnSave, setAutoCloseOnSave } from '../../../services/desk/agentDeskPreferences';

const CANAL_OPTIONS_FALLBACK = ['WhatsApp', 'Telefone', 'E-mail', 'Portal'];
const TIPO_OPTIONS_FALLBACK = ['Reclamação', 'Solicitação', 'Dúvida', 'Informação'];

function useAgentSettingsPopoverPosition(open, anchorRef) {
  const [layout, setLayout] = useState(null);

  useEffect(() => {
    if (!open) {
      setLayout(null);
      return undefined;
    }

    const update = () => {
      const btn = anchorRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      setLayout({
        popover: {
          right: `${Math.max(12, window.innerWidth - rect.right)}px`,
          bottom: `${Math.max(12, window.innerHeight - rect.top + 8)}px`,
        },
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef]);

  return layout;
}

function SelectField({ id, label, fieldKey, value, options, readonly, onFieldChange, showPlaceholder = false, optionItems = null }) {
  return (
    <div className="rp-field" key={id}>
      <label htmlFor={id}>{label}</label>
      {readonly ? (
        <input type="text" id={id} readOnly value={value || ''} />
      ) : (
        <select id={id} value={value || ''} onChange={(e) => onFieldChange(fieldKey, e.target.value)}>
          {showPlaceholder && <option value="">Selecionar</option>}
          {optionItems
            ? optionItems.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)
            : (options || []).map((o) => (
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
  queueId,
  rightFields,
  sendStatus,
  escalonar,
  onFieldChange,
  onEscalonarChange,
  onApplyTabulation,
  onCommitStatus,
  onOpenChat,
  onCloseChat,
  waChatOpen,
  sendDisabled = false,
  iaTabulationDisplay = '',
  iaTabulation = null,
  iaTabulationFonte = 'atendimento',
  iaTabulationLoading = false,
  iaWaitingMessage = '',
  iaHasSuggestion = false,
  iaHasTabulationSuggestion = false,
  iaShowSection = false,
  iaAuditScore = null,
  tabulationReadonly = false,
  workflowProgress = null,
  workflowDecision = null,
  onWorkflowDecisionChange,
}) {
  const { loading, getMotivos, getDetalhes, getProdutoNames, getTipoChamadoOptions, getCanalContatoOptions } = useTabulation();
  const { currentAgentValue, agentOptions, loading: agentsLoading } = useDeskAgents();
  const [processosOpen, setProcessosOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoCloseOnSave, setAutoCloseOnSaveState] = useState(() => getAutoCloseOnSave());
  const settingsBtnRef = useRef(null);
  const settingsPopoverLayout = useAgentSettingsPopoverPosition(settingsOpen, settingsBtnRef);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen]);

  const toggleAutoCloseOnSave = () => {
    setAutoCloseOnSaveState((prev) => {
      const next = !prev;
      setAutoCloseOnSave(next);
      return next;
    });
  };

  useEffect(() => {
    if (!currentAgentValue || String(rightFields.responsavel || '').trim()) return;
    onFieldChange('responsavel', currentAgentValue);
  }, [currentAgentValue, rightFields.responsavel, onFieldChange]);

  const tipoOptions = getTipoChamadoOptions();
  const canalOptions = getCanalContatoOptions();
  const responsavelOptions = useMemo(() => {
    const options = agentOptions.length ? [...agentOptions] : [];
    const current = String(rightFields.responsavel || '').trim();
    if (current && !options.includes(current)) options.unshift(current);
    if (!options.length && currentAgentValue) options.push(currentAgentValue);
    return options;
  }, [agentOptions, rightFields.responsavel, currentAgentValue]);

  const thermo = client?.termometro ?? 38;
  const thermoLabel = client?.termometroLabel || (thermo >= 55 ? 'Crítico' : thermo >= 45 ? 'Atenção' : 'Estável');
  const thermoColor = thermo >= 55 ? '#FCC200' : thermo >= 45 ? '#FCC200' : '#15A237';

  const produtoOptions = getProdutoNames();
  const motivoOptions = rightFields.produto ? getMotivos(rightFields.produto) : [];
  const detalheOptions = rightFields.produto && rightFields.motivo
    ? getDetalhes(rightFields.produto, rightFields.motivo)
    : [];

  const tabulationText = iaTabulationLoading
    ? (iaWaitingMessage || 'Gerando sugestão com base nos POPs…')
    : iaHasTabulationSuggestion
      ? (iaTabulationDisplay || 'Tabulação sugerida')
      : (iaWaitingMessage || 'Aguardando sugestão de tabulação…');

  const parsedTabulation = parseTabulationDisplay(iaTabulationDisplay);
  const canApplyTabulation = !iaTabulationLoading && (
    iaHasTabulationSuggestion
    || hasApplyableTabulation(iaTabulation)
    || hasApplyableTabulation(parsedTabulation)
  );
  const inWorkflow = isTicketInWorkflow(ticket);
  const isApprovalStep = workflowProgress?.activeStep?.acao?.tipo === 'aprovacao';
  const showThermoUi = DESK_THERMOMETER_UI_ENABLED;
  const showOperationProgress = !inWorkflow;
  const showThermoSection = showThermoUi || showOperationProgress;
  const canForward = Boolean(
    rightFields.motivo && detalheOptions.length > 0 && !inWorkflow,
  );

  return (
    <aside className="crm-right-panel" id="crmRightPanel">
      <div className="crm-right-panel__scroll">
        {showThermoSection ? (
        <section className="rp-section">
          <div className="rp-section__header">
            {showThermoUi ? (
              <div className="rp-section__label">Termômetro do cliente</div>
            ) : null}
            {showOperationProgress ? (
              <TicketOperationProgress
                ticket={ticket}
                queueId={queueId}
                escalonar={escalonar}
              />
            ) : null}
          </div>
          {showThermoUi ? (
            <>
              <div className="thermo-score" id="thermoScore" style={{ color: thermoColor }}>{thermo}</div>
              <div className="thermo-bar"><div className="thermo-fill" id="thermoFill" style={{ width: thermo + '%', background: thermoColor }} /></div>
              <div className="thermo-label" id="thermoLabel" style={{ color: thermoColor }}>{thermoLabel}</div>
            </>
          ) : null}
        </section>
        ) : null}

        <section className="rp-section">
          <div className="rp-section__label">Classificação</div>
          {loading && (
            <p className="rp-field-hint">Carregando opções de tabulação…</p>
          )}
          {agentsLoading && !responsavelOptions.length ? (
            <p className="rp-field-hint">Carregando agentes…</p>
          ) : null}
          <SelectField
            id="selResponsavel"
            label="Responsável"
            fieldKey="responsavel"
            value={rightFields.responsavel}
            options={responsavelOptions}
            showPlaceholder
            readonly={inWorkflow}
            onFieldChange={onFieldChange}
          />
          <SelectField
            id="selCanal"
            label="Canal"
            fieldKey="canal"
            value={rightFields.canal}
            options={canalOptions.length ? canalOptions : CANAL_OPTIONS_FALLBACK}
            readonly={tabulationReadonly}
            onFieldChange={onFieldChange}
          />
          <SelectField
            id="selTipo"
            label="Tipo"
            fieldKey="tipo"
            value={rightFields.tipo || DEFAULT_TIPO}
            options={tipoOptions.length ? tipoOptions : TIPO_OPTIONS_FALLBACK}
            readonly={tabulationReadonly}
            onFieldChange={onFieldChange}
          />
          <SelectField
            id="selProduto"
            label="Produto"
            fieldKey="produto"
            value={rightFields.produto}
            options={produtoOptions}
            showPlaceholder
            readonly={tabulationReadonly}
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
              readonly={tabulationReadonly}
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
              readonly={tabulationReadonly}
              onFieldChange={onFieldChange}
            />
          )}
          {isApprovalStep ? (
            <div className="rp-field rp-field--workflow-decision">
              <span className="rp-field__label">Decisão de aprovação</span>
              <div className="rp-workflow-decision-toggles">
                <button
                  type="button"
                  className={'rp-workflow-decision-btn' + (workflowDecision === 'approve' ? ' is-active' : '')}
                  onClick={() => onWorkflowDecisionChange?.('approve')}
                >
                  Aprovado
                </button>
                <button
                  type="button"
                  className={'rp-workflow-decision-btn rp-workflow-decision-btn--reject' + (workflowDecision === 'reject' ? ' is-active' : '')}
                  onClick={() => onWorkflowDecisionChange?.('reject')}
                >
                  Reprovado
                </button>
              </div>
            </div>
          ) : null}
          {canForward ? (
            <SelectField
              id="selEscalonar"
              label="Encaminhar para"
              fieldKey="escalonar"
              value={escalonar || ''}
              optionItems={AGENT_FORWARD_OPTIONS}
              showPlaceholder
              onFieldChange={(_, value) => onEscalonarChange?.(value)}
            />
          ) : null}
        </section>

        {iaShowSection && (
          <section className="rp-section">
            <div className={'ia-tabulation' + (iaTabulationLoading ? ' ia-tabulation--loading' : '')}>
              <div className="ia-tabulation__label">
                SUGESTÃO
                {iaTabulationFonte === 'auditoria' && iaHasTabulationSuggestion && !iaTabulationLoading && (
                  <span className="ia-tabulation__fonte"> · Tabulação (Auditoria)</span>
                )}
                {typeof iaAuditScore === 'number' && iaHasSuggestion && !iaTabulationLoading && (
                  <span className="ia-tabulation__compliance"> · Conformidade {iaAuditScore}%</span>
                )}
              </div>
              <div className="ia-tabulation__text" id="iaTabulationText">{tabulationText}</div>
              <div className="ia-tabulation__actions">
                <button
                  type="button"
                  className={'ia-tabulation__btn ia-tabulation__btn--processos' + (processosOpen ? ' is-active' : '')}
                  id="btnOpenProcessos"
                  aria-expanded={processosOpen}
                  aria-haspopup="dialog"
                  aria-controls="processosDrawer"
                  onClick={() => setProcessosOpen((open) => !open)}
                >
                  Processos
                </button>
                <button
                  type="button"
                  className="ia-tabulation__btn ia-tabulation__btn--apply"
                  id="btnApplyTabulation"
                  disabled={!canApplyTabulation}
                  onClick={onApplyTabulation}
                >
                  Aplicar tabulação
                </button>
              </div>
              <ProcessosPopover
                open={processosOpen}
                onClose={() => setProcessosOpen(false)}
              />
            </div>
          </section>
        )}
      </div>
      <div className="crm-right-panel__settings-bar">
        <div className="crm-right-panel__settings-wrap">
          <button
            ref={settingsBtnRef}
            type="button"
            className={'crm-right-panel__settings-btn' + (settingsOpen ? ' is-open' : '')}
            id="btnDeskAgentSettings"
            aria-label="Configurações do atendimento"
            aria-expanded={settingsOpen}
            aria-haspopup="dialog"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <i className="ti ti-settings" aria-hidden="true" />
          </button>
        </div>
      </div>
      {settingsOpen && settingsPopoverLayout
        ? createPortal(
          <div className="crm-agent-settings-layer" id="deskAgentSettingsLayer">
            <button
              type="button"
              className="crm-agent-settings-backdrop"
              aria-label="Fechar configurações"
              onClick={() => setSettingsOpen(false)}
            />
            <div
              className="crm-agent-settings-popover"
              id="deskAgentSettingsPopover"
              style={settingsPopoverLayout.popover}
              role="dialog"
              aria-label="Configurações do atendimento"
            >
              <div className="crm-agent-settings-popover__title">Comportamento ao Salvar</div>
              <div className="crm-agent-settings-popover__row">
                <button
                  type="button"
                  className={
                    'crm-agent-settings-popover__toggle'
                    + (autoCloseOnSave ? ' is-close' : ' is-keep')
                  }
                  aria-pressed={autoCloseOnSave}
                  onClick={toggleAutoCloseOnSave}
                >
                  {autoCloseOnSave ? 'Fechar' : 'Manter'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}
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
        />
      </div>
    </aside>
  );
}
