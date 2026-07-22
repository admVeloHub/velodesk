/**
 * Constantes — painel de solicitações ao time de Produtos
 */
export const PROD_SOLIC_TABS = [
  { id: 'solicitacoes', label: 'Solicitações' },
  { id: 'erros-bugs', label: 'Erros/Bugs' },
  { id: 'liberacao-pix', label: 'Liberação chave pix' },
];

export const SOLICITACAO_STATUS = {
  ENVIADO: 'enviado',
  FEITO: 'feito',
};

export const STATUS_LABELS = {
  enviado: 'enviado',
  feito: 'feito',
};

export const TIPO_SOLICITACAO_OPTIONS = [
  { id: 'alteracao-dados-cadastrais', label: 'Alteração de Dados Cadastrais' },
];

export const TIPO_INFORMACAO_OPTIONS = [
  { id: 'telefone', label: 'Telefone' },
  { id: 'email', label: 'E-mail' },
  { id: 'nome', label: 'Nome' },
  { id: 'endereco', label: 'Endereço' },
];

export const PIX_KEY_TYPE_OPTIONS = [
  { id: 'cpf', label: 'CPF' },
  { id: 'email', label: 'E-mail' },
  { id: 'telefone', label: 'Telefone' },
  { id: 'aleatoria', label: 'Chave aleatória' },
];

export const ERROS_BUGS_TIPO_OPTIONS = [
  { id: 'app', label: 'App' },
  { id: 'web', label: 'Web' },
  { id: 'portal', label: 'Portal' },
  { id: 'outro', label: 'Outro' },
];

export const PRODUTOS_APPROVE_ACTIONS = [
  { id: 'pix', label: 'PIX' },
  { id: 'celcoin', label: 'Celcoin' },
  { id: 'velotax', label: 'Velotax' },
  { id: 'nome-email', label: 'Nome/Email' },
  { id: 'limite-pix', label: 'Limite Pix' },
  { id: 'outros', label: 'Outros' },
  { id: 'cancelamentos', label: 'Cancelamentos' },
  { id: 'evidencia-chargeback', label: 'Evidência/Chargeback' },
  { id: 'erro-desembolso', label: 'Erro de desembolso' },
  { id: 'botao-estorno', label: 'Botão de Estorno' },
  { id: 'aumentar-consultas', label: 'Aumentar consultas' },
];

export function getProdutosApproveActionLabel(id) {
  return PRODUTOS_APPROVE_ACTIONS.find((o) => o.id === id)?.label || id;
}

export function getTipoSolicitacaoLabel(id) {
  return TIPO_SOLICITACAO_OPTIONS.find((o) => o.id === id)?.label || id;
}

export function getTipoInformacaoLabel(id) {
  return TIPO_INFORMACAO_OPTIONS.find((o) => o.id === id)?.label || id;
}

export function getErrosBugsTipoLabel(id) {
  return ERROS_BUGS_TIPO_OPTIONS.find((o) => o.id === id)?.label || id;
}

export function getErrosBugsItemSubtitle(item) {
  if (item?.categoria !== 'erros-bugs') return '';
  const parts = [];
  if (item.marca) parts.push(item.marca);
  if (item.modelo) parts.push(item.modelo);
  const imgCount = item.anexosImagens?.length || 0;
  const vidCount = item.anexosVideos?.length || 0;
  if (imgCount) parts.push(`${imgCount} img${imgCount > 1 ? 's' : ''}`);
  if (vidCount) parts.push(`${vidCount} vídeo${vidCount > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

export function getCategoriaTitulo(categoria, payload = {}) {
  if (categoria === 'erros-bugs') return 'Erros/Bugs';
  if (categoria === 'liberacao-pix') return 'Liberação chave pix';
  return getTipoSolicitacaoLabel(payload.tipoSolicitacao || 'alteracao-dados-cadastrais');
}

export function buildProdutosConclusaoClientMessage(ticket) {
  const nome = ticket?.clientName || ticket?.solicitante || 'cliente';
  const lf = ticket?.lateralForm || {};
  let tipo = 'solicitação';
  if (lf.solicitacaoProdutos?.tipoSolicitacao) {
    tipo = getTipoSolicitacaoLabel(lf.solicitacaoProdutos.tipoSolicitacao);
  } else if (lf.motivo && lf.produto) {
    tipo = `${lf.motivo} · ${lf.produto}`;
  } else if (lf.motivo) {
    tipo = lf.motivo;
  }
  return `Olá, ${nome}! Sua solicitação de ${tipo} foi analisada e concluída pelo time de Produtos. Estamos à disposição caso precise de algo mais.`;
}
