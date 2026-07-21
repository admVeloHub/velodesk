/**
 * DeskConsultasPanel v1.0.0 — consulta 360° de produtos do cliente
 * VERSION: v1.0.0 | DATE: 2026-07-10 | AUTHOR: VeloHub Development Team
 */
import React, { useMemo } from 'react';
import { useTabulation } from '../../../context/TabulationContext';
import { getMotivos } from '../../../services/tabulationConfig';
import { getProductCatalogMeta } from '../../../services/desk/processDefinitions';
import {
  getClientContactFields,
  getClientProducts,
  getProductTagClass,
} from '../../../services/desk/utils';

function ProductCard({ produto, meta, motivos, isTicketProduct }) {
  return (
    <article className={'crm-consultas-product' + (isTicketProduct ? ' crm-consultas-product--active' : '')}>
      <header className="crm-consultas-product__header">
        <span className={'crm-consultas-product__tag velo-tag ' + getProductTagClass(produto)}>
          {produto}
        </span>
        {isTicketProduct ? (
          <span className="crm-consultas-product__badge">Produto do ticket</span>
        ) : null}
      </header>

      <p className="crm-consultas-product__desc">{meta.descricao}</p>

      <dl className="crm-consultas-product__meta">
        <div>
          <dt>Público-alvo</dt>
          <dd>{meta.publico}</dd>
        </div>
        <div>
          <dt>Canais de atendimento</dt>
          <dd>{(meta.canais || []).join(' · ') || '—'}</dd>
        </div>
        {motivos.length ? (
          <div>
            <dt>Motivos tabuláveis</dt>
            <dd>
              <ul className="crm-consultas-product__motivos">
                {motivos.map((motivo) => (
                  <li key={motivo}>{motivo}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

export default function DeskConsultasPanel({ ticket, client }) {
  const { config } = useTabulation();
  const contact = getClientContactFields(ticket, client);
  const products = getClientProducts(ticket, client);
  const ticketProduto = String(ticket?.lateralForm?.produto || '').trim();

  const productCards = useMemo(() => products.map((produto) => ({
    produto,
    meta: getProductCatalogMeta(produto),
    motivos: getMotivos(config, produto),
    isTicketProduct: Boolean(ticketProduto && produto === ticketProduto),
  })), [products, config, ticketProduto]);

  return (
    <div className="crm-consultas" id="deskConsultasPanel" aria-label="Consultas do cliente">
      <header className="crm-consultas__header">
        <div>
          <h2 className="crm-consultas__title">Consultas</h2>
          <p className="crm-consultas__subtitle">
            Informações de produtos vinculados a {contact.name || 'cliente'}
          </p>
        </div>
      </header>

      <section className="crm-consultas__products" aria-label="Produtos do cliente">
        <h3 className="crm-consultas__section-title">
          Produtos ({productCards.length})
        </h3>

        {productCards.length ? (
          <div className="crm-consultas__products-grid">
            {productCards.map(({ produto, meta, motivos, isTicketProduct }) => (
              <ProductCard
                key={produto}
                produto={produto}
                meta={meta}
                motivos={motivos}
                isTicketProduct={isTicketProduct}
              />
            ))}
          </div>
        ) : (
          <div className="crm-consultas__empty">
            <i className="ti ti-package-off" aria-hidden="true" />
            <p>Nenhum produto vinculado a este cliente.</p>
            <p className="crm-consultas__empty-hint">
              Classifique o ticket com um produto ou consulte o CPF para carregar o cadastro.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
