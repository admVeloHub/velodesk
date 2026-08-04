/**
 * Helpers de fusão de tickets (estilo Ouvidoria VeloHub)
 * VERSION: v1.0.0 | DATE: 2026-08-04
 */
import type { IChamadoFusao, IChamadoN1 } from '../models/ChamadoN1';

export function isFusaoAbsorvido(fusao?: IChamadoFusao | null): boolean {
  if (!fusao || fusao.fundido !== true) return false;
  const h = String(fusao.hierarquia || '').toLowerCase();
  if (h === 'inferior') return true;
  if (h === 'redundante' && fusao.parentId != null && String(fusao.parentId) !== '') {
    return true;
  }
  return false;
}

export function isFusaoAbsorvidoChamado(chamado: Pick<IChamadoN1, 'fusao'> | null | undefined): boolean {
  return isFusaoAbsorvido(chamado?.fusao);
}

/** Filtro Mongo: exclui tickets absorvidos pela fusão. */
export function excludeFusaoAbsorvidosFilter(): Record<string, unknown> {
  return {
    $nor: [
      {
        'fusao.fundido': true,
        'fusao.hierarquia': 'inferior',
      },
      {
        'fusao.fundido': true,
        'fusao.hierarquia': 'redundante',
        'fusao.parentId': { $exists: true, $ne: null },
      },
    ],
  };
}

export function serializeFusaoDto(fusao?: IChamadoFusao | null) {
  if (!fusao || fusao.fundido !== true) return undefined;
  return {
    fundido: true,
    dataFundido: fusao.dataFundido ?? null,
    hierarquia: fusao.hierarquia || '',
    parentId: fusao.parentId ? String(fusao.parentId) : null,
    childId: fusao.childId ? String(fusao.childId) : null,
    parentProtocolo: fusao.parentProtocolo || undefined,
    childProtocolo: fusao.childProtocolo || undefined,
    childProtocolos: Array.isArray(fusao.childProtocolos) ? fusao.childProtocolos : [],
    childIds: Array.isArray(fusao.childIds) ? fusao.childIds.map((id) => String(id)) : [],
  };
}
