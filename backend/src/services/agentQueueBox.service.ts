/**
 * agentQueueBox.service v1.0.1 — desk_preferences.desk_agent_boxex
 * VERSION: v1.0.0 | DATE: 2026-07-29 | AUTHOR: VeloHub Development Team
 */
import { getDeskAgentQueueBoxModel, type IDeskAgentQueueBox } from '../models/DeskAgentQueueBox';

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

export interface AgentQueueBoxDto {
  id: string;
  name: string;
  action: string;
  actionLabel: string;
  dot: string;
  boxes: string[];
  isCustom: boolean;
  order: number;
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
  action: string;
  boxId?: string;
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

  const meta = resolveActionMeta(String(input.action || ''));
  const boxId = String(input.boxId || '').trim()
    || `custom-${slugify(trimmedName)}-${Date.now().toString(36)}`;

  const Model = getDeskAgentQueueBoxModel();
  const existing = await Model.findOne({ email: normalized, boxId });
  if (existing) return toDto(existing);

  const count = await Model.countDocuments({ email: normalized });
  const doc = await Model.create({
    boxId,
    email: normalized,
    userId: String(userId || ''),
    name: trimmedName,
    action: meta.action,
    actionLabel: meta.actionLabel,
    dot: meta.dot,
    order: count,
    isCustom: true,
  });

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
      const saved = await createAgentQueueBox(email, userId, box);
      created.push(saved);
    } catch (err) {
      console.warn('[agentQueueBox] falha ao migrar caixa:', (err as Error)?.message);
    }
  }
  return created;
}
