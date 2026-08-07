/**
 * EspeciaisWorkflowSolicitacoesModal — drawer/modal de solicitações internas
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNotifications } from '../../../context/NotificationContext';
import { forwardEspeciaisTeamSolicitation, ESPECIAIS_WF_SOLICIT_TYPES } from '../../../services/especiais/especiaisWorkflowForwardService';
import SolicitacoesFormTab from '../../cadastral/components/SolicitacoesFormTab';
import ErrosBugsFormTab from '../../cadastral/components/ErrosBugsFormTab';
import LiberacaoPixFormTab from '../../cadastral/components/LiberacaoPixFormTab';
import ProdutosDocumentosFormTab from '../../cadastral/components/ProdutosDocumentosFormTab';
import FinanceiroSolicitacaoFormTab from '../../cadastral/components/FinanceiroSolicitacaoFormTab';

function resolveSelectionMeta(selection) {
  if (!selection) return null;
  const team = selection.team;
  const types = ESPECIAIS_WF_SOLICIT_TYPES[team] || [];
  const meta = types.find((item) => item.id === selection.typeId || item.tab === selection.tab);
  return meta ? { ...meta, team } : null;
}

export default function EspeciaisWorkflowSolicitacoesModal({
  open,
  ticket,
  initialSelection = null,
  onClose,
  onSubmitted,
}) {
  const { showNotification } = useNotifications();
  const [selection, setSelection] = useState(initialSelection);
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return undefined;
    }
    setSelection(initialSelection);
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, initialSelection, onClose]);

  const meta = useMemo(() => resolveSelectionMeta(selection), [selection]);

  const handleProdutosForward = useCallback(async (request) => {
    const ticketId = ticket?.id || ticket?._id;
    if (!ticketId) throw new Error('Ticket inválido');
    setSubmitting(true);
    try {
      const updated = await forwardEspeciaisTeamSolicitation(ticketId, {
        team: 'produtos',
        solicitacaoProdutos: request,
      });
      showNotification('Solicitação encaminhada ao time de Produtos.', 'success');
      onSubmitted?.(updated);
      onClose?.();
    } finally {
      setSubmitting(false);
    }
  }, [ticket, showNotification, onSubmitted, onClose]);

  const handleFinanceiroForward = useCallback(async (request) => {
    const ticketId = ticket?.id || ticket?._id;
    if (!ticketId) throw new Error('Ticket inválido');
    setSubmitting(true);
    try {
      const updated = await forwardEspeciaisTeamSolicitation(ticketId, {
        team: 'financeiro',
        solicitacaoFinanceiro: request,
      });
      showNotification('Solicitação encaminhada ao time Financeiro.', 'success');
      onSubmitted?.(updated);
      onClose?.();
    } finally {
      setSubmitting(false);
    }
  }, [ticket, showNotification, onSubmitted, onClose]);

  if (!open) return null;

  const renderForm = () => {
    if (!meta) {
      return (
        <div className="especiais-wf-solicit-modal__picker">
          {Object.entries(ESPECIAIS_WF_SOLICIT_TYPES).map(([team, items]) => (
            <div key={team} className="especiais-wf-solicit-modal__team">
              <h3 className={`especiais-wf-solicit-modal__team-title especiais-wf-solicit-modal__team-title--${team}`}>
                {team === 'produtos' ? 'Produtos' : 'Financeiro'}
              </h3>
              <div className="especiais-wf-solicit-modal__type-list">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`especiais-wf-solicit-modal__type-btn especiais-wf-solicit-modal__type-btn--${team}`}
                    onClick={() => setSelection({ team, typeId: item.id, tab: item.tab })}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    const formProps = {
      ticketOverride: ticket,
      onTeamForward: meta.team === 'produtos' ? handleProdutosForward : handleFinanceiroForward,
      onSubmitted: () => {},
    };

    if (meta.team === 'financeiro') {
      return (
        <FinanceiroSolicitacaoFormTab
          {...formProps}
          initialCategoria={meta.tab}
        />
      );
    }

    if (meta.tab === 'erros-bugs') return <ErrosBugsFormTab {...formProps} />;
    if (meta.tab === 'liberacao-pix') return <LiberacaoPixFormTab {...formProps} />;
    if (meta.tab === 'documentos') return <ProdutosDocumentosFormTab {...formProps} />;
    return <SolicitacoesFormTab {...formProps} />;
  };

  return createPortal(
    <div className="especiais-wf-solicit-modal" id="especiaisWorkflowSolicitModal">
      <button
        type="button"
        className={`especiais-wf-solicit-modal__backdrop${visible ? ' is-visible' : ''}`}
        aria-label="Fechar solicitações internas"
        onClick={onClose}
      />
      <aside
        className={`especiais-wf-solicit-modal__panel${visible ? ' is-visible' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Solicitações internas de workflow"
      >
        <header className="especiais-wf-solicit-modal__header">
          <div>
            <p className="especiais-wf-solicit-modal__eyebrow">Workflow interno</p>
            <h2>{meta ? meta.label : 'Nova solicitação'}</h2>
          </div>
          <button type="button" className="especiais-wf-solicit-modal__close" onClick={onClose} aria-label="Fechar">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>

        {meta ? (
          <button
            type="button"
            className="especiais-wf-solicit-modal__back"
            onClick={() => setSelection(null)}
            disabled={submitting}
          >
            <i className="ti ti-arrow-left" aria-hidden="true" />
            Voltar aos tipos
          </button>
        ) : null}

        <div className={`especiais-wf-solicit-modal__body${submitting ? ' is-busy' : ''}`}>
          {renderForm()}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
