/**
 * workflowDefinitions v1.2.0 — templates + etapas com decisão (aprovação)
 * VERSION: v1.2.0 | DATE: 2026-07-13 | AUTHOR: VeloHub Development Team
 */
import { ESCALONAR_OPTIONS } from './constants';

export const WORKFLOW_TEAM_LABELS = {
  n1: 'N1',
  n2: 'N2',
  financeiro: 'Financeiro',
  suporte: 'Suporte',
};

export const WORKFLOW_DECISION_ACTIONS = {
  APPROVE: 'approve',
  REJECT: 'reject',
  REQUEST_INFO: 'request_info',
};

const DECISION_REFUND_APPROVAL = {
  kind: 'approval',
  title: 'Aprovação de reembolso',
  statusLabel: 'Aguardando decisão',
  queueLabel: 'Aguardando aprovação',
  actions: ['approve', 'reject', 'request_info'],
  detailResolver: 'reembolso-7dias',
};

const DECISION_GENERIC_APPROVAL = {
  kind: 'approval',
  title: 'Aprovação pendente',
  statusLabel: 'Aguardando decisão',
  queueLabel: 'Aguardando aprovação',
  actions: ['approve', 'reject', 'request_info'],
  detailResolver: 'generic',
};

const DECISION_N2_REVIEW = {
  kind: 'approval',
  title: 'Análise N2',
  statusLabel: 'Aguardando decisão',
  queueLabel: 'Aguardando análise',
  actions: ['approve', 'reject', 'request_info'],
  detailResolver: 'generic',
};

const DECISION_SUPORTE_REVIEW = {
  kind: 'approval',
  title: 'Diagnóstico suporte',
  statusLabel: 'Aguardando decisão',
  queueLabel: 'Aguardando diagnóstico',
  actions: ['approve', 'reject', 'request_info'],
  detailResolver: 'generic',
};

const REEMBOLSO_7_DIAS_STEPS = [
  { id: 'abertura', label: 'Abertura', icon: 'ti-inbox', team: 'n1', slaHours: null },
  { id: 'elegibilidade', label: 'Elegibilidade', icon: 'ti-circle-check', team: 'n1', slaHours: 2 },
  { id: 'aprovacao-financeiro', label: 'Aprovação financeiro', icon: 'ti-building-bank', team: 'financeiro', slaHours: 4, decision: DECISION_REFUND_APPROVAL },
  { id: 'estorno-processado', label: 'Estorno processado', icon: 'ti-refresh', team: 'financeiro', slaHours: 8 },
  { id: 'retorno-cliente', label: 'Retorno ao cliente', icon: 'ti-device-desktop', team: 'n1', slaHours: 2 },
];

const FINANCEIRO_ESCALONAR_STEPS = [
  { id: 'abertura-n1', label: 'Abertura', icon: 'ti-inbox', team: 'n1', slaHours: null },
  { id: 'triagem-n1', label: 'Triagem N1', icon: 'ti-circle-check', team: 'n1', slaHours: 2 },
  { id: 'aprovacao-financeiro', label: 'Aprovação financeiro', icon: 'ti-building-bank', team: 'financeiro', slaHours: 4, decision: DECISION_REFUND_APPROVAL },
  { id: 'estorno-processado', label: 'Estorno processado', icon: 'ti-refresh', team: 'financeiro', slaHours: 8 },
  { id: 'retorno-cliente', label: 'Retorno ao cliente', icon: 'ti-device-desktop', team: 'n1', slaHours: 2 },
];

const N2_ESCALONAR_STEPS = [
  { id: 'abertura-n1', label: 'Abertura N1', icon: 'ti-inbox', team: 'n1', slaHours: null },
  { id: 'analise-n2', label: 'Análise N2', icon: 'ti-arrows-exchange', team: 'n2', slaHours: 4, decision: DECISION_N2_REVIEW },
  { id: 'retorno-cliente', label: 'Retorno ao cliente', icon: 'ti-device-desktop', team: 'n1', slaHours: 2 },
];

const SUPORTE_ESCALONAR_STEPS = [
  { id: 'abertura-n1', label: 'Abertura N1', icon: 'ti-inbox', team: 'n1', slaHours: null },
  { id: 'diagnostico-suporte', label: 'Diagnóstico suporte', icon: 'ti-tool', team: 'suporte', slaHours: 4, decision: DECISION_SUPORTE_REVIEW },
  { id: 'retorno-cliente', label: 'Retorno ao cliente', icon: 'ti-device-desktop', team: 'n1', slaHours: 2 },
];

