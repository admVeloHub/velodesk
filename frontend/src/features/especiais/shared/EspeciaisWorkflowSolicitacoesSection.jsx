/**
 * EspeciaisWorkflowSolicitacoesSection — card de solicitações internas (RA/Procon/CG)
 */
import React, { useMemo, useState } from 'react';
import {
  ESPECIAIS_WF_SOLICIT_TYPES,
  resolveTeamSolicitationFromTicket,
} from '../../../services/especiais/especiaisWorkflowForwardService';
import EspeciaisWorkflowSolicitacoesModal from './EspeciaisWorkflowSolicitacoesModal';

function formatSubmittedAt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

const ACCORDION_TEAMS = [
  { id: 'produtos', label: 'Produtos' },
  { id: 'financeiro', label: 'Financeiro' },
];

export default function EspeciaisWorkflowSolicitacoesSection({
  ticket,
  onTicketUpdated,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialSelection, setInitialSelection] = useState(null);
  const [openTeam, setOpenTeam] = useState('produtos');

  const pending = useMemo(() => resolveTeamSolicitationFromTicket(ticket), [ticket]);

  const toggleTeam = (teamId) => {
    setOpenTeam((prev) => (prev === teamId ? null : teamId));
  };

  const openModal = (selection = null) => {
    setInitialSelection(selection);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setInitialSelection(null);
  };

  const handleSubmitted = (updatedTicket) => {
    onTicketUpdated?.(updatedTicket);
    handleClose();
  };

  if (!ticket) return null;

  return (
    <>
      <section className="ra-ticket__side-card especiais-wf-solicit-card">
        <h2>SOLICITAÇÕES INTERNAS</h2>

        {pending ? (
          <div className="especiais-wf-solicit-card__pending">
            <span className={`especiais-wf-solicit-card__team especiais-wf-solicit-card__team--${pending.team}`}>
              {pending.team === 'produtos' ? 'Produtos' : 'Financeiro'}
            </span>
            <p className="especiais-wf-solicit-card__pending-label">{pending.label}</p>
            {pending.createdAt ? (
              <p className="especiais-wf-solicit-card__pending-date">
                Enviada em {formatSubmittedAt(pending.createdAt)}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="especiais-wf-solicit-card__accordion">
          {ACCORDION_TEAMS.map(({ id: team, label }) => {
            const isOpen = openTeam === team;
            return (
              <div
                key={team}
                className={`especiais-wf-solicit-card__acc-item especiais-wf-solicit-card__acc-item--${team}${isOpen ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="especiais-wf-solicit-card__acc-header"
                  aria-expanded={isOpen}
                  onClick={() => toggleTeam(team)}
                >
                  <span>{label}</span>
                  <i className={`ti ti-chevron-${isOpen ? 'up' : 'down'}`} aria-hidden="true" />
                </button>
                {isOpen ? (
                  <ul className="especiais-wf-solicit-card__acc-panel">
                    {ESPECIAIS_WF_SOLICIT_TYPES[team].map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="especiais-wf-solicit-card__acc-option"
                          onClick={() => openModal({ team, typeId: item.id, tab: item.tab })}
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="especiais-wf-solicit-card__cta"
          onClick={() => openModal(null)}
        >
          <i className="ti ti-send" aria-hidden="true" />
          Nova solicitação
        </button>
      </section>

      <EspeciaisWorkflowSolicitacoesModal
        open={modalOpen}
        ticket={ticket}
        initialSelection={initialSelection}
        onClose={handleClose}
        onSubmitted={handleSubmitted}
      />
    </>
  );
}
