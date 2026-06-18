/** AI suggestions v1.0.0 */
import { Ticket } from '../../types';

export function suggestResponse(ticket: Ticket, lastClientMessage?: string): string {
  const name = ticket.clientName?.split(' ')[0] || 'cliente';
  const text = lastClientMessage || ticket.description || '';
  if (/lentid|lento|velocidade/i.test(text)) {
    return `Olá, ${name}. Nossa equipe identificou sua solicitação sobre lentidão. Vamos verificar sinal e equipamentos. Pode reiniciar o modem e nos informar?`;
  }
  return `Olá, ${name}. Obrigado pelo contato. Nossa equipe analisará sua solicitação e retornará em breve com uma solução.`;
}

export function suggestTabulation(ticket: Ticket): string {
  const lf = ticket.lateralForm || {};
  if (lf.produto && lf.motivo) return `${lf.produto} > ${lf.motivo}${lf.detalhe ? ` > ${lf.detalhe}` : ''}`;
  if (/fibra|internet/i.test(ticket.description || '')) return 'Internet Fibra > Lentidão > Em análise';
  return 'Reclamação > Geral';
}
