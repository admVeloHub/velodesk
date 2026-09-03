/**
 * ConsultaProductCard v1.1.0 — expand/collapse independente por card (controle do agente)
 * VERSION: v1.1.0 | DATE: 2026-07-31
 */
import React, { useState } from 'react';
import {
  CONSULTA_PRODUCT_LABELS,
  formatConsultaDate,
  formatConsultaDateTime,
  formatConsultaMoney,
  formatInstallmentStatus,
} from '../../../services/desk/consultaFormatters';

function ContractBlock({ contract }) {
  if (!contract) return null;
  return (
    <div className="crm-consultas-product__contract">
      <dl className="crm-consultas-product__meta">
        <div>
          <dt>Status</dt>
          <dd>{contract.contractStatusLabel || contract.contractStatus || '—'}</dd>
        </div>
        <div>
          <dt>Valor principal</dt>
          <dd>{formatConsultaMoney(contract.principal)}</dd>
        </div>
        <div>
          <dt>Total devido</dt>
          <dd>{formatConsultaMoney(contract.totalAmountDue)}</dd>
        </div>
        <div>
          <dt>Desembolso</dt>
          <dd>{formatConsultaDate(contract.disbursedAt)}</dd>
        </div>
        {contract.providerStatusLabel || contract.providerStatus ? (
          <div>
            <dt>Status do desembolso</dt>
            <dd>{contract.providerStatusLabel || contract.providerStatus}</dd>
          </div>
        ) : null}
        {contract.nextInstallment ? (
          <div>
            <dt>Próxima parcela</dt>
            <dd>
              #{contract.nextInstallment.number} · {formatConsultaDate(contract.nextInstallment.dueDate)}
              {' · '}{formatConsultaMoney(contract.nextInstallment.amountDue)}
              {' · '}{formatInstallmentStatus(contract.nextInstallment.status)}
            </dd>
          </div>
        ) : null}
      </dl>
      {Array.isArray(contract.installments) && contract.installments.length ? (
        <ul className="crm-consultas-product__installments">
          {contract.installments.slice(0, 6).map((item) => (
            <li key={`${contract.contractNumber || 'c'}-${item.number}`}>
              Parcela {item.number}: {formatConsultaMoney(item.amountDue)} · venc. {formatConsultaDate(item.dueDate)}
              {' · '}{formatInstallmentStatus(item.status)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EpAsBody({ data }) {
  const contracts = Array.isArray(data?.contracts) ? data.contracts : [];
  const eligibility = data?.eligibility;

  return (
    <>
      {contracts.length ? contracts.map((contract, index) => (
        <React.Fragment key={contract.contractNumber || contract.productType}>
          {index > 0 ? <hr className="crm-consultas-product__contract-divider" /> : null}
          <ContractBlock contract={contract} />
        </React.Fragment>
      )) : (
        <p className="crm-consultas-product__desc">Nenhum contrato ativo registrado.</p>
      )}
      {eligibility ? (
        <dl className="crm-consultas-product__meta crm-consultas-product__meta--eligibility">
          <div>
            <dt>Elegibilidade</dt>
            <dd>{eligibility.available ? 'Disponível' : 'Indisponível'}</dd>
          </div>
          {eligibility.value ? (
            <div>
              <dt>Limite</dt>
              <dd>{formatConsultaMoney(eligibility.value)}</dd>
            </div>
          ) : null}
          {eligibility.summary ? (
            <div>
              <dt>Resumo</dt>
              <dd>{eligibility.summary}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </>
  );
}

function IrpfBody({ data }) {
  const years = Array.isArray(data?.years) ? data.years : [];
  const situation = data?.situation;

  return (
    <>
      {years.length ? (
        <ul className="crm-consultas-product__years">
          {years.map((yearItem) => (
            <li key={yearItem.year}>
              <strong>{yearItem.year}</strong>
              {' · '}{yearItem.statusLabel || yearItem.status || '—'}
              {yearItem.anticipatedAmount ? (
                <> · {formatConsultaMoney(yearItem.anticipatedAmount)}</>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="crm-consultas-product__desc">Sem histórico IRPF retornado.</p>
      )}
      {situation ? (
        <dl className="crm-consultas-product__meta">
          <div>
            <dt>PIX Velobank</dt>
            <dd>{situation.pixLinkedVelobank ? 'Sim' : 'Não'}</dd>
          </div>
          <div>
            <dt>Retirada liberada</dt>
            <dd>{situation.pixWithdrawalAllowed ? 'Sim' : 'Não'}</dd>
          </div>
        </dl>
      ) : null}
    </>
  );
}

function ClubeBody({ data }) {
  const coupons = Array.isArray(data?.recentCoupons) ? data.recentCoupons : [];
  return (
    <>
      <p className="crm-consultas-product__desc">
        Total de cupons considerados: {data?.totalCoupons ?? 0}
      </p>
      {coupons.length ? (
        <ul className="crm-consultas-product__installments">
          {coupons.map((coupon, index) => (
            <li key={`${coupon.createdAt}-${index}`}>
              {formatConsultaMoney(coupon.vibes)} vibes · {formatConsultaDateTime(coupon.createdAt)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="crm-consultas-product__desc">Sem cupons recentes.</p>
      )}
    </>
  );
}

function ProductBody({ slug, entry }) {
  if (!entry?.loaded) return null;

  if (entry.status === 'customer_not_found' || entry.status === 'product_not_found') {
    return <p className="crm-consultas-product__desc">Nenhum registro encontrado para este produto.</p>;
  }

  if (!entry.data) {
    return <p className="crm-consultas-product__desc">Dados indisponíveis.</p>;
  }

  if (slug === 'emprestimo-pessoal' || slug === 'antecipacao-salario') {
    return <EpAsBody data={entry.data} />;
  }
  if (slug === 'antecipacao-irpf') {
    return <IrpfBody data={entry.data} />;
  }
  if (slug === 'clube-velotax') {
    return <ClubeBody data={entry.data} />;
  }

  return null;
}

export default function ConsultaProductCard({
  slug,
  entry,
  isTicketProduct,
  loading,
  onLoad,
}) {
  const [expanded, setExpanded] = useState(false);
  const label = CONSULTA_PRODUCT_LABELS[slug] || slug;
  const needsFetch = !entry?.loaded;

  const handleToggle = () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (needsFetch) {
      onLoad?.(slug);
    }
    setExpanded(true);
  };

  return (
    <article
      className={
        'crm-consultas-product'
        + (isTicketProduct ? ' crm-consultas-product--active' : '')
        + (expanded ? ' crm-consultas-product--expanded' : '')
      }
    >
      <header className="crm-consultas-product__header">
        <button
          type="button"
          className="crm-consultas-product__toggle"
          onClick={handleToggle}
          disabled={loading}
          aria-expanded={expanded}
        >
          <span className="crm-consultas-product__tag velo-tag velo-tag--default">{label}</span>
          {isTicketProduct ? (
            <span className="crm-consultas-product__badge">Produto do ticket</span>
          ) : null}
          <i className={'ti ' + (expanded ? 'ti-chevron-up' : 'ti-chevron-down')} aria-hidden="true" />
        </button>
      </header>

      {expanded && loading ? (
        <p className="crm-consultas-product__desc crm-consultas-product__desc--loading">
          Carregando detalhes…
        </p>
      ) : null}

      {expanded && entry?.loaded && !loading ? (
        <div className="crm-consultas-product__body">
          <ProductBody slug={slug} entry={entry} />
        </div>
      ) : null}

      {expanded && !entry?.loaded && !loading ? (
        <p className="crm-consultas-product__desc">Aguardando dados do produto.</p>
      ) : null}
    </article>
  );
}
