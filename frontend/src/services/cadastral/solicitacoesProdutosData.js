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
