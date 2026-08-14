/**
 * BacenTopBar — faixa laranja superior
 */
import React from 'react';

export default function BacenTopBar() {
  return (
    <header className="ra-topbar">
      <div className="ra-topbar__inner">
        <div className="ra-topbar__breadcrumb">
          <span>Bacen</span>
          <i className="ti ti-chevron-right" aria-hidden="true" />
          <span>Gestão e tratativa</span>
        </div>
      </div>
    </header>
  );
}
