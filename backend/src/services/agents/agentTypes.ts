/**
 * agentTypes v1.0.0 — contratos dos agentes paralelos VeloDesk
 * VERSION: v1.0.0 | DATE: 2026-07-13
 */

export type TicketAiContextSource = 'public' | 'internal';

export type AuditModo = 'auto_envio' | 'desk_sugestao' | 'pos_humano';

export type AuditDecisao =
  | 'revisar_agente1'
  | 'aprovar_auto'
  | 'bloquear_critico'
  | 'encaminhar_humano'
  | 'exibir_sugestao';

export type NivelCriticidade = 'critica' | 'alta' | 'media' | 'baixa' | 'nenhuma';

export type ConfidenceLevel = 'alta' | 'media' | 'baixa';

export type PipelineModo = 'desk' | 'auto_envio' | 'inbound';

export type RevisaoOrigem = 'automatica_baixo_compliance' | 'solicitada_operador';

export interface TicketAiMessageInput {
  role: 'cliente' | 'agente';
  text: string;
}

export interface TicketAiTabulationResult {
  tipo: string;
  produto: string;
  motivo: string;
  detalhe: string;
  incompleta?: boolean;
}

export interface AtendimentoInput {
  ticketId?: string;
  protocolo?: string;
  titulo?: string;
  canal?: string;
  status?: string;
  clientName?: string;
  nomeOperador?: string;
  contextSource: TicketAiContextSource;
  messages?: TicketAiMessageInput[];
  internalNote?: string;
  produtoHint?: string;
}

export interface AtendimentoResult {
  success: boolean;
  respostaSugerida?: string;
  tabulacao?: TicketAiTabulationResult;
  tabulacaoDisplay?: string;
  confidence?: ConfidenceLevel;
  fontesConsultadas?: string[];
  model?: string;
  error?: string;
}

export interface RevisaoInput extends AtendimentoInput {
  respostaAnterior: string;
  tabulacaoAnterior: TicketAiTabulationResult;
  violacoes?: string[];
  recomendacoes?: string[];
  origemRevisao: RevisaoOrigem;
  inputOperador?: string;
  auditScore?: number;
}

export interface CriterioAvaliado {
  criterio: string;
  conforme: boolean;
  observacao?: string;
}

export interface AuditoriaInput {
  modo: AuditModo;
  protocolo?: string;
  canal?: string;
  status?: string;
  nomeOperador?: string;
  dataEnvio?: string;
  contextSource?: TicketAiContextSource;
  messages?: TicketAiMessageInput[];
  internalNote?: string;
  respostaSugerida: string;
  tabulacao: TicketAiTabulationResult;
  confidence?: ConfidenceLevel;
  mensagemOperador?: string;
  ultimaMensagemCliente?: string;
  palavrasCriticasPrecheck?: string[];
}

export interface AuditoriaResult {
  success: boolean;
  aprovado?: boolean;
  score?: number;
  modo?: AuditModo;
  decisao?: AuditDecisao;
  nivelCriticidade?: NivelCriticidade;
  impactoGravidade?: 'alto' | 'medio' | 'baixo';
  categoriaAtendimento?: string;
  palavrasCriticasDetectadas?: string[];
  requerRevisaoAgente1?: boolean;
  notificarAgente3?: boolean;
  violacoes?: string[];
  recomendacoes?: string[];
  criteriosAvaliados?: CriterioAvaliado[];
  model?: string;
  error?: string;
}

export interface PipelineInput extends AtendimentoInput {
  pipelineModo: PipelineModo;
}

export interface PipelineResult {
  success: boolean;
  respostaSugerida?: string;
  tabulacao?: TicketAiTabulationResult;
  tabulacaoDisplay?: string;
  confidence?: ConfidenceLevel;
  auditScore?: number;
  auditAprovado?: boolean;
  auditDecisao?: AuditDecisao;
  auditComplete?: boolean;
  nivelCriticidade?: NivelCriticidade;
  envioAutonomo?: boolean;
  revisoesRealizadas?: number;
  model?: string;
  error?: string;
  source?: string;
}

export interface GestaoHandoffInput {
  ticketId: string;
  protocolo: string;
  nivelCriticidade: NivelCriticidade;
  palavrasCriticas?: string[];
  categoriaAtendimento?: string;
  origem?: string;
  auditScore?: number;
  produto?: string;
  motivo?: string;
}

export interface GestaoHandoffResult {
  success: boolean;
  responsavelAtribuido?: string;
  escalonar?: string;
  statusAtualizado?: string;
  notificacoesEnviadas?: string[];
  alertId?: string;
  error?: string;
}
