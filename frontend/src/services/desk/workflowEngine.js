/**
 * workflowEngine v1.5.0 — motor de workflow a partir de definições persistidas
 * VERSION: v1.5.0 | DATE: 2026-07-14
 */
import { getRuntimeGrupos, getRuntimeWorkflows } from './workflowRuntimeStore';

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

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function readFields(ticket, rightFields = {}) {
  const lf = ticket?.lateralForm || {};
  const integracao = lf.integracao || lf.metadados?.integracao || {};
  return {
    tipoChamado: rightFields.tipo ?? lf.classificacaoTipo ?? lf.tipoChamado ?? '',
    tipo: rightFields.tipo ?? lf.classificacaoTipo ?? lf.tipoChamado ?? '',
    produto: rightFields.produto ?? lf.produto ?? '',
    motivo: rightFields.motivo ?? lf.motivo ?? '',
    detalhe: rightFields.detalhe ?? lf.detalhe ?? '',
    responsavel: rightFields.responsavel ?? lf.responsavel ?? '',
    atribuido: rightFields.atribuido ?? lf.atribuido ?? '',
    statusPagamento: rightFields.statusPagamento ?? integracao.statusPagamento ?? lf.statusPagamento ?? '',
    dataContratacao: rightFields.dataContratacao ?? integracao.dataContratacao ?? integracao.dataContratacaoFaixa ?? lf.dataContratacao ?? '',
    statusContrato: rightFields.statusContrato ?? integracao.statusContrato ?? lf.statusContrato ?? '',
  };
}

function evaluateOperator(actual, operador, valor) {
  const haystack = normalizeText(actual);
  const needle = normalizeText(valor);
  switch (operador) {
    case 'equals':
      return haystack === needle;
    case 'contains':
      return needle ? haystack.includes(needle) : false;
    case 'not_empty':
      return haystack.length > 0;
    case 'in':
      return String(valor || '').split(',').map(normalizeText).filter(Boolean)
        .some((item) => haystack.includes(item) || haystack === item);
    default:
      return false;
  }
}

function readTabulationValue(fields, campo) {
  const key = normalizeText(campo).replace(/_/g, '');
  const map = {
    tipochamado: fields.tipoChamado,
    tipo: fields.tipoChamado,
    produto: fields.produto,
    motivo: fields.motivo,
    detalhe: fields.detalhe,
    responsavel: fields.responsavel,
    atribuido: fields.atribuido,
  };
  return map[key] ?? fields[campo] ?? '';
}

function readIntegracaoValue(fields, campo) {
  const key = normalizeText(campo).replace(/_/g, '');
  const map = {
    statuspagamento: fields.statusPagamento,
    datacontratacao: fields.dataContratacao,
    statuscontrato: fields.statusContrato,
  };
  return map[key] ?? fields[campo] ?? '';
}

export function evaluateCriterios(criterios = [], fields, grupos = getRuntimeGrupos()) {
  if (!criterios.length) return true;
  return criterios.every((criterio) => {
    if (criterio.fonte === 'grupo_responsabilidade') {
      const slug = criterio.campo || criterio.valor;
      const grupo = grupos.find((g) => g.slug === slug);
      if (!grupo) return false;
      const atribuido = normalizeText(fields.atribuido);
      const responsavel = normalizeText(fields.responsavel);
      return (grupo.membros || []).some((m) => {
        const val = normalizeText(m.valor);
        return val && (atribuido.includes(val) || responsavel.includes(val) || atribuido === val);
      });
    }
    if (criterio.fonte === 'integracao') {
      const actual = readIntegracaoValue(fields, criterio.campo);
      return evaluateOperator(actual, criterio.operador, criterio.valor);
    }
    const actual = readTabulationValue(fields, criterio.campo);
    return evaluateOperator(actual, criterio.operador, criterio.valor);
  });
}

/** Gatilho sem critérios nunca ativa o workflow */
export function evaluateGatilhoCriterios(criterios = [], fields, grupos = getRuntimeGrupos()) {
  if (!criterios.length) return false;
  return evaluateCriterios(criterios, fields, grupos);
}

