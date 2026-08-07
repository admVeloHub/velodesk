/**

 * WorkflowApprovalFooter — Feito (Produtos) ou Aprovar/Reprovar (Financeiro)

 */

import React from 'react';



const FINANCE_ACTIONS = {

  approve: { label: 'Aprovar', icon: 'ti ti-check', className: 'wf-approval-btn wf-approval-btn--approve' },

  reject: { label: 'Reprovar', icon: 'ti ti-x', className: 'wf-approval-btn wf-approval-btn--reject' },

};



export default function WorkflowApprovalFooter({

  teamId,

  awaitingDecision,

  actions = [],

  actionLabels = {},

  busy,

  onFeito,

  onApprove,

  onReject,

}) {

  const isProdutos = teamId === 'produtos';



  if (isProdutos) {

    return (

      <footer className="wf-approval-footer wf-approval-footer--produtos">

        <div className="wf-approval-footer__actions">

          <button

            type="button"

            className="wf-approval-btn wf-approval-btn--feito"

            disabled={busy}

            onClick={onFeito}

          >

            <i className="ti ti-check" aria-hidden="true" />

            Feito

          </button>

          <button

            type="button"

            className="wf-approval-btn wf-approval-btn--reject wf-approval-btn--compact"

            disabled={busy}

            onClick={onReject}

          >

            Reprovar

          </button>

        </div>

      </footer>

    );

  }



  if (!awaitingDecision) return null;



  const list = (actions.length ? actions : ['approve', 'reject']).filter((id) => FINANCE_ACTIONS[id] || actionLabels[id]);



  return (

    <footer className="wf-approval-footer">

      <span className="wf-approval-footer__hint wf-approval-footer__hint--spacer" aria-hidden="true" />

      <div className="wf-approval-footer__actions">

        {list.map((id) => {

          const cfg = FINANCE_ACTIONS[id] || {

            label: actionLabels[id] || id,

            icon: 'ti ti-circle',

            className: 'wf-approval-btn',

          };

          const handler = id === 'approve' ? onApprove : id === 'reject' ? onReject : null;

          if (!handler) return null;

          return (

            <button

              key={id}

              type="button"

              className={`${cfg.className} wf-approval-btn--compact`}

              disabled={busy}

              onClick={handler}

            >

              <i className={cfg.icon} aria-hidden="true" />

              {actionLabels[id] || cfg.label}

            </button>

          );

        })}

      </div>

    </footer>

  );

}

