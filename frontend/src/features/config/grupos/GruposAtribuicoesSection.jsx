/**
 * GruposAtribuicoesSection v1.2.0 — hub Lista de Agentes + Grupos de Atuação
 * VERSION: v1.2.0 | DATE: 2026-07-15 | AUTHOR: VeloHub Development Team
 */
import React, { useState } from 'react';
import { useWorkflowConfig } from '../../../context/WorkflowConfigContext';
import GruposResponsabilidadePanel from './GruposResponsabilidadePanel';
import ListaAgentesPanel from './ListaAgentesPanel';

const HUB_CARDS = [
  {
    id: 'lista-agentes',
    icon: 'ti-users',
    titulo: 'Lista de Agentes',
    descricao: 'Colaboradores com acesso ao Desk (acessos.Desk). Pool para montar os grupos de atuação.',
  },
  {
    id: 'grupos-atuacao',
    icon: 'ti-users-group',
    titulo: 'Grupos de Atuação',
    descricao: 'Defina grupos a partir da lista de agentes e use-os nas etapas de workflow.',
  },
];

const ATRIBUICAO_REFERENCIA = [
  {
    icon: 'ti-users-group',
    titulo: 'Grupo de atuação',
    descricao: 'A etapa do workflow é atribuída ao slug do grupo. Apenas os agentes cadastrados nesse grupo podem executar ou decidir ações na fila.',
  },
  {
    icon: 'ti-user',
    titulo: 'Colaborador específico',
    descricao: 'Atribui a etapa diretamente a um agente informado na configuração da etapa do workflow.',
  },
  {
    icon: 'ti-headset',
    titulo: 'Responsável do ticket',
    descricao: 'Mantém o responsável atual do chamado como atribuído da etapa.',
  },
  {
    icon: 'ti-robot',
    titulo: 'Sistema (automático)',
    descricao: 'Etapa processada automaticamente, sem atribuição manual a um agente.',
  },
];

export default function GruposAtribuicoesSection() {
  const { reload } = useWorkflowConfig();
  const [panel, setPanel] = useState(null);

  const activeCard = HUB_CARDS.find((c) => c.id === panel) || null;

  if (panel === 'lista-agentes') {
    return (
      <div id="gruposAtribTab" className="config-section-body config-grupos-atrib">
        <div className="grupos-atrib-hub__nav">
          <button type="button" className="config-action-btn" onClick={() => setPanel(null)}>
            <i className="ti ti-arrow-left" aria-hidden="true" />
            Voltar
          </button>
          <h4 className="grupos-atrib-hub__panel-title">{activeCard?.titulo}</h4>
        </div>
        <ListaAgentesPanel />
      </div>
    );
  }

  if (panel === 'grupos-atuacao') {
    return (
      <div id="gruposAtribTab" className="config-section-body config-grupos-atrib">
        <div className="grupos-atrib-hub__nav">
          <button type="button" className="config-action-btn" onClick={() => setPanel(null)}>
            <i className="ti ti-arrow-left" aria-hidden="true" />
            Voltar
          </button>
          <h4 className="grupos-atrib-hub__panel-title">{activeCard?.titulo}</h4>
        </div>
        <GruposResponsabilidadePanel onChanged={reload} />
        <section className="grupos-atrib-info" aria-labelledby="grupos-atrib-info-title">
          <h4 id="grupos-atrib-info-title">Como os grupos limitam atuações nos workflows</h4>
          <p className="grupos-atrib-info__lead">
            Ao configurar uma etapa de workflow com atribuição &quot;Grupo de responsabilidade&quot;, o Desk
            restringe quem pode atuar naquela fila. Crie o grupo aqui, selecione os agentes da lista e
            use o slug do grupo na etapa correspondente.
          </p>
          <ul className="grupos-atrib-info__list">
            {ATRIBUICAO_REFERENCIA.map((item) => (
              <li key={item.titulo} className="grupos-atrib-info__item">
                <span className="grupos-atrib-info__icon" aria-hidden="true">
                  <i className={'ti ' + item.icon} />
                </span>
                <div>
                  <strong>{item.titulo}</strong>
                  <p>{item.descricao}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div id="gruposAtribTab" className="config-section-body config-grupos-atrib">
      <p className="grupos-atrib-hub__lead">
        Gerencie o pool de agentes com acesso ao Desk e monte os grupos de atuação usados nas etapas de workflow.
      </p>
      <div className="grupos-atrib-hub__grid" role="list">
        {HUB_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            className="grupos-atrib-hub__card"
            role="listitem"
            onClick={() => setPanel(card.id)}
          >
            <span className="grupos-atrib-hub__card-icon" aria-hidden="true">
              <i className={'ti ' + card.icon} />
            </span>
            <span className="grupos-atrib-hub__card-body">
              <strong>{card.titulo}</strong>
              <span>{card.descricao}</span>
            </span>
            <i className="ti ti-chevron-right grupos-atrib-hub__card-chevron" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