function buildDecisionFromPasso(passoConfig, slug) {
  if (passoConfig?.acao?.tipo !== 'aprovacao') return null;
  const rotas = passoConfig.acao.rotas || [];
  return {
    kind: 'approval',
    title: passoConfig.nome || 'Aprovação pendente',
    statusLabel: 'Aguardando decisão',
    queueLabel: 'Aguardando aprovação',
    actions: rotas.map((r) => r.variavel).filter(Boolean),
    detailResolver: slug === 'reembolso-7dias' ? 'reembolso-7dias' : 'generic',
    rotas,
  };
}

function getTeamFromAtribuicao(atribuicao) {
  if (!atribuicao) return 'n1';
  if (atribuicao.tipo === 'grupo') return atribuicao.grupoSlug || 'n1';
  if (atribuicao.tipo === 'colaborador') return 'n1';
  return 'n1';
}

export function normalizeWorkflowDef(definicao) {
  if (!definicao) return null;
  const passos = [...(definicao.passos || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const defaultActiveStepId = String(
    definicao.passoInicialId
    || passos[0]?._id
    || '',
  );

  const steps = passos.map((envelope) => {
    const cfg = envelope.passo || {};
    const stepId = String(envelope._id);
    return {
      id: stepId,
      label: cfg.nome || 'Etapa',
      icon: cfg.icone || 'ti-circle',
      team: getTeamFromAtribuicao(cfg.atribuicao),
      slaHours: cfg.slaHoras ?? null,
      description: cfg.descricao || '',
      atribuicao: cfg.atribuicao,
      acao: cfg.acao,
      criterios: cfg.criterios || [],
      passoEnvelope: envelope,
      decision: buildDecisionFromPasso(cfg, definicao.slug),
    };
  });

  return {
    id: definicao.slug,
    definicaoId: definicao._id,
    title: definicao.titulo || definicao.slug,
    description: definicao.descricao || '',
    gatilho: definicao.gatilho,
    passosEnvelope: passos,
    steps,
    defaultActiveStepId,
    demoCompletedSteps: [],
    raw: definicao,
  };
}

export function getWorkflowTemplateById(templateId, definitions = getRuntimeWorkflows()) {
  const slug = String(templateId || '').trim();
  const def = definitions.find((d) => d.slug === slug || String(d._id) === slug);
  if (def) return normalizeWorkflowDef(def);

  if (slug.startsWith('escalonar-')) {
    return buildEscalonarWorkflowTemplate(slug.replace('escalonar-', ''));
  }
  return null;
}

export function resolveWorkflowForTicket(ticket, rightFields = {}, definitions = getRuntimeWorkflows()) {
  const fields = readFields(ticket, rightFields);
  const match = definitions.find((def) => evaluateGatilhoCriterios(def.gatilho?.criterios || [], fields));
  return match ? normalizeWorkflowDef(match) : null;
}


export function buildEscalonarWorkflowTemplate(escalonarId) {
  const slug = `escalonar-${escalonarId}`;
  const def = getRuntimeWorkflows().find((d) => d.slug === slug);
  if (def) return normalizeWorkflowDef(def);
  return null;
}

export function resolveAtribuidoForStep(step, fields = {}) {
  const atribuicao = step?.atribuicao || step?.passoEnvelope?.passo?.atribuicao;
  if (!atribuicao) return '';
  switch (atribuicao.tipo) {
    case 'colaborador':
      return String(atribuicao.colaborador || '').trim();
    case 'grupo':
      return atribuicao.grupoSlug ? `grupo:${atribuicao.grupoSlug}` : '';
    case 'responsavel_ticket':
      return String(fields.responsavel || '').trim();
    default:
      return '';
  }
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
    definicaoSlug: template.id,
    definicaoId: template.definicaoId,
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

function resolveNextStepId(template, currentStepId, rota) {
  if (rota?.proximoPassoId) {
    const target = String(rota.proximoPassoId);
    if (template.steps.some((s) => s.id === target)) return target;
  }
  const currentIndex = findStepIndex(template, currentStepId);
  return template.steps[currentIndex + 1]?.id || null;
}

export function advanceWorkflowByDecision(workflow, template, variavel, options = {}) {
  if (!workflow || !template || workflow.status === 'completed') {
    return { workflow, advanced: false, completed: false };
  }

  const currentStepId = workflow.currentStepId || template.defaultActiveStepId;
  const currentStep = template.steps.find((s) => s.id === currentStepId);
  const rotas = currentStep?.acao?.rotas || currentStep?.decision?.rotas || [];
  const rota = rotas.find((r) => r.variavel === variavel);

  const now = options.at || new Date().toISOString();
  const by = options.by || 'sistema';
  const trigger = options.trigger || `decision-${variavel}`;
  const history = [...(workflow.stepHistory || [])];

  const markCompleted = (stepId, extra = {}) => {
    const activeIdx = history.findIndex((h) => h.stepId === stepId && h.status === 'active');
    if (activeIdx >= 0) {
      history[activeIdx] = { ...history[activeIdx], status: 'completed', at: now, by, trigger, variavel, ...extra };
    } else {
      history.push({ stepId, status: 'completed', at: now, by, trigger, variavel, ...extra });
    }
  };

  markCompleted(currentStepId, { decision: variavel === 'approve' ? 'approved' : variavel });

  const nextStepId = resolveNextStepId(template, currentStepId, rota);
  if (!nextStepId) {
    return {
      workflow: { ...workflow, stepHistory: history, status: 'completed', completedAt: now },
      advanced: true,
      completed: true,
      previousStepId: currentStepId,
      nextStepId: null,
      statusTicket: rota?.statusTicket || null,
    };
  }

  history.push({ stepId: nextStepId, status: 'active', at: now, by, trigger, variavel });
  const nextStep = template.steps.find((s) => s.id === nextStepId);

  return {
    workflow: { ...workflow, currentStepId: nextStepId, stepHistory: history, status: 'active' },
    advanced: true,
    completed: false,
    previousStepId: currentStepId,
    nextStepId,
    nextStep,
    statusTicket: rota?.statusTicket || null,
  };
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
    const activeIdx = history.findIndex((h) => h.stepId === stepId && h.status === 'active');
    if (activeIdx >= 0) {
      history[activeIdx] = { ...history[activeIdx], status: 'completed', at: now, by, trigger };
    } else if (!history.find((h) => h.stepId === stepId && h.status === 'completed')) {
      history.push({ stepId, status: 'completed', at: now, by, trigger });
    }
  };

  markCompleted(currentStepId);

  const nextStep = template.steps[currentIndex + 1];
  if (!nextStep) {
    return {
      workflow: { ...workflow, stepHistory: history, status: 'completed', completedAt: now },
      advanced: true,
      completed: true,
      previousStepId: currentStepId,
      nextStepId: null,
    };
  }

  history.push({ stepId: nextStep.id, status: 'active', at: now, by, trigger });

  return {
    workflow: { ...workflow, currentStepId: nextStep.id, stepHistory: history, status: 'active' },
    advanced: true,
    completed: false,
    previousStepId: currentStepId,
    nextStepId: nextStep.id,
    nextStep,
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
  return step?.acao?.tipo === 'aprovacao' || Boolean(step?.decision?.actions?.length);
}

export function resolveApprovalHeader(ticket, progress) {
  const decision = progress?.activeStep?.decision;
  const lf = ticket?.lateralForm || {};
  const rotas = progress?.activeStep?.acao?.rotas || decision?.rotas || [];
  return {
    title: decision?.title || progress?.activeStep?.label || 'Decisão pendente',
    statusLabel: decision?.statusLabel || 'Aguardando decisão',
    queueLabel: decision?.queueLabel || 'Aguardando aprovação',
    actions: rotas.length ? rotas.map((r) => r.variavel) : (decision?.actions || ['approve', 'reject', 'request_info']),
    rotas,
    detailResolver: decision?.detailResolver || 'generic',
    subtitle: lf.produto && lf.motivo ? `${lf.motivo} · ${lf.produto}` : (ticket?.title || ''),
  };
}

export function ticketAwaitingDecision(ticket, progress) {
  if (!progress || progress.workflow?.status === 'completed' || progress.workflow?.status === 'rejected') {
    return false;
  }
  return stepRequiresDecision(progress.activeStep);
}

export function applyAtribuidoForActiveStep(ticket, template, stepId) {
  if (!ticket || !template) return ticket;
  const step = template.steps.find((s) => s.id === stepId);
  if (!step) return ticket;
  const lf = ticket.lateralForm || {};
  const fields = readFields(ticket);
  const atribuido = resolveAtribuidoForStep(step, fields);
  ticket.lateralForm = { ...lf, atribuido };
  return ticket;
}
