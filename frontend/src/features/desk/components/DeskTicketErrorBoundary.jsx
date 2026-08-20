/**
 * DeskTicketErrorBoundary v1.0.0 — crash no ticket não derruba o CRM
 * VERSION: v1.0.0 | DATE: 2026-08-20
 */
import React from 'react';

export default class DeskTicketErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[DeskTicket] render falhou', error, info?.componentStack || '');
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="crm-empty-state" role="alert">
          Não foi possível abrir este ticket. Volte à fila e tente outro chamado.
        </div>
      );
    }
    return this.props.children;
  }
}
