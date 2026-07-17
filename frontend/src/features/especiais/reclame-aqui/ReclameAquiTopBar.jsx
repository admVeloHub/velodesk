/**
 * ReclameAquiTopBar — faixa laranja superior
 */
import React from 'react';

export default function ReclameAquiTopBar() {
  return (
    <header className="ra-topbar">
      <div className="ra-topbar__inner">
        <div className="ra-topbar__breadcrumb">
          <span>Reclame Aqui</span>
          <i className="ti ti-chevron-right" aria-hidden="true" />
          <span>Gestão e tratativa</span>
        </div>
      </div>
    </header>
  );
}
