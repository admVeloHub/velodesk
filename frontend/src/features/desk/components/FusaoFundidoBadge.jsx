/**
 * Badge Mesclado — cores estilo Ouvidoria VeloHub
 * VERSION: v1.1.0 | DATE: 2026-08-04
 */
import React from 'react';

export default function FusaoFundidoBadge({ fusao }) {
  if (!fusao || fusao.fundido !== true) return null;
  const h = String(fusao.hierarquia || '').toLowerCase();
  let cls = 'client360-fusao-badge client360-fusao-badge--redundante';
  if (h === 'inferior') cls = 'client360-fusao-badge client360-fusao-badge--inferior';
  else if (h === 'superior') cls = 'client360-fusao-badge client360-fusao-badge--superior';
  return (
    <span className={cls} title={h ? `Mesclagem: ${h}` : 'Mesclado'}>
      Mesclado
    </span>
  );
}
