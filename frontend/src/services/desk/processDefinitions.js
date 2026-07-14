/**
 * processDefinitions v1.1.0 — catálogo local de POPs / processos operacionais por produto
 * VERSION: v1.1.0 | DATE: 2026-07-10 | AUTHOR: VeloHub Development Team
 */
import { getDetalhes, getMotivos } from '../tabulationConfig';
import { getWorkflowTeamLabel } from './workflowDefinitions';
import { getRuntimeWorkflows } from './workflowRuntimeStore';
import { evaluateGatilhoCriterios, normalizeWorkflowDef } from './workflowEngine';

function optionKey(motivo, detalhe) {
  return `${motivo}::${detalhe || motivo}`;
}

/** Lista opções de detalhe (motivo + detalhe) para um produto da tabulação ativa */
export function getDetalheOptionsForProduto(config, produto) {
  const name = String(produto || '').trim();
  if (!name) return [];

  const motivos = getMotivos(config, name);
  const options = [];

  motivos.forEach((motivo) => {
    const detalhes = getDetalhes(config, name, motivo);
    if (detalhes.length === 0) {
      options.push({
        id: optionKey(motivo, ''),
        label: motivo,
        motivo,
        detalhe: '',
      });
      return;
    }
    detalhes.forEach((detalhe) => {
      options.push({
        id: optionKey(motivo, detalhe),
        label: detalhe === motivo ? motivo : `${motivo} — ${detalhe}`,
        motivo,
        detalhe,
      });
    });
  });

  return options;
}

const PRODUCT_CATALOG = {
  'Produto X': {
    descricao: 'Assinatura digital do Produto X — planos mensais e anuais com direito a arrependimento em até 7 dias corridos (CDC).',
    publico: 'Clientes pessoa física com contrato ativo ou cancelado há menos de 30 dias.',
    canais: ['Portal', 'WhatsApp', 'E-mail', 'Telefone'],
  },
  'Internet Fibra': {
    descricao: 'Serviço de banda larga fibra óptica residencial e empresarial com SLA de disponibilidade e suporte técnico N1.',
    publico: 'Assinantes com CPE (modem/ONT) instalado e contrato vigente.',
    canais: ['WhatsApp', 'Telefone', 'Portal'],
  },
  TV: {
    descricao: 'Pacotes de TV por assinatura (canais abertos, premium e streaming parceiro).',
    publico: 'Assinantes com decoder ou app TV vinculado ao contrato.',
    canais: ['WhatsApp', 'Telefone', 'Portal'],
  },
  Telefone: {
    descricao: 'Telefonia fixa e serviços de valor agregado vinculados à linha.',
    publico: 'Assinantes com linha ativa ou fatura em aberto.',
    canais: ['Telefone', 'WhatsApp', 'E-mail'],
  },
  Combo: {
    descricao: 'Pacote combinado Internet + TV + Telefone com fatura unificada.',
    publico: 'Assinantes combo com contrato vigente.',
    canais: ['WhatsApp', 'Telefone', 'Portal'],
  },
};

