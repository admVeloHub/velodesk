/**
 * Caixas customizadas — fila de atendimento (localStorage)
 * VERSION: v1.0.0 | DATE: 2026-06-19
 */
import { QUEUE_STATUSES } from './constants';
import { addCustomBox } from '../ticketsCache';

const STORAGE_KEY = 'velodeskCustomQueues';

export const QUEUE_BOX_ACTIONS = [
  { id: 'novos', label: 'Receber tickets novos' },
  { id: 'em-andamento', label: 'Manter em andamento' },
  { id: 'pendente', label: 'Aguardar retorno / pendência' },
  { id: 'resolvidos', label: 'Encaminhar para resolvidos' },
  { id: 'escalonar', label: 'Escalonar automaticamente' },
  { id: 'notificar', label: 'Notificar supervisor' },
];

const ACTION_DOTS = {
  novos: '#1634FF',
  'em-andamento': '#15A237',
  pendente: '#FCC200',
  resolvidos: '#9ca3af',
  escalonar: '#9333ea',
  notificar: '#ea580c',
};

function slugify(value) {
  return String(value || 'caixa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'caixa';
}

export function loadCustomQueues() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomQueues(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getAllQueueStatuses() {
  return [...QUEUE_STATUSES, ...loadCustomQueues()];
}

export function getCustomQueueById(queueId) {
  return loadCustomQueues().find((item) => item.id === queueId) || null;
}

export function createCustomQueueBox({ name, action }) {
  const trimmedName = String(name || '').trim();
  const actionId = QUEUE_BOX_ACTIONS.some((item) => item.id === action) ? action : 'em-andamento';
  const id = `custom-${slugify(trimmedName)}-${Date.now().toString(36)}`;
  const actionMeta = QUEUE_BOX_ACTIONS.find((item) => item.id === actionId);

  const box = {
    id,
    name: trimmedName,
    action: actionId,
    actionLabel: actionMeta?.label || actionId,
    dot: ACTION_DOTS[actionId] || '#6366f1',
    boxes: [id],
    isCustom: true,
  };

  saveCustomQueues([...loadCustomQueues(), box]);
  addCustomBox({ id: box.id, name: box.name, action: box.action });

  return box;
}

export function getQueueActionLabel(queueId) {
  const custom = getCustomQueueById(queueId);
  if (custom?.actionLabel) return custom.actionLabel;
  return null;
}

export function restoreCustomBoxes() {
  loadCustomQueues().forEach((box) => {
    addCustomBox({ id: box.id, name: box.name, action: box.action });
  });
}
