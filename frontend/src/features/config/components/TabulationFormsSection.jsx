/**
 * TabulationFormsSection v1.4.0 — cards tipo/canal + editor tabulacao_opcoes
 * VERSION: v1.4.0 | DATE: 2026-07-07
 */
import React from 'react';
import { useTabulation } from '../../../context/TabulationContext';
import TabulationProdutosList from './TabulationProdutosList';

export default function TabulationFormsSection() {
  const { reload } = useTabulation();
  return <TabulationProdutosList id="formsTab" onChanged={reload} />;
}
