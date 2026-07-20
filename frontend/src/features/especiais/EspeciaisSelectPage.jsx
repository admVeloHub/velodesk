/**
 * EspeciaisSelectPage — redirect legado para Painel 360°
 */
import React from 'react';
import { Navigate } from 'react-router-dom';

export default function EspeciaisSelectPage() {
  return <Navigate to="/workspace" replace />;
}
