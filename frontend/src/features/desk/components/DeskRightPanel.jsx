/**
 * DeskRightPanel v1.0.0 — classificação, escalonar e automação
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ESCALONAR_OPTIONS,
} from '../../../services/desk/constants';
import {
  buildIaTabulation,
  getEscalonarLabel,
} from '../../../services/desk/utils';

export default function DeskRightPanel({
  ticket,
  client,
  rightFields,
  escalonar,
  onFieldChange,
  onEscalonarChange,
  onApplyTabulation,
  onSave,
  onCloseTicket,
  onOpenChat,
  onCloseChat,
  waChatOpen,
}) {
  const [escalonarOpen, setEscalonarOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const escalonarRef = useRef(null);

  const thermo = client?.termometro ?? 38;
  const thermoLabel = client?.termometroLabel || (thermo >= 55 ? 'Crítico' : thermo >= 45 ? 'Atenção' : 'Estável');
  const thermoColor = thermo >= 55 ? '#FCC200' : thermo >= 45 ? '#FCC200' : '#15A237';

  useEffect(() => {
    const close = (e) => {
      if (escalonarRef.current && !escalonarRef.current.contains(e.target)) setEscalonarOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const handleSave = async () => {
    await onSave();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

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
          {[
            ['selResponsavel', 'Responsável', 'responsavel', true],
            ['selCanal', 'Canal', 'canal', false, ['WhatsApp', 'Telefone', 'E-mail', 'Portal']],
            ['selTipo', 'Tipo', 'tipo', false, ['Reclamação', 'Solicitação', 'Dúvida', 'Informação']],
            ['selProduto', 'Produto', 'produto', false, ['Internet Fibra', 'TV', 'Telefone', 'Combo']],
            ['selMotivo', 'Motivo', 'motivo', false, ['Lentidão', 'Queda de sinal', 'Sem conexão', 'Cancelamento', 'Cobrança', 'Financeiro']],
          ].map(([id, label, key, readonly, options]) => (
            <div className="rp-field" key={id}>
              <label htmlFor={id}>{label}</label>
              {readonly ? (
                <input type="text" id={id} readOnly value={rightFields[key] || ''} />
              ) : (
                <select id={id} value={rightFields[key] || ''} onChange={(e) => onFieldChange(key, e.target.value)}>
                  {(options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </div>
          ))}
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
        <button
          type="button"
          className={'rp-footer-btn rp-footer-btn--primary' + (savedFlash ? ' is-saved' : '')}
          id="btnSaveTicket"
          onClick={handleSave}
        >
          <i className={savedFlash ? 'ti ti-check' : 'ti ti-device-floppy'} />
          {savedFlash ? 'Salvo!' : 'Salvar no ticket'}
        </button>
      </div>
    </aside>
  );
}
