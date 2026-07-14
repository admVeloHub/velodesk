/**
 * DeskRightPanel v1.4.0 — sugestão IA tabulação via OpenAI + POPs
 * VERSION: v1.4.0 | DATE: 2026-07-03 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useState } from 'react';
import { DEFAULT_TIPO, hasApplyableTabulation, parseTabulationDisplay } from '../../../services/tabulationConfig';
import { useTabulation } from '../../../context/TabulationContext';
import { useDeskAgents } from '../../../hooks/useDeskAgents';
import { DeskStatusCommitButton } from './DeskComposePanel';
import TicketOperationProgress from './TicketOperationProgress';
import ProcessosPopover from './ProcessosPopover';
import { ESCALONAR_OPTIONS } from '../../../services/desk/constants';
import { isTicketInWorkflow } from '../../../services/desk/utils';

const CANAL_OPTIONS = ['WhatsApp', 'Telefone', 'E-mail', 'Portal'];
const TIPO_OPTIONS = ['Reclamação', 'Solicitação', 'Dúvida', 'Informação'];

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
  iaTabulationLoading = false,
  iaWaitingMessage = '',
  iaHasSuggestion = false,
  iaHasTabulationSuggestion = false,
  iaShowSection = false,
}) {
  const { loading, getMotivos, getDetalhes, getProdutoNames } = useTabulation();
  const { agentOptions, currentAgentValue, loading: agentsLoading } = useDeskAgents();
  const [processosOpen, setProcessosOpen] = useState(false);

  useEffect(() => {
    if (!currentAgentValue || String(rightFields.responsavel || '').trim()) return;
    onFieldChange('responsavel', currentAgentValue);
  }, [currentAgentValue, rightFields.responsavel, onFieldChange]);

  const responsavelOptions = agentOptions.length
    ? agentOptions
    : (currentAgentValue ? [currentAgentValue] : []);

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
  const showEscalonar = String(rightFields.tipo || DEFAULT_TIPO).trim() === 'Solicitação';
  const inWorkflow = isTicketInWorkflow(ticket);

  return (
    <aside className="crm-right-panel" id="crmRightPanel">
      <div className="crm-right-panel__scroll">
        <section className="rp-section">
          <div className="rp-section__header">
            <div className="rp-section__label">Termômetro do cliente</div>
            {!inWorkflow ? (
              <TicketOperationProgress
                ticket={ticket}
                queueId={queueId}
                escalonar={escalonar}
              />
            ) : null}
          </div>
          <div className="thermo-score" id="thermoScore" style={{ color: thermoColor }}>{thermo}</div>
          <div className="thermo-bar"><div className="thermo-fill" id="thermoFill" style={{ width: thermo + '%', background: thermoColor }} /></div>
          <div className="thermo-label" id="thermoLabel" style={{ color: thermoColor }}>{thermoLabel}</div>
        </section>

        <section className="rp-section">
          <div className="rp-section__label">Classificação</div>
          {loading && (
            <p className="rp-field-hint">Carregando opções de tabulação…</p>
          )}
          {agentsLoading && (
            <p className="rp-field-hint">Carregando agentes…</p>
          )}
          <SelectField
            id="selResponsavel"
            label="Responsável"
            fieldKey="responsavel"
            value={rightFields.responsavel || currentAgentValue}
            options={responsavelOptions}
            showPlaceholder
            onFieldChange={onFieldChange}
          />
          <SelectField
            id="selCanal"
            label="Canal"
            fieldKey="canal"
            value={rightFields.canal}
            options={CANAL_OPTIONS}
            onFieldChange={onFieldChange}
          />
          <SelectField
            id="selTipo"
            label="Tipo"
            fieldKey="tipo"
            value={rightFields.tipo || DEFAULT_TIPO}
            options={TIPO_OPTIONS}
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
          {showEscalonar && !inWorkflow ? (
            <SelectField
              id="selEscalonar"
              label="Encaminhar para"
              fieldKey="escalonar"
              value={escalonar || ''}
              optionItems={ESCALONAR_OPTIONS}
              showPlaceholder
              onFieldChange={(_, value) => onEscalonarChange?.(value)}
            />
          ) : null}
        </section>

        {iaShowSection && (
          <section className="rp-section">
            <div className={'ia-tabulation' + (iaTabulationLoading ? ' ia-tabulation--loading' : '')}>
              <div className="ia-tabulation__label">SUGESTÃO IA</div>
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
