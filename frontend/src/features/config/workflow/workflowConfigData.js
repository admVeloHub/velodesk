/**
 * workflowConfigData v1.0.0 — mock visual do editor de workflows (Gestão)
 */

export const WORKFLOW_CONFIG_TABS = [
  { id: 'steps', label: 'Etapas do fluxo', icon: 'ti-list-details' },
  { id: 'slas', label: 'SLAs e prazos', icon: 'ti-clock' },
  { id: 'notifications', label: 'Notificações', icon: 'ti-bell' },
  { id: 'automations', label: 'Automações', icon: 'ti-bolt' },
];

export const TRIGGER_PATH_FIELDS = [
  { key: 'produto', label: 'Produto', placeholder: 'Ex.: Produto X' },
  { key: 'tipo', label: 'Tipo', placeholder: 'Ex.: Solicitação' },
  { key: 'motivo', label: 'Motivo', placeholder: 'Ex.: Reembolso' },
  { key: 'detalhe', label: 'Detalhe', placeholder: 'Ex.: Dentro dos 7 dias' },
];

export const WORKFLOW_CONFIG_LIST = [
  {
    id: 'reembolso-7dias',
    title: 'Reembolso dentro dos 7 dias',
    active: true,
    trigger: {
      type: 'tabulation',
      path: ['Produto X', 'Solicitação', 'Reembolso', 'Dentro dos 7 dias'],
      description: 'Este workflow é ativado automaticamente quando o atendente tabula o chamado com este caminho exato na árvore de motivos.',
    },
    steps: [
      {
        id: 'inicio',
        title: 'Início — ticket criado',
        description: 'Atendimento verifica elegibilidade e tabula o chamado.',
        icon: 'ti-player-play-filled',
        iconTone: 'start',
        badges: [
          { label: 'Grupo: Atendimento', tone: 'neutral' },
          { label: 'SLA: 15min', tone: 'sla' },
        ],
      },
      {
        id: 'aprovacao-financeiro',
        title: 'Aprovação — Financeiro',
        description: 'Financeiro analisa elegibilidade e aprova ou reprova o estorno.',
        icon: 'ti-lock',
        iconTone: 'approval',
        badges: [
          { label: 'Grupo: Financeiro', tone: 'neutral' },
          { label: 'Ação: Aprovar / Reprovar', tone: 'neutral' },
          { label: 'SLA: 4h', tone: 'sla' },
        ],
      },
      {
        id: 'processamento-estorno',
        title: 'Processamento do estorno',
        description: 'Financeiro processa o estorno no sistema de pagamentos.',
        icon: 'ti-refresh',
        iconTone: 'process',
        badges: [
          { label: 'Grupo: Financeiro', tone: 'neutral' },
          { label: 'Ação: Marcar como processado', tone: 'neutral' },
          { label: 'SLA: 24h', tone: 'sla' },
        ],
      },
      {
        id: 'retorno-atendente',
        title: 'Retorno automático ao atendente',
        description: 'Sistema retorna o ticket ao atendente original com status do estorno.',
        icon: 'ti-file-description',
        iconTone: 'auto',
        badges: [
          { label: 'Automático — sistema', tone: 'neutral' },
          { label: 'Notificar: atendente + cliente', tone: 'neutral' },
        ],
      },
      {
        id: 'comunicacao-cliente',
        title: 'Comunicação ao cliente',
        description: 'Mensagem automática ou manual confirmando o estorno ao cliente.',
        icon: 'ti-message-circle',
        iconTone: 'comms',
        badges: [
          { label: 'Canal original — WhatsApp', tone: 'neutral' },
          { label: 'Template: reembolso aprovado', tone: 'neutral' },
          { label: 'SLA: 30min', tone: 'sla' },
        ],
      },
      {
        id: 'encerramento',
        title: 'Encerramento do ticket',
        description: 'Ticket resolvido automaticamente após confirmação do cliente.',
        icon: 'ti-circle-check-filled',
        iconTone: 'done',
        badges: [
          { label: 'Automático — sistema', tone: 'neutral' },
          { label: 'CSAT: enviar pesquisa', tone: 'neutral' },
        ],
      },
    ],
  },
  {
    id: 'cancelamento',
    title: 'Cancelamento',
    active: false,
    trigger: {
      type: 'tabulation',
      path: ['Produto X', 'Solicitação', 'Cancelamento', 'Antes da entrega'],
      description: 'Ativado quando o atendente tabula o chamado com o caminho de cancelamento.',
    },
    steps: [
      {
        id: 'inicio',
        title: 'Início — ticket criado',
        description: 'Atendimento confirma motivo do cancelamento.',
        icon: 'ti-player-play-filled',
        iconTone: 'start',
        badges: [{ label: 'Grupo: Atendimento', tone: 'neutral' }],
      },
      {
        id: 'analise',
        title: 'Análise de elegibilidade',
        description: 'Verificação de prazo e condições contratuais.',
        icon: 'ti-search',
        iconTone: 'process',
        badges: [{ label: 'Grupo: Atendimento', tone: 'neutral' }, { label: 'SLA: 2h', tone: 'sla' }],
      },
      {
        id: 'encerramento',
        title: 'Encerramento',
        description: 'Confirmação ao cliente e fechamento do ticket.',
        icon: 'ti-circle-check-filled',
        iconTone: 'done',
        badges: [{ label: 'Automático — sistema', tone: 'neutral' }],
      },
    ],
  },
  {
    id: 'troca-produto',
    title: 'Troca de produto',
    active: false,
    trigger: {
      type: 'tabulation',
      path: ['Produto Y', 'Solicitação', 'Troca', 'Defeito de fábrica'],
      description: 'Ativado quando o atendente tabula solicitação de troca.',
    },
    steps: [
      {
        id: 'inicio',
        title: 'Início — ticket criado',
        description: 'Atendimento registra dados do produto e defeito.',
        icon: 'ti-player-play-filled',
        iconTone: 'start',
        badges: [{ label: 'Grupo: Atendimento', tone: 'neutral' }],
      },
      {
        id: 'logistica',
        title: 'Logística reversa',
        description: 'Agendamento de coleta e envio do novo produto.',
        icon: 'ti-truck',
        iconTone: 'process',
        badges: [{ label: 'Grupo: Logística', tone: 'neutral' }, { label: 'SLA: 48h', tone: 'sla' }],
      },
    ],
  },
  {
    id: 'escalada-n2',
    title: 'Escalada N2',
    active: false,
    trigger: {
      type: 'tabulation',
      path: ['Qualquer produto', 'Incidente', 'Escalonar', 'N2'],
      description: 'Ativado quando o atendente escala o chamado para N2.',
    },
    steps: [
      {
        id: 'inicio',
        title: 'Início — ticket criado',
        description: 'N1 documenta contexto e encaminha para N2.',
        icon: 'ti-player-play-filled',
        iconTone: 'start',
        badges: [{ label: 'Grupo: N1', tone: 'neutral' }],
      },
      {
        id: 'analise-n2',
        title: 'Análise N2',
        description: 'Equipe N2 investiga e define solução.',
        icon: 'ti-arrows-exchange',
        iconTone: 'approval',
        badges: [{ label: 'Grupo: N2', tone: 'neutral' }, { label: 'SLA: 4h', tone: 'sla' }],
      },
      {
        id: 'retorno',
        title: 'Retorno ao atendente',
        description: 'N2 devolve orientação ao N1 para comunicação ao cliente.',
        icon: 'ti-file-description',
        iconTone: 'auto',
        badges: [{ label: 'Grupo: N1', tone: 'neutral' }],
      },
    ],
  },
];

export function getWorkflowConfigById(id) {
  return WORKFLOW_CONFIG_LIST.find((wf) => wf.id === id) || WORKFLOW_CONFIG_LIST[0];
}

export function getWorkflowConfigTab(id) {
  return WORKFLOW_CONFIG_TABS.find((tab) => tab.id === id) || WORKFLOW_CONFIG_TABS[0];
}