const PROCESS_INFO_BY_KEY = {
  'Produto X::Reembolso::Dentro de 7 dias': {
    title: 'Reembolso dentro de 7 dias — Produto X',
    tipo: 'Solicitação',
    workflow: 'REEMBOLSO DENTRO DOS 7 DIAS',
    sla: '4h — aprovação financeiro · 8h — estorno · 2h — retorno N1',
    responsavel: 'Equipe Financeiro (aprovação) · N1 (retorno ao cliente)',
    resumo: 'Estorno integral da assinatura quando a solicitação ocorre dentro do prazo legal de 7 dias corridos após a compra ou renovação.',
    sobreDetalhe: 'Aplica-se a primeira contratação ou renovação automática contestada pelo cliente dentro da janela de arrependimento. Valor devolvido pelo mesmo meio de pagamento original.',
    elegibilidade: [
      'Compra ou renovação há no máximo 7 dias corridos.',
      'Cliente não utilizou benefícios exclusivos irreversíveis (ex.: consultoria já consumida).',
      'Pagamento identificado no sistema (cartão, PIX ou boleto compensado).',
    ],
    documentos: [
      'Protocolo do ticket e comprovante de pagamento.',
      'Print da área logada com data da contratação (se disponível).',
      'Dados bancários apenas se estorno via PIX/transferência for necessário.',
    ],
    passos: [
      'Confirmar identidade do titular (CPF + e-mail cadastrado).',
      'Validar data da transação no ERP e calcular dias corridos.',
      'Classificar: Solicitação · Produto X · Reembolso · Dentro de 7 dias.',
      'Registrar elegibilidade e acionar workflow de reembolso.',
      'Aguardar aprovação financeira — não prometer prazo de crédito ao cliente.',
      'Após estorno confirmado, registrar retorno ao cliente com número da transação.',
    ],
    comunicacaoCliente: 'Informe que a solicitação foi registrada e encaminhada ao financeiro. Prazo de retorno: até 5 dias úteis para aparecer na fatura ou extrato, conforme operadora do cartão.',
    workflowEtapas: [
      'Elegibilidade N1 → Aprovação Financeiro → Estorno processado → Retorno ao cliente',
    ],
    restricoes: [
      'Não confirmar estorno antes da aprovação financeira.',
      'Não aplicar desconto retencionista sem autorização comercial.',
    ],
    observacoes: 'Com workflow ativo, compose público fica restrito até liberação do financeiro.',
  },
  'Produto X::Reembolso::Fora do prazo': {
    title: 'Reembolso fora do prazo — Produto X',
    tipo: 'Solicitação',
    sla: '24h — análise N2',
    responsavel: 'N2 / Retenção',
    resumo: 'Análise excepcional para pedidos após 7 dias. Decisão caso a caso conforme política comercial.',
    sobreDetalhe: 'Cliente solicita devolução após o prazo legal. Avaliar goodwill, uso do produto e histórico de chargebacks.',
    elegibilidade: [
      'Verificar se há decisão comercial prévia para o CPF.',
      'Confirmar se não houve fraude ou uso abusivo.',
    ],
    documentos: ['Histórico de tickets', 'Extrato de uso', 'Gravação ou chat se canal telefone'],
    passos: [
      'Documentar motivo do pedido tardio.',
      'Consultar N2 antes de qualquer promessa.',
      'Oferecer alternativas: crédito, pausa ou downgrade.',
    ],
    comunicacaoCliente: 'Explique que o prazo legal expirou e que o caso será analisado pela equipe especializada em até 24h.',
    restricoes: ['Não aprovar estorno unilateralmente no N1.'],
    observacoes: 'Registrar tentativa de retenção no ticket.',
  },
  'Internet Fibra::Lentidão::Em análise': {
    title: 'Lentidão — Internet Fibra',
    tipo: 'Reclamação',
    sla: '8h — diagnóstico · 24h — visita técnica se necessário',
    responsavel: 'Suporte N1 · Field Service (se escalar)',
    resumo: 'Diagnóstico remoto de performance abaixo do plano contratado.',
    sobreDetalhe: 'Queixa de velocidade inferior à contratada ou instabilidade em horários específicos.',
    elegibilidade: ['Contrato ativo', 'ONT online nos últimos 15 min ou justificativa de queda'],
    documentos: ['Resultado speed test (speedtest.net)', 'Foto do modem/ONT', 'Horário dos testes'],
    passos: [
      'Confirmar plano e velocidade nominal (download/upload).',
      'Verificar status ONT/OLT no sistema.',
      'Orientar reinício do equipamento e teste via cabo Ethernet.',
      'Se persistir, abrir OS técnica com slot disponível.',
    ],
    comunicacaoCliente: 'Peça teste com cabo direto no modem e envio do print. Informe SLA de visita se necessário.',
    restricoes: ['Não agendar visita sem checklist N1 completo.'],
    observacoes: 'Registrar MAC/serial do CPE no ticket.',
  },
  'TV::Cancelamento::Em análise': {
    title: 'Cancelamento — TV',
    tipo: 'Solicitação',
    sla: '4h — retenção · 48h — efetivação cancelamento',
    responsavel: 'Retenção / N1',
    resumo: 'Fluxo de cancelamento com script de retenção obrigatório.',
    sobreDetalhe: 'Cliente deseja encerrar pacote TV ou canais premium.',
    elegibilidade: ['Contrato TV ativo', 'Sem pendência financeira grave'],
    documentos: ['Motivo declarado', 'Ofertas apresentadas (registrar no ticket)'],
    passos: [
      'Aplicar script de retenção (downgrade, desconto temporário).',
      'Se mantiver cancelamento, informar multa fidelidade se houver.',
      'Encaminhar ao backoffice para baixa no billing.',
    ],
    comunicacaoCliente: 'Confirme compreensão sobre prazo de corte e equipamentos a devolver.',
    restricoes: ['Duas tentativas de retenção antes de cancelar.'],
    observacoes: 'Anexar gravação quando canal telefone.',
  },
  'Telefone::Financeiro::Em análise': {
    title: 'Financeiro — Telefone',
    tipo: 'Solicitação',
    sla: '4h — financeiro',
    responsavel: 'Equipe Financeiro',
    resumo: 'Contestação de cobrança, duplicidade ou valores divergentes.',
    sobreDetalhe: 'Inclui cobrança duplicada, serviços não contratados ou falha de desconto.',
    elegibilidade: ['Fatura identificada', 'Cliente titular ou autorizado'],
    documentos: ['Fatura PDF', 'Comprovante pagamento', 'Extrato cartão se aplicável'],
    passos: [
      'Conferir itens faturados vs. contrato.',
      'Abrir contestação no billing se divergência comprovada.',
      'Informar protocolo financeiro ao cliente.',
    ],
    comunicacaoCliente: 'Prazo de análise: até 3 dias úteis. Estorno na próxima fatura se procedente.',
    restricoes: ['Não estornar sem parecer financeiro.'],
    observacoes: 'Vincular ticket ao protocolo financeiro externo.',
  },
};

