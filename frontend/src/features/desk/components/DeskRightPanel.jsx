/**
 * DeskRightPanel v1.2.3 — cascata dinâmica produto → motivo → detalhe (Mongo)
 * VERSION: v1.2.3 | DATE: 2026-06-26
 */
import React, { useEffect, useRef, useState } from 'react';
import { ESCALONAR_OPTIONS } from '../../../services/desk/constants';
import { buildIaTabulation, getEscalonarLabel } from '../../../services/desk/utils';
import { useTabulation } from '../../../context/TabulationContext';
import { DeskStatusCommitButton } from './DeskComposePanel';

const CANAL_OPTIONS = ['WhatsApp', 'Telefone', 'E-mail', 'Portal'];
const TIPO_OPTIONS = ['Reclamação', 'Solicitação', 'Dúvida', 'Informação'];

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
  escalonar,
  sendStatus,
  onFieldChange,
  onEscalonarChange,
  onApplyTabulation,
  onCommitStatus,
  onCloseTicket,
  onOpenChat,
  onCloseChat,
  waChatOpen,
  sendDisabled = false,
}) {
  const { loading, getMotivos, getDetalhes, getProdutoNames } = useTabulation();
  const [escalonarOpen, setEscalonarOpen] = useState(false);
  const escalonarRef = useRef(null);

  const thermo = client?.termometro ?? 38;
  const thermoLabel = client?.termometroLabel || (thermo >= 55 ? 'Crítico' : thermo >= 45 ? 'Atenção' : 'Estável');
  const thermoColor = thermo >= 55 ? '#FCC200' : thermo >= 45 ? '#FCC200' : '#15A237';

  const produtoOptions = getProdutoNames();
  const motivoOptions = rightFields.produto ? getMotivos(rightFields.produto) : [];
  const detalheOptions = rightFields.produto && rightFields.motivo
    ? getDetalhes(rightFields.produto, rightFields.motivo)
    : [];

  useEffect(() => {
    const close = (e) => {
      if (escalonarRef.current && !escalonarRef.current.contains(e.target)) setEscalonarOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <aside className="crm-right-panel" id="crmRightPanel">
      <div className="crm-right-panel__scroll">
        <section className="rp-section">
          <div className="rp-section__label-row">
            <div className="rp-section__label">Termômetro do cliente</div>
            <button
              type="button"
              className="rp-section__close-btn"
              id="btnCloseTicket"
              title="Finalizar solicitação"
              aria-label="Finalizar solicitação"
              onClick={onCloseTicket}
            >
              <i className="ti ti-x" />
            </button>
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
          <SelectField
            id="selResponsavel"
            label="Responsável"
            fieldKey="responsavel"
            value={rightFields.responsavel}
            readonly
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
            value={rightFields.tipo}
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
        </section>

        <section className="rp-section rp-section--cascade" id="escalonarSection" ref={escalonarRef}>
          <div className="rp-section__label">Escalonar</div>
          <div className="cascade-flow" id="escalonarFlow">
            <div className="cascade-flow__step cascade-flow__step--category">
              <button
                type="button"
                className={'cascade-flow__trigger' + (escalonar ? ' is-selected' : '')}
                id="escalonarBtn"
                aria-haspopup="listbox"
                aria-expanded={escalonarOpen}
                onClick={() => setEscalonarOpen((v) => !v)}
              >
                <span className="cascade-flow__trigger-prefix">Destino</span>
                <span className="cascade-flow__trigger-label" id="escalonarLabel">{getEscalonarLabel(escalonar)}</span>
                <i className="ti ti-chevron-down" />
              </button>
              <div className="cascade-flow__menu" id="escalonarMenu" role="listbox" hidden={!escalonarOpen}>
                {ESCALONAR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="cascade-flow__option"
                    data-escalonar={opt.id}
                    onClick={() => { onEscalonarChange(opt.id); setEscalonarOpen(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {escalonar && (
              <div className="cascade-flow__summary" id="escalonarSummary">
                <i className="ti ti-arrow-up-right" /> Escalonado para <strong>{getEscalonarLabel(escalonar)}</strong>
              </div>
            )}
          </div>
        </section>

        <section className="rp-section">
          <div className="ia-tabulation">
            <div className="ia-tabulation__label">SUGESTÃO IA</div>
            <div className="ia-tabulation__text" id="iaTabulationText">{buildIaTabulation(ticket, rightFields)}</div>
            <button type="button" className="ia-tabulation__btn" id="btnApplyTabulation" onClick={onApplyTabulation}>Aplicar tabulação</button>
          </div>
        </section>
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
