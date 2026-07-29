/**
 * AtendimentoIaTelefonicoPage v1.0.0 — wrapper da página de ligações IA telefônicas
 */
import React from 'react';
import AtendimentoIaTelefonicoRouter from './AtendimentoIaTelefonicoRouter';
import './telephony.css';

export default function AtendimentoIaTelefonicoPage() {
  return (
    <div className="page active telephony-page" id="telephonyPage">
      <AtendimentoIaTelefonicoRouter />
    </div>
  );
}
