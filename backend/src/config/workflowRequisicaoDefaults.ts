/** workflowRequisicaoDefaults v1.2.0 — comunicacaoWorkflow na requisição do chamado */
import type { IWorkflowCriterio, IWorkflowGatilho } from '../models/WorkflowDefinicao';

export type WorkflowRequisicaoCampoTipo =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'boolean'
  | 'currency';

export interface IWorkflowRequisicaoCampoOpcao {
  valor: string;
  label: string;
}

export interface IWorkflowRequisicaoCampo {
  id: string;
  label: string;
  tipo: WorkflowRequisicaoCampoTipo;
  obrigatorio: boolean;
  ordem: number;
  opcoes?: IWorkflowRequisicaoCampoOpcao[];
  placeholder?: string;
  ajuda?: string;
}

export interface IWorkflowRequisicaoConfig {
  campos: IWorkflowRequisicaoCampo[];
}

export interface IChamadoWorkflowComunicacao {
  mensagem: string;
  data: Date;
  autor: string;
  autorEmail?: string;
}

export type ComunicacaoWorkflowOrigem = 'workflow' | 'responsavel';

export interface IChamadoWorkflowComunicacaoResumo {
  ultimaOrigem: ComunicacaoWorkflowOrigem | null;
  ultimaData: Date | null;
  temRespostaAgente: boolean;
  ultimoWorkflowAutorEmail?: string;
  vistoResponsavelEm?: Date | null;
}

export interface IChamadoWorkflowRequisicao {
  preenchidaEm: Date;
  preenchidaPor: string;
  valores: Record<string, unknown>;
  comunicacaoWorkflow?: IChamadoWorkflowComunicacao[];
  comunicacaoResumo?: IChamadoWorkflowComunicacaoResumo;
  solicitacaoProdutos?: Record<string, unknown>;
  solicitacaoFinanceiro?: Record<string, unknown>;
}

export const REQUISICAO_FIELD_DENYLIST = [
  'clienteCpf',
  'cpf',
  'tipoChamado',
  'classificacaoTipo',
  'produto',
  'motivo',
  'detalhe',
  'responsavel',
  'atribuido',
  'canal',
] as const;

export class WorkflowRequisicaoError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const CAMPO_TIPOS = new Set<WorkflowRequisicaoCampoTipo>([
  'text',
  'textarea',
  'number',
  'date',
  'select',
  'boolean',
  'currency',
]);

function normalizeFieldId(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export function buildRequisicaoDenylist(gatilho?: IWorkflowGatilho | null): Set<string> {
  const deny = new Set<string>(REQUISICAO_FIELD_DENYLIST);
  for (const c of gatilho?.criterios || []) {
    const campo = String(c.campo || '').trim();
    if (campo) deny.add(campo.toLowerCase());
  }
  return deny;
}

export function isReservedRequisicaoFieldId(
  fieldId: string,
  gatilho?: IWorkflowGatilho | null,
): boolean {
  const normalized = normalizeFieldId(fieldId);
  if (!normalized) return true;
  return buildRequisicaoDenylist(gatilho).has(normalized);
}

export function normalizeRequisicaoConfig(
  requisicao?: Partial<IWorkflowRequisicaoConfig> | null,
  gatilho?: IWorkflowGatilho | null,
): IWorkflowRequisicaoConfig {
  const deny = buildRequisicaoDenylist(gatilho);
  const seen = new Set<string>();
  const campos: IWorkflowRequisicaoCampo[] = [];

  for (const raw of requisicao?.campos || []) {
    const label = String(raw?.label || '').trim();
    if (!label) continue;
    const id = normalizeFieldId(label) || normalizeFieldId(raw?.id);
    if (!id || deny.has(id) || seen.has(id)) continue;
    const tipo = CAMPO_TIPOS.has(raw.tipo as WorkflowRequisicaoCampoTipo)
      ? (raw.tipo as WorkflowRequisicaoCampoTipo)
      : 'text';

    seen.add(id);
    campos.push({
      id,
      label,
      tipo,
      obrigatorio: raw.obrigatorio === true,
      ordem: Number.isFinite(raw.ordem) ? Number(raw.ordem) : campos.length,
      opcoes: Array.isArray(raw.opcoes)
        ? raw.opcoes
          .map((o) => ({
            valor: String(o?.valor ?? '').trim(),
            label: String(o?.label ?? o?.valor ?? '').trim(),
          }))
          .filter((o) => o.valor)
        : undefined,
      ajuda: String(raw.ajuda || '').trim() || undefined,
    });
  }

  return {
    campos: campos.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
  };
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'boolean') return false;
  return String(value).trim() === '';
}

export function validateRequisicaoValores(
  requisicao: IWorkflowRequisicaoConfig,
  valores: Record<string, unknown> = {},
): { ok: true; valores: Record<string, unknown> } | { ok: false; message: string } {
  const normalized: Record<string, unknown> = {};

  for (const campo of requisicao.campos) {
    const raw = valores[campo.id];
    if (campo.tipo === 'boolean') {
      normalized[campo.id] = raw === true || raw === 'true';
      continue;
    }

    const text = String(raw ?? '').trim();
    if (campo.obrigatorio && isEmptyValue(text)) {
      return { ok: false, message: `Campo obrigatório: ${campo.label}` };
    }

    if (campo.tipo === 'number' || campo.tipo === 'currency') {
      if (!isEmptyValue(text)) {
        const num = Number(text);
        if (Number.isNaN(num)) {
          return { ok: false, message: `Valor inválido em "${campo.label}"` };
        }
        normalized[campo.id] = num;
      } else {
        normalized[campo.id] = '';
      }
      continue;
    }

    if (campo.tipo === 'select' && text && campo.opcoes?.length) {
      const allowed = new Set(campo.opcoes.map((o) => o.valor));
      if (!allowed.has(text)) {
        return { ok: false, message: `Opção inválida em "${campo.label}"` };
      }
    }

    normalized[campo.id] = text;
  }

  return { ok: true, valores: normalized };
}