export const WORKFLOW_TEMPLATES = [
  {
    id: 'reembolso-7dias',
    title: 'REEMBOLSO DENTRO DOS 7 DIAS',
    match: {
      tipo: 'Solicitação',
      produtoIncludes: ['produto x', 'produto x'],
      motivoIncludes: ['reembolso'],
    },
    steps: REEMBOLSO_7_DIAS_STEPS,
    defaultActiveStepId: 'aprovacao-financeiro',
    demoCompletedSteps: ['abertura', 'elegibilidade'],
  },
];

const ESCALONAR_TEMPLATE_CONFIG = {
  financeiro: {
    steps: FINANCEIRO_ESCALONAR_STEPS,
    defaultActiveStepId: 'aprovacao-financeiro',
    demoCompletedSteps: ['abertura-n1', 'triagem-n1'],
  },
  n2: {
    steps: N2_ESCALONAR_STEPS,
    defaultActiveStepId: 'analise-n2',
    demoCompletedSteps: ['abertura-n1'],
  },
  suporte: {
    steps: SUPORTE_ESCALONAR_STEPS,
    defaultActiveStepId: 'diagnostico-suporte',
    demoCompletedSteps: ['abertura-n1'],
  },
};

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesTemplate(template, fields) {
  const tipo = normalizeText(fields.tipo || fields.classificacaoTipo || fields.tipoChamado);
  const produto = normalizeText(fields.produto);
  const motivo = normalizeText(fields.motivo);
  const detalhe = normalizeText(fields.detalhe);

  if (template.match.tipo && normalizeText(template.match.tipo) !== tipo) return false;

  if (template.match.produtoIncludes?.length) {
    const produtoOk = template.match.produtoIncludes.some((needle) => produto.includes(normalizeText(needle)));
    if (!produtoOk) return false;
  }

  if (template.match.motivoIncludes?.length) {
    const motivoHaystack = `${motivo} ${detalhe}`.trim();
    const motivoOk = template.match.motivoIncludes.some((needle) => motivoHaystack.includes(normalizeText(needle)));
    if (!motivoOk) return false;
  }

  return true;
}

export function getWorkflowTemplateById(templateId) {
  const direct = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
  if (direct) return direct;
  if (templateId?.startsWith('escalonar-')) {
    return buildEscalonarWorkflowTemplate(templateId.replace('escalonar-', ''));
  }
  return null;
}

export function resolveWorkflowForTicket(ticket, rightFields = {}) {
  const lf = ticket?.lateralForm || {};
  const fields = {
    tipo: rightFields.tipo ?? lf.classificacaoTipo ?? lf.tipoChamado,
    produto: rightFields.produto ?? lf.produto,
    motivo: rightFields.motivo ?? lf.motivo,
    detalhe: rightFields.detalhe ?? lf.detalhe,
  };

  return WORKFLOW_TEMPLATES.find((template) => matchesTemplate(template, fields)) || null;
}

export function buildEscalonarWorkflowTemplate(escalonarId) {
  const option = ESCALONAR_OPTIONS.find((o) => o.id === escalonarId);
  const config = ESCALONAR_TEMPLATE_CONFIG[escalonarId];
  if (!option || !config) return null;

  const teamLabel = option.label;
  return {
    id: `escalonar-${escalonarId}`,
    title: `ENCAMINHAMENTO ${teamLabel.toUpperCase()}`,
    steps: config.steps,
    defaultActiveStepId: config.defaultActiveStepId,
    demoCompletedSteps: config.demoCompletedSteps,
  };
}

export function createWorkflowState(template, options = {}) {
  const now = options.startedAt || new Date().toISOString();
  const activeStepId = options.currentStepId || template.defaultActiveStepId || template.steps[0]?.id;
  const completed = new Set(options.completedStepIds || template.demoCompletedSteps || []);

  const stepHistory = template.steps
    .filter((step) => completed.has(step.id))
    .map((step) => ({
      stepId: step.id,
      status: 'completed',
      at: now,
      by: options.by || 'sistema',
      trigger: options.trigger || 'system',
    }));

  if (activeStepId && !completed.has(activeStepId)) {
    stepHistory.push({
      stepId: activeStepId,
      status: 'active',
      at: now,
      by: options.by || 'sistema',
      trigger: options.trigger || 'system',
    });
  }

  return {
    templateId: template.id,
    title: template.title,
    currentStepId: activeStepId,
    startedAt: now,
    stepHistory,
    status: 'active',
    systemMessageInjected: options.systemMessageInjected ?? false,
  };
}

export function getWorkflowTeamLabel(teamId) {
  return WORKFLOW_TEAM_LABELS[teamId] || teamId || 'Operação';
}

function findStepIndex(template, stepId) {
  return template.steps.findIndex((s) => s.id === stepId);
}

