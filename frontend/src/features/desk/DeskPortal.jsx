/**
 * Desk CRM — portal no body (desk-v2-mode esconde .main-content)
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import DeskV2Root from './DeskV2Root';

export default function DeskPortal() {
  const [mountEl, setMountEl] = useState(null);

  useEffect(() => {
    let root = document.getElementById('velodeskDeskV2Root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'velodeskDeskV2Root';
      document.body.appendChild(root);
    }
    setMountEl(root);
    return () => {
      root.remove();
      setMountEl(null);
    };
  }, []);

  if (!mountEl) return null;

  return createPortal(
    <div className="page active">
      <DeskV2Root />
    </div>,
    mountEl
  );
}
