/**
 * commonWordsPt v1.2.0 — vocabulário básico PT-BR (sem variantes sem acento duplicadas)
 * VERSION: v1.2.0 | DATE: 2026-06-26
 */

/** @type {Set<string>} */
export const COMMON_WORDS_PT = new Set([
  'a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'um', 'uma', 'uns', 'umas', 'por', 'para', 'com', 'sem', 'sob', 'sobre',
  'que', 'se', 'não', 'nao', 'sim', 'mais', 'menos', 'muito', 'pouco', 'bem',
  'mal', 'já', 'ja', 'ainda', 'também', 'tambem', 'só', 'so', 'apenas',
  'eu', 'tu', 'ele', 'ela', 'eles', 'elas', 'nós', 'nos', 'vós', 'vos',
  'me', 'te', 'lhe', 'lhes', 'lo', 'la', 'los', 'las', 'mim', 'ti', 'si',
  'meu', 'meus', 'minha', 'minhas', 'teu', 'teus', 'tua', 'tuas',
  'seu', 'seus', 'sua', 'suas', 'dele', 'dela', 'deles', 'delas',
  'nosso', 'nossos', 'nossa', 'nossas', 'vosso', 'vossos', 'vossa', 'vossas',
  'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas',
  'aquele', 'aquela', 'aqueles', 'aquelas', 'isto', 'isso', 'aquilo',
  'quem', 'qual', 'quais', 'quanto', 'quantos', 'quantas', 'cujo', 'cuja',
  'olá', 'ola', 'oi', 'bom', 'boa', 'dia', 'tarde', 'noite',
  'obrigado', 'obrigada', 'desculpe', 'desculpa', 'aguarde',
  'você', 'voce', 'senhor', 'senhora', 'cliente', 'prezado', 'prezada',
  'casa', 'caso', 'casos', 'canal', 'contato', 'mensagem', 'resposta',
  'informação', 'informações', 'dúvida', 'dúvidas',
  'problema', 'problemas', 'solução', 'soluções', 'pedido', 'pedidos',
  'solicitação', 'solicitações', 'reclamação',
  'atendimento', 'atendimentos', 'agente', 'equipe', 'suporte',
  'verificar', 'verificando', 'análise', 'analisando', 'enviar',
  'enviado', 'enviada', 'receber', 'recebido', 'recebida', 'retorno', 'retornar',
  'aguardar', 'aguardando', 'prazo', 'prazos', 'hoje', 'amanhã', 'amanha',
  'ontem', 'semana', 'mês', 'mes', 'ano', 'hora', 'horas', 'minuto', 'minutos',
  'telefone', 'celular', 'email', 'endereço', 'endereco', 'bairro',
  'cidade', 'estado', 'cep', 'cpf', 'cnpj', 'nome', 'nomes', 'dados', 'cadastro',
  'conta', 'contas', 'fatura', 'faturas', 'boleto', 'boletos', 'pagamento',
  'pagar', 'pago', 'paga', 'valor', 'valores', 'plano', 'planos', 'produto',
  'produtos', 'serviço', 'servico', 'serviços', 'servicos', 'internet', 'fibra',
  'wifi', 'tv', 'televisão', 'televisao', 'modem', 'roteador', 'sinal',
  'conexão', 'conexao', 'velocidade', 'instalação', 'instalacao', 'técnico',
  'tecnico', 'técnicos', 'tecnicos', 'visita', 'agendamento',
  'cancelar', 'cancelamento', 'reativar', 'reativação', 'reativacao', 'ativar',
  'desativar', 'bloqueio', 'bloqueado', 'liberar', 'liberado', 'protocolo',
  'número', 'numero', 'código', 'codigo', 'ticket', 'chamado', 'chamados',
  'status', 'aberto', 'fechado', 'resolvido', 'pendente', 'andamento',
  'escalonar', 'escalonamento', 'prioridade', 'urgente', 'importante',
  'documento', 'documentos', 'anexo', 'anexos', 'arquivo', 'arquivos',
  'link', 'links', 'site', 'portal', 'aplicativo', 'acesso', 'senha',
  'login', 'usuário', 'usuario', 'cadastrar', 'atualizar', 'corrigir',
  'confirmar', 'confirmado', 'validar', 'validado', 'informar', 'informado',
  'preciso', 'precisa', 'precisamos', 'poder', 'pode', 'podemos', 'deve',
  'fazer', 'feito', 'feita', 'estar', 'está', 'esta', 'estou', 'estamos',
  'ser', 'sou', 'somos', 'ter', 'tenho', 'tem', 'temos', 'há', 'ha',
  'ir', 'vou', 'vai', 'vamos', 'ver', 'vejo', 'vemos', 'dar', 'dou', 'dá', 'damos',
  'falar', 'falo', 'fala', 'entender', 'entendo', 'entende', 'agradecer', 'agradeco',
  'agradecimento', 'cordialmente', 'atenciosamente', 'tudo', 'nada', 'algo',
  'alguém', 'alguem', 'ninguém', 'ninguem', 'cada', 'todo', 'toda', 'todos', 'todas',
  'outro', 'outra', 'outros', 'outras', 'mesmo', 'mesma', 'entre', 'desde', 'até', 'ate',
  'antes', 'depois', 'durante', 'quando', 'onde', 'como', 'porque', 'pois', 'então', 'entao',
  'assim', 'aqui', 'ali', 'lá', 'la', 'aí', 'ai', 'vez', 'vezes', 'novo', 'nova',
  'certo', 'certa', 'errado', 'errada', 'possível', 'possivel', 'disponível', 'disponivel',
]);

/** @param {string} word */
export function isCommonWordPt(word) {
  if (!word) return false;
  return COMMON_WORDS_PT.has(String(word).trim().toLowerCase());
}
