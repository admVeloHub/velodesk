/**
 * especiaisWorkflowForwardService — encaminha solicitações de canais especiais aos times
 */
import { ticketsApi } from '../../api/client';
import { apiTicketToCockpit } from '../../api/adapters/ticketAdapter';
import { getAgentName } from '../clientDb';
import { patchTicketInCache } from '../ticketsStorage';

export const ESPECIAIS_WF_SOLICIT_TYPES = {
  produtos: [
    { id: 'solicitacoes', label: 'Alteração de dados', tab: 'solicitacoes' },
    { id: 'erros-bugs', label: 'Erros/Bugs', tab: 'erros-bugs' },
    { id: 'liberacao-pix', label: 'Liberação chave PIX', tab: 'liberacao-pix' },
    { id: 'documentos', label: 'Solicitação de documentos', tab: 'documentos' },
  ],
  financeiro: [
    { id: 'estorno', label: 'Estorno/Cobrança', tab: 'estorno' },
    { id: 'outros', label: 'Outros', tab: 'outros' },
  ],
};

const PRODUTOS_LABELS = {
  solicitacoes: 'Alteração de dados',
  'erros-bugs': 'Erros/Bugs',
  'liberacao-pix': 'Liberação chave PIX',
  documentos: 'Solicitação de documentos',
};

const FINANCEIRO_LABELS = {
  estorno: 'Estorno/Cobrança',
  cobranca: 'Estorno/Cobrança',
  outros: 'Outros',
  documentos: 'Solicitação de documentos',
};

export function resolveTeamSolicitationFromTicket(ticket) {
  if (!ticket) return null;

  const lf = ticket.lateralForm || {};
  const req = ticket.workflow?.requisicao || {};
  const produtos = lf.solicitacaoProdutos || req.solicitacaoProdutos;
  const financeiro = lf.solicitacaoFinanceiro || req.solicitacaoFinanceiro;

  if (produtos?.categoria) {
    return {
      team: 'produtos',
      categoria: produtos.categoria,
      label: PRODUTOS_LABELS[produtos.categoria] || produtos.categoria,
      createdAt: produtos.createdAt,
      snapshot: produtos,
    };
  }

  if (financeiro?.categoria) {
    const team = financeiro.categoria === 'documentos' ? 'produtos' : 'financeiro';
    return {
      team,
      categoria: financeiro.categoria,
      label: (team === 'produtos' ? PRODUTOS_LABELS : FINANCEIRO_LABELS)[financeiro.categoria] || financeiro.categoria,
      createdAt: financeiro.createdAt,
      snapshot: financeiro,
    };
  }

  return null;
}

export async function forwardEspeciaisTeamSolicitation(ticketId, payload) {
  const id = String(ticketId || '').trim();
  if (!id) throw new Error('Ticket inválido');

  const team = String(payload?.team || '').trim().toLowerCase();
  const body = { team };

  if (team === 'produtos') {
    body.solicitacaoProdutos = {
      ...(payload.solicitacaoProdutos || {}),
      colaborador: payload.solicitacaoProdutos?.colaborador || getAgentName() || '',
    };
  } else if (team === 'financeiro') {
    body.solicitacaoFinanceiro = {
      ...(payload.solicitacaoFinanceiro || {}),
      colaborador: payload.solicitacaoFinanceiro?.colaborador || getAgentName() || '',
    };
  } else {
    throw new Error('Time inválido');
  }

  const updated = await ticketsApi.forwardTeamSolicitation(id, body);
  const cockpit = apiTicketToCockpit(updated);

  if (cockpit.lateralForm) {
    if (body.solicitacaoProdutos) {
      cockpit.lateralForm.solicitacaoProdutos = body.solicitacaoProdutos;
    }
    if (body.solicitacaoFinanceiro) {
      cockpit.lateralForm.solicitacaoFinanceiro = body.solicitacaoFinanceiro;
    }
  }

  patchTicketInCache(id, cockpit);
  return cockpit;
}
