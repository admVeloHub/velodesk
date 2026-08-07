/** telephonyRecado.constants v2.0.0 — enums e limites do contrato v2 Contact-Tel */

export const RECADOS_SCHEMA_VERSION = '2.0' as const;

export const RECADO_AREAS = [
  'geral',
  'app_cadastro_seguranca',
  'conta_e_pix',
  'emprestimo_pessoal',
  'antecipacao_salario',
  'antecipacao_irpf',
  'credito_trabalhador',
  'pagamentos_cobranca_documentos',
  'seguros',
  'beneficios',
  'atendimento_e_chamados',
] as const;

export const RECADO_TIPOS = ['indisponibilidade', 'instabilidade', 'aviso'] as const;

export const RECADO_POLITICAS = [
  'fluxo_normal',
  'nao_abrir',
  'abrir_se_persistir',
  'abrir_imediatamente',
] as const;

export const RECADO_PRIORIDADES = ['alta', 'media', 'baixa'] as const;

export const RECADO_LIMITS = {
  maxActiveItems: 20,
  maxAreasPerItem: 5,
  maxIdLength: 128,
  maxTituloLength: 120,
  maxMensagemClienteLength: 500,
  maxOrientacaoLength: 500,
  maxCriterioLength: 500,
  maxHomologPhones: 20,
  maxPhoneLength: 32,
  maxBodyBytes: 32 * 1024,
} as const;

export type TelephonyRecadoArea = (typeof RECADO_AREAS)[number];
export type TelephonyRecadoTipo = (typeof RECADO_TIPOS)[number];
export type TelephonyRecadoPolitica = (typeof RECADO_POLITICAS)[number];
export type TelephonyRecadoPrioridade = (typeof RECADO_PRIORIDADES)[number];

export const RECADO_AREA_LABELS: Record<TelephonyRecadoArea, string> = {
  geral: 'Geral',
  app_cadastro_seguranca: 'App, cadastro e segurança',
  conta_e_pix: 'Conta e Pix',
  emprestimo_pessoal: 'Empréstimo Pessoal',
  antecipacao_salario: 'Antecipação de Salário',
  antecipacao_irpf: 'Antecipação do Imposto de Renda',
  credito_trabalhador: 'Crédito do Trabalhador',
  pagamentos_cobranca_documentos: 'Pagamentos, cobrança e documentos',
  seguros: 'Seguros',
  beneficios: 'Benefícios',
  atendimento_e_chamados: 'Atendimento e chamados',
};
