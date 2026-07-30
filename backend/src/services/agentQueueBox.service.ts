/**
 * agentQueueBox.service v1.1.0 — caixas com criterios[] de filtro
 * VERSION: v1.1.0 | DATE: 2026-07-30 | AUTHOR: VeloHub Development Team
 */
import { getDeskAgentQueueBoxModel, type IDeskAgentQueueBox, type IDeskAgentQueueBoxCriterio } from '../models/DeskAgentQueueBox';

export const QUEUE_BOX_ACTIONS = [
  { id: 'novos', label: 'Receber tickets novos' },
  { id: 'em-andamento', label: 'Manter em andamento' },
  { id: 'pendente', label: 'Aguardar retorno / pendência' },
  { id: 'resolvidos', label: 'Encaminhar para resolvidos' },
  { id: 'escalonar', label: 'Escalonar automaticamente' },
  { id: 'notificar', label: 'Notificar supervisor' },
] as const;

const ACTION_DOTS: Record<string, string> = {
  novos: '#1634FF',
  'em-andamento': '#15A237',
  pendente: '#FCC200',
  resolvidos: '#9ca3af',
  escalonar: '#9333ea',
  notificar: '#ea580c',
};

const CRITERIO_TIPOS = new Set(['tabulacao', 'status', 'workflow', 'atribuido', 'sla']);

export interface AgentQueueBoxCriterioDto {
  tipo: string;
  campo?: string;
  operador?: string;
  valor: string;
}

export interface AgentQueueBoxDto {
  id: string;
  name: string;
  action: string;
  actionLabel: string;
  dot: string;
  boxes: string[];
  isCustom: boolean;
  order: number;
  criterios: AgentQueueBoxCriterioDto[];
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function slugify(value: string): string {
  return String(value || 'caixa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'caixa';
}

function resolveActionMeta(action: string) {
  const actionId = QUEUE_BOX_ACTIONS.some((item) => item.id === action) ? action : 'em-andamento';
  const actionMeta = QUEUE_BOX_ACTIONS.find((item) => item.id === actionId);
  return {
    action: actionId,
    actionLabel: actionMeta?.label || actionId,
    dot: ACTION_DOTS[actionId] || '#6366f1',
  };
}

function normalizeCriterios(raw: unknown): IDeskAgentQueueBoxCriterio[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const tipo = String(row.tipo || '').trim().toLowerCase();
      if (!CRITERIO_TIPOS.has(tipo)) return null;
      const valor = String(row.valor ?? '').trim();
      if (!valor && tipo !== 'atribuido') return null;
      return {
        tipo,
        campo: String(row.campo || '').trim(),
        operador: String(row.operador || 'equals').trim() || 'equals',
        valor,
      };
    })
    .filter(Boolean) as IDeskAgentQueueBoxCriterio[];
}

function toDto(doc: IDeskAgentQueueBox): AgentQueueBoxDto {
  const boxId = String(doc.boxId || '').trim();
  return {
    id: boxId,
    name: String(doc.name || '').trim(),
    action: String(doc.action || 'em-andamento'),
    actionLabel: String(doc.actionLabel || ''),
    dot: String(doc.dot || '#6366f1'),
    boxes: [boxId],
    isCustom: doc.isCustom !== false,
    order: typeof doc.order === 'number' ? doc.order : 0,
    criterios: Array.isArray(doc.criterios)
      ? doc.criterios.map((c) => ({
        tipo: String(c.tipo || ''),
        campo: String(c.campo || ''),
        operador: String(c.operador || 'equals'),
        valor: String(c.valor || ''),
      }))
      : [],
  };
}

export async function listAgentQueueBoxes(email: string): Promise<AgentQueueBoxDto[]> {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];

  const Model = getDeskAgentQueueBoxModel();
  const docs = await Model.find({ email: normalized }).sort({ order: 1, createdAt: 1 });
  return docs.map(toDto);
}

export interface CreateAgentQueueBoxInput {
  name: string;
  action?: string;
  boxId?: string;
  criterios?: unknown;
  dot?: string;
}

export async function createAgentQueueBox(
  email: string,
  userId: string | undefined,
  input: CreateAgentQueueBoxInput,
): Promise<AgentQueueBoxDto> {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error('E-mail do agente é obrigatório');

  const trimmedName = String(input.name || '').trim();
  if (!trimmedName) throw new Error('Nome da caixa é obrigatório');

  const criterios = normalizeCriterios(input.criterios);
  if (!criterios.length) throw new Error('Informe ao menos um critério de filtragem');

  const meta = resolveActionMeta(String(input.action || 'em-andamento'));
  const boxId = String(input.boxId || '').trim()
    || `custom-${slugify(trimmedName)}-${Date.now().toString(36)}`;

  const Model = getDeskAgentQueueBoxModel();
  const existing = await Model.findOne({ email: normalized, boxId });
  if (existing) {
    existing.name = trimmedName;
    existing.criterios = criterios;
    existing.dot = String(input.dot || existing.dot || meta.dot);
    existing.action = meta.action;
    existing.actionLabel = meta.actionLabel;
    await existing.save();
    return toDto(existing);
  }

  const count = await Model.countDocuments({ email: normalized });
  const doc = await Model.create({
    boxId,
    email: normalized,
    userId: String(userId || ''),
    name: trimmedName,
    action: meta.action,
    actionLabel: meta.actionLabel,
    dot: String(input.dot || meta.dot),
    order: count,
    isCustom: true,
    criterios,
  });

  return toDto(doc);
}

export async function updateAgentQueueBox(
  email: string,
  boxId: string,
  input: CreateAgentQueueBoxInput,
): Promise<AgentQueueBoxDto | null> {
  const normalized = normalizeEmail(email);
  const id = String(boxId || '').trim();
  if (!normalized || !id) return null;

  const Model = getDeskAgentQueueBoxModel();
  const doc = await Model.findOne({ email: normalized, boxId: id });
  if (!doc) return null;

  const trimmedName = String(input.name || doc.name || '').trim();
  if (!trimmedName) throw new Error('Nome da caixa é obrigatório');

  const criterios = input.criterios !== undefined
    ? normalizeCriterios(input.criterios)
    : (doc.criterios || []);
  if (!criterios.length) throw new Error('Informe ao menos um critério de filtragem');

  const meta = resolveActionMeta(String(input.action || doc.action || 'em-andamento'));
  doc.name = trimmedName;
  doc.criterios = criterios;
  doc.action = meta.action;
  doc.actionLabel = meta.actionLabel;
  if (input.dot) doc.dot = String(input.dot);
  await doc.save();
  return toDto(doc);
}

export async function deleteAgentQueueBox(email: string, boxId: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const id = String(boxId || '').trim();
  if (!normalized || !id) return false;

  const Model = getDeskAgentQueueBoxModel();
  const result = await Model.deleteOne({ email: normalized, boxId: id });
  return result.deletedCount > 0;
}

export async function migrateAgentQueueBoxes(
  email: string,
  userId: string | undefined,
  boxes: CreateAgentQueueBoxInput[],
): Promise<AgentQueueBoxDto[]> {
  const created: AgentQueueBoxDto[] = [];
  for (const box of boxes) {
    try {
      const saved = await createAgentQueueBox(email, userId, {
        ...box,
        criterios: Array.isArray(box.criterios) && box.criterios.length
          ? box.criterios
          : [{ tipo: 'status', campo: 'status', operador: 'equals', valor: 'em-andamento' }],
      });
      created.push(saved);
    } catch (err) {
      console.warn('[agentQueueBox] falha ao migrar caixa:', (err as Error)?.message);
    }
  }
  return created;
}
