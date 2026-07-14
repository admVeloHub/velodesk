/**
 * gruposAtribData v1.0.0 — helpers membros ↔ agentes Desk
 * VERSION: v1.0.0 | DATE: 2026-07-14
 */

export const PERFIL_DESK_OPCOES = [
  { value: 'agent', label: 'Todos os agentes' },
  { value: 'supervisor', label: 'Supervisores' },
];

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
      || String(a.email || '').toLowerCase().startsWith(`${key}@`)
      || String(a.email || '').toLowerCase() === key,
  );
  return match?.label || valor;
}

export function formatGrupoAgentesResumo(membros = [], agents = [], max = 3) {
  const colaboradores = getColaboradorMembros(membros).map((m) => resolveAgentLabel(m.valor, agents));
  const perfis = getPerfilMembros(membros).map((m) => {
    const opt = PERFIL_DESK_OPCOES.find((o) => o.value === m.valor);
    return opt?.label || m.valor;
  });
  const labels = [...colaboradores, ...perfis];

  if (!labels.length) return 'Nenhum agente';
  if (labels.length <= max) return labels.join(', ');
  return `${labels.slice(0, max).join(', ')} (+${labels.length - max})`;
}

export function countAgentesNoGrupo(membros = []) {
  return getColaboradorMembros(membros).length + getPerfilMembros(membros).length;
}
