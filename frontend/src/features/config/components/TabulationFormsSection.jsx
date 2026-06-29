/**
 * TabulationFormsSection v1.3.0 — editor tabulacao_campos (produto → motivo → detalhe)
 * VERSION: v1.3.0 | DATE: 2026-06-25
 */
import React from 'react';
import { useTabulation } from '../../../context/TabulationContext';
import TabulationProdutosList from './TabulationProdutosList';

export default function TabulationFormsSection() {
  const { reload } = useTabulation();
  return <TabulationProdutosList id="formsTab" onChanged={reload} />;
}