function findWorkflowForFields(produto, motivo, detalhe) {
  const fields = {
    produto: produto || '',
    motivo: motivo || '',
    detalhe: detalhe || '',
    tipoChamado: 'Solicitação',
    tipo: 'Solicitação',
  };
  const def = getRuntimeWorkflows().find((w) => evaluateGatilhoCriterios(w.gatilho?.criterios || [], fields));
  return def ? normalizeWorkflowDef(def) : null;
}

function buildGenericProcessInfo(produto, option) {
  const workflow = findWorkflowForFields(produto, option.motivo, option.detalhe);
  const productMeta = PRODUCT_CATALOG[produto] || {
    descricao: `Produto ${produto} — consulte a base de POPs para descrição comercial completa.`,
    publico: 'Clientes com contrato vinculado ao produto.',
    canais: ['WhatsApp', 'Telefone', 'Portal', 'E-mail'],
  };

  const workflowEtapas = workflow?.steps?.map(
    (step) => `${step.label}${step.slaHours ? ` (SLA ${step.slaHours}h · ${getWorkflowTeamLabel(step.team)})` : ''}`,
  );

  return {
    title: `${produto} — ${option.label}`,
    tipo: workflow?.match?.tipo || 'Solicitação',
    workflow: workflow?.title || null,
    sla: workflow ? 'Conforme etapas do workflow vinculado' : 'Consultar POP do produto',
    responsavel: workflow ? 'Conforme etapa ativa' : 'N1',
    resumo: `Procedimento operacional padrão para atendimentos de ${produto} classificados como ${option.label}.`,
    produtoDescricao: productMeta.descricao,
    publicoAlvo: productMeta.publico,
    canaisAtendimento: productMeta.canais,
    sobreDetalhe: `Detalhe selecionado: ${option.detalhe || option.motivo}. Motivo de tabulação: ${option.motivo}. Seguir POP específico na base de conhecimento.`,
    elegibilidade: [
      'Cliente identificado e titular do contrato.',
      'Produto e motivo coerentes com a demanda registrada no ticket.',
    ],
    documentos: [
      'Protocolo do chamado.',
      'Evidências enviadas pelo cliente (prints, comprovantes).',
    ],
    passos: workflowEtapas || [
      `Classificar: tipo adequado · ${produto} · ${option.motivo}${option.detalhe ? ` · ${option.detalhe}` : ''}.`,
      'Consultar POP na base de conhecimento (file_search / Central de Config).',
      'Executar procedimento e registrar cada ação no histórico do ticket.',
      'Encerrar ou escalonar conforme POP.',
    ],
    comunicacaoCliente: 'Utilize tom empático e confirme entendimento antes de encerrar. Informe próximos passos e prazos conforme POP.',
    restricoes: ['Não inventar prazos ou valores não previstos no POP.'],
    observacoes: 'Conteúdo genérico — complementar com POP oficial quando disponível.',
  };
}

function enrichWithProductCatalog(info, produto) {
  const productMeta = PRODUCT_CATALOG[produto];
  if (!productMeta) return info;
  return {
    ...info,
    produtoDescricao: info.produtoDescricao || productMeta.descricao,
    publicoAlvo: info.publicoAlvo || productMeta.publico,
    canaisAtendimento: info.canaisAtendimento || productMeta.canais,
  };
}

export function getProcessoInfo(produto, detalheOption) {
  if (!produto || !detalheOption) return null;
  const key = optionKey(detalheOption.motivo, detalheOption.detalhe);
  const specific = PROCESS_INFO_BY_KEY[`${produto}::${key}`];
  const base = specific
    ? { ...specific, produto, motivo: detalheOption.motivo, detalhe: detalheOption.detalhe }
    : {
      ...buildGenericProcessInfo(produto, detalheOption),
      produto,
      motivo: detalheOption.motivo,
      detalhe: detalheOption.detalhe,
    };
  return enrichWithProductCatalog(base, produto);
}

/** Metadados comerciais / operacionais do catálogo local por produto */
export function getProductCatalogMeta(produto) {
  const name = String(produto || '').trim();
  if (!name) return null;
  return PRODUCT_CATALOG[name] || {
    descricao: `Produto ${name} — consulte a base de POPs para descrição comercial completa.`,
    publico: 'Clientes com contrato vinculado ao produto.',
    canais: ['WhatsApp', 'Telefone', 'Portal', 'E-mail'],
  };
}
