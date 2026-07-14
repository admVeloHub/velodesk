/** workflowMatcher v1.3.0 — avaliação de critérios de gatilho e passo */
import type { IGrupoResponsabilidade } from '../models/GrupoResponsabilidade';
import type { IWorkflowCriterio } from '../models/WorkflowDefinicao';

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function readTabulationField(
  fields: Record<string, string>,
  campo: string,
): string {
  const map: Record<string, string> = {
    tipochamado: fields.tipoChamado || fields.tipo || '',
    tipo: fields.tipoChamado || fields.tipo || '',
    produto: fields.produto || '',
    motivo: fields.motivo || '',
    detalhe: fields.detalhe || '',
    responsavel: fields.responsavel || '',
    atribuido: fields.atribuido || '',
  };
  return map[normalize(campo).replace(/_/g, '')] ?? fields[campo] ?? '';
}

function readIntegracaoField(
  fields: Record<string, string>,
  campo: string,
): string {
  const map: Record<string, string> = {
    statuspagamento: fields.statusPagamento || '',
    datacontratacao: fields.dataContratacao || '',
    statuscontrato: fields.statusContrato || '',
  };
  return map[normalize(campo).replace(/_/g, '')] ?? fields[campo] ?? '';
}

function evaluateOperator(actual: string, operador: string, valor: string): boolean {
  const haystack = normalize(actual);
  const needle = normalize(valor);

  switch (operador) {
    case 'equals':
      return haystack === needle;
    case 'contains':
      return needle ? haystack.includes(needle) : false;
    case 'not_empty':
      return haystack.length > 0;
    case 'in': {
      const options = String(valor || '')
        .split(',')
        .map((item) => normalize(item))
        .filter(Boolean);
      return options.some((item) => haystack.includes(item) || haystack === item);
    }
    default:
      return false;
  }
}

function matchesGrupo(
  fields: Record<string, string>,
  grupoSlug: string,
  grupos: IGrupoResponsabilidade[],
): boolean {
  const grupo = grupos.find((g) => g.slug === grupoSlug);
  if (!grupo) return false;

  const atribuido = normalize(fields.atribuido);
  const responsavel = normalize(fields.responsavel);

  return (grupo.membros || []).some((membro) => {
    const val = normalize(membro.valor);
    if (!val) return false;
    if (membro.tipo === 'colaborador' || membro.tipo === 'email') {
      return atribuido.includes(val) || responsavel.includes(val) || atribuido === val || responsavel === val;
    }
    return false;
  });
}

export function evaluateCriterios(
  criterios: IWorkflowCriterio[],
  fields: Record<string, string>,
  grupos: IGrupoResponsabilidade[] = [],
): boolean {
  if (!criterios?.length) return true;

  return criterios.every((criterio) => {
    if (criterio.fonte === 'grupo_responsabilidade') {
      return matchesGrupo(fields, criterio.campo || criterio.valor, grupos);
    }
    if (criterio.fonte === 'integracao') {
      const actual = readIntegracaoField(fields, criterio.campo);
      return evaluateOperator(actual, criterio.operador, criterio.valor);
    }
    const actual = readTabulationField(fields, criterio.campo);
    return evaluateOperator(actual, criterio.operador, criterio.valor);
  });
}

/** Gatilho sem critérios nunca ativa o workflow */
export function evaluateGatilhoCriterios(
  criterios: IWorkflowCriterio[],
  fields: Record<string, string>,
  grupos: IGrupoResponsabilidade[] = [],
): boolean {
  if (!criterios?.length) return false;
  return evaluateCriterios(criterios, fields, grupos);
}

export function buildTabulationFieldsFromTicket(ticket: {
  tabulacao?: Array<Record<string, string>>;
  lateralForm?: Record<string, unknown>;
}): Record<string, string> {
  const tab = ticket.tabulacao?.[0] || {};
  const lf = ticket.lateralForm || {};
  const metadados = (lf.metadados && typeof lf.metadados === 'object' ? lf.metadados : {}) as Record<string, unknown>;
  const integracao = (lf.integracao && typeof lf.integracao === 'object'
    ? lf.integracao
    : metadados.integracao && typeof metadados.integracao === 'object'
      ? metadados.integracao
      : {}) as Record<string, unknown>;
  return {
    tipoChamado: String(lf.tipoChamado ?? lf.classificacaoTipo ?? tab.tipoChamado ?? ''),
    tipo: String(lf.tipoChamado ?? lf.classificacaoTipo ?? tab.tipoChamado ?? ''),
    produto: String(lf.produto ?? tab.produto ?? ''),
    motivo: String(lf.motivo ?? tab.motivo ?? ''),
    detalhe: String(lf.detalhe ?? tab.detalhe ?? ''),
    responsavel: String(lf.responsavel ?? tab.responsavel ?? ''),
    atribuido: String(lf.atribuido ?? tab.atribuido ?? ''),
    statusPagamento: String(integracao.statusPagamento ?? lf.statusPagamento ?? ''),
    dataContratacao: String(integracao.dataContratacao ?? integracao.dataContratacaoFaixa ?? lf.dataContratacao ?? ''),
    statusContrato: String(integracao.statusContrato ?? lf.statusContrato ?? ''),
  };
}

export function resolveAtribuidoForPasso(
  atribuicao: { tipo: string; grupoSlug?: string; colaborador?: string },
  fields: Record<string, string>,
): string {
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
