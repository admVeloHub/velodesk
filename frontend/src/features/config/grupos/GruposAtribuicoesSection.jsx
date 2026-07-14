/**
 * GruposAtribuicoesSection v1.1.0 — grupos com agentes Desk para limitar workflows
 * VERSION: v1.1.0 | DATE: 2026-07-14
 */
import React from 'react';
import { useWorkflowConfig } from '../../../context/WorkflowConfigContext';
import GruposResponsabilidadePanel from './GruposResponsabilidadePanel';

const ATRIBUICAO_REFERENCIA = [
  {
    icon: 'ti-users-group',
    titulo: 'Grupo de responsabilidade',
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

  return (
    <div id="gruposAtribTab" className="config-section-body config-grupos-atrib">
      <GruposResponsabilidadePanel onChanged={reload} />

      <section className="grupos-atrib-info" aria-labelledby="grupos-atrib-info-title">
        <h4 id="grupos-atrib-info-title">Como os grupos limitam atuações nos workflows</h4>
        <p className="grupos-atrib-info__lead">
          Ao configurar uma etapa de workflow com atribuição &quot;Grupo de responsabilidade&quot;, o Desk
          restringe quem pode atuar naquela fila. Crie o grupo aqui, selecione os agentes permitidos e
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
