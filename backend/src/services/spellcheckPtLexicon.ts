/**
 * spellcheckPtLexicon v1.0.0 — léxico PT-BR atendimento + mapa de typos frequentes
 * VERSION: v1.0.0 | DATE: 2026-07-10
 */

/** Typos frequentes no compose — corrige antes/depois do LanguageTool. */
export const KNOWN_TYPO_MAP: Record<string, string> = {
  pa: 'para',
  pra: 'para',
  pro: 'para',
  valo: 'valor',
  ezato: 'exato',
  exato: 'exato',
  prossedimento: 'procedimento',
  procedimento: 'procedimento',
  criente: 'cliente',
  cleinte: 'cliente',
  cleinte: 'cliente',
  atendimeto: 'atendimento',
  pagameto: 'pagamento',
  pagamentu: 'pagamento',
  aplicativo: 'aplicativo',
  obirgado: 'obrigado',
  obirgada: 'obrigada',
  preciso: 'preciso',
  verificar: 'verificar',
  protocolo: 'protocolo',
  chamado: 'chamado',
  suporte: 'suporte',
  informacao: 'informação',
  informacoes: 'informações',
  duvida: 'dúvida',
  duvidas: 'dúvidas',
};

/** Palavras válidas PT-BR no contexto de atendimento (subset curado). */
export const PT_LEXICON = new Set<string>([
  ...Object.values(KNOWN_TYPO_MAP),
  'a', 'o', 'e', 'de', 'da', 'do', 'em', 'no', 'na', 'um', 'uma', 'por', 'com', 'sem',
  'que', 'se', 'não', 'nao', 'sim', 'mais', 'menos', 'muito', 'bem', 'já', 'ja', 'também', 'tambem',
  'você', 'voce', 'senhor', 'senhora', 'cliente', 'clientes', 'prezado', 'prezada',
  'olá', 'ola', 'oi', 'obrigado', 'obrigada', 'desculpe', 'aguarde', 'informação', 'informações',
  'dúvida', 'dúvidas', 'problema', 'solução', 'pedido', 'solicitação', 'reclamação',
  'atendimento', 'suporte', 'verificar', 'análise', 'enviar', 'receber', 'retorno', 'aguardar',
  'telefone', 'email', 'endereço', 'endereco', 'nome', 'dados', 'cadastro', 'conta', 'contas',
  'fatura', 'boleto', 'pagamento', 'pagar', 'pago', 'valor', 'valores', 'plano', 'produto',
  'serviço', 'servico', 'internet', 'fibra', 'aplicativo', 'protocolo', 'número', 'numero',
  'chamado', 'ticket', 'status', 'documento', 'anexo', 'link', 'portal', 'acesso', 'senha',
  'preciso', 'precisa', 'poder', 'pode', 'deve', 'fazer', 'estar', 'está', 'esta', 'ser', 'ter',
  'ver', 'falar', 'entender', 'agradecer', 'cordialmente', 'atenciosamente', 'saber', 'olhe',
  'olhar', 'consulte', 'consultar', 'acesse', 'acessar', 'exato', 'exata', 'correto', 'correta',
  'procedimento', 'procedimentos', 'passo', 'passos', 'orientação', 'orientacao', 'instrução',
  'instrucao', 'para', 'sobre', 'como', 'onde', 'quando', 'antes', 'depois', 'hoje', 'amanhã',
  'amanha',
]);

export function normalizeToken(token: string): string {
  return String(token || '').trim().toLowerCase();
}

export function isKnownTypoTarget(word: string): boolean {
  return PT_LEXICON.has(normalizeToken(word));
}

export function lookupKnownTypo(word: string): string | null {
  const key = normalizeToken(word);
  return KNOWN_TYPO_MAP[key] ?? null;
}
