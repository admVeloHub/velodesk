/**
 * gruposAtribData v1.1.0 — helpers membros ↔ pool VeloHub (visões atuacao)
 * VERSION: v1.1.0 | DATE: 2026-07-15
 */

export const PERFIL_DESK_OPCOES = [
  { value: 'agent', label: 'Visão agente (atendimento)' },
  { value: 'gestao', label: 'Visão supervisão (gestão / suporte supervisão / direção)' },
];

/** Labels legados (grupos já salvos com supervisor) */
const PERFIL_DESK_LABELS_LEGACY = {
  supervisor: 'Supervisores (legado)',
};

export function resolvePerfilDeskLabel(valor) {
  const key = String(valor || '').trim();
  const opt = PERFIL_DESK_OPCOES.find((o) => o.value === key);
  if (opt) return opt.label;
  return PERFIL_DESK_LABELS_LEGACY[key] || key;
}

export function getColaboradorMembros(membros = []) {
  return (membros || []).filter((m) => m.tipo === 'colaborador' && String(m.valor || '').trim());
}

export function getPerfilMembros(membros = []) {
  return (membros || []).filter((m) => m.tipo === 'perfil_desk' && String(m.valor || '').trim());
}

export function buildMembrosFromSelecao(colaboradorValores = [], perfisDesk = []) {
  const colaboradores = colaboradorValores
    .map((valor) => String(valor || '').trim())
    .filter(Boolean)
    .map((valor) => ({ tipo: 'colaborador', valor }));

  const perfis = perfisDesk
    .map((valor) => String(valor || '').trim())
    .filter(Boolean)
    .map((valor) => ({ tipo: 'perfil_desk', valor }));

  return [...colaboradores, ...perfis];
}

export function resolveAgentLabel(valor, agents = []) {
  const key = String(valor || '').trim().toLowerCase();
  if (!key) return '';
  const match = agents.find(
    (a) => a.value === valor
      || String(a.label || '').toLowerCase() === key
      || String(a.colaboradorNome || '').toLowerCase() === key
      || String(a.email || '').toLowerCase().startsWith(`${key}@`)
      || String(a.email || '').toLowerCase() === key,
  );
  return match?.label || valor;
}

export function formatGrupoAgentesResumo(membros = [], agents = [], max = 3) {
  const colaboradores = getColaboradorMembros(membros).map((m) => resolveAgentLabel(m.valor, agents));
  const perfis = getPerfilMembros(membros).map((m) => resolvePerfilDeskLabel(m.valor));
  const labels = [...colaboradores, ...perfis];

  if (!labels.length) return 'Nenhum agente';
  if (labels.length <= max) return labels.join(', ');
  return `${labels.slice(0, max).join(', ')} (+${labels.length - max})`;
}

export function countAgentesNoGrupo(membros = []) {
  return getColaboradorMembros(membros).length + getPerfilMembros(membros).length;
}