export function advanceWorkflowStep(workflow, template, options = {}) {
  if (!workflow || !template || workflow.status === 'completed') {
    return { workflow, advanced: false, completed: false };
  }

  const currentStepId = workflow.currentStepId || template.defaultActiveStepId;
  const currentIndex = findStepIndex(template, currentStepId);
  if (currentIndex < 0) return { workflow, advanced: false, completed: false };

  const now = options.at || new Date().toISOString();
  const by = options.by || 'sistema';
  const trigger = options.trigger || 'manual';
  const history = [...(workflow.stepHistory || [])];

  const markCompleted = (stepId) => {
    const existing = history.find((h) => h.stepId === stepId && h.status === 'completed');
    if (existing) return;
    const activeIdx = history.findIndex((h) => h.stepId === stepId && h.status === 'active');
    if (activeIdx >= 0) {
      history[activeIdx] = { ...history[activeIdx], status: 'completed', at: now, by, trigger };
    } else {
      history.push({ stepId, status: 'completed', at: now, by, trigger });
    }
  };

  markCompleted(currentStepId);

  const nextStep = template.steps[currentIndex + 1];
  if (!nextStep) {
    return {
      workflow: {
        ...workflow,
        stepHistory: history,
        status: 'completed',
        completedAt: now,
      },
      advanced: true,
      completed: true,
      previousStepId: currentStepId,
      nextStepId: null,
    };
  }

  history.push({
    stepId: nextStep.id,
    status: 'active',
    at: now,
    by,
    trigger,
  });

  return {
    workflow: {
      ...workflow,
      currentStepId: nextStep.id,
      stepHistory: history,
      status: 'active',
    },
    advanced: true,
    completed: false,
    previousStepId: currentStepId,
    nextStepId: nextStep.id,
  };
}

function isExternalTeamStep(step) {
  return step?.team && !['n1', 'agent'].includes(step.team);
}

export function evaluateWorkflowAutoAdvance(workflow, template, { statusId } = {}) {
  if (!workflow || !template || workflow.status === 'completed') {
    return { workflow, advanced: false };
  }

  const currentStepId = workflow.currentStepId || template.defaultActiveStepId;
  const currentStep = template.steps.find((s) => s.id === currentStepId);
  if (!currentStep) return { workflow, advanced: false };

  const normalizedStatus = String(statusId || '').toLowerCase();

  if (isExternalTeamStep(currentStep)) {
    if (normalizedStatus === 'pendente' || normalizedStatus === 'resolvido' || normalizedStatus === 'resolvidos') {
      return advanceWorkflowStep(workflow, template, { trigger: 'status' });
    }
    return { workflow, advanced: false };
  }

  if (normalizedStatus === 'resolvido' || normalizedStatus === 'resolvidos') {
    return advanceWorkflowStep(workflow, template, { trigger: 'status' });
  }

  return { workflow, advanced: false };
}

export function getWorkflowStepSubtitle(step, progress) {
  if (!step) return '';
  if (step.state === 'completed') return 'concluído';
  if (step.state === 'pending') return 'aguardando';
  if (step.state === 'active') {
    if (step.id === progress?.activeStep?.id && progress?.slaRemainingLabel) {
      return `${progress.slaRemainingLabel} restantes`;
    }
    return 'em análise';
  }
  return '';
}

export function buildWorkflowAdvanceMessage(template, previousStepId, nextStepId, author) {
  const prev = template.steps.find((s) => s.id === previousStepId);
  const next = nextStepId ? template.steps.find((s) => s.id === nextStepId) : null;
  const who = author || 'Sistema';
  if (!next) {
    return `Workflow **${template.title}** concluído por ${who} após a etapa "${prev?.label || previousStepId}".`;
  }
  return `Etapa **${prev?.label || previousStepId}** concluída por ${who}. Próxima etapa: **${next.label}**.`;
}

export function stepRequiresDecision(step) {
  return Boolean(step?.decision?.actions?.length);
}

export function getDecisionStepsForTemplate(template) {
  if (!template?.steps) return [];
  return template.steps.filter(stepRequiresDecision);
}

export function resolveApprovalHeader(ticket, progress) {
  const decision = progress?.activeStep?.decision;
  const lf = ticket?.lateralForm || {};
  return {
    title: decision?.title || progress?.activeStep?.label || 'Decisão pendente',
    statusLabel: decision?.statusLabel || 'Aguardando decisão',
    queueLabel: decision?.queueLabel || 'Aguardando aprovação',
    actions: decision?.actions || ['approve', 'reject', 'request_info'],
    detailResolver: decision?.detailResolver || 'generic',
    subtitle: lf.produto && lf.motivo
      ? `${lf.motivo} · ${lf.produto}`
      : (ticket?.title || ''),
  };
}

export function ticketAwaitingDecision(ticket, progress) {
  if (!progress || progress.workflow?.status === 'completed' || progress.workflow?.status === 'rejected') {
    return false;
  }
  return stepRequiresDecision(progress.activeStep);
}
