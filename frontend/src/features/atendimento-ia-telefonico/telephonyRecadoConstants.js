/**
 * telephonyRecadoConstants v2.0.0 — enums do contrato v2 (espelho do backend)
 */

export const RECADO_AREAS = [
  { id: 'geral', label: 'Geral' },
  { id: 'app_cadastro_seguranca', label: 'App, cadastro e segurança' },
  { id: 'conta_e_pix', label: 'Conta e Pix' },
  { id: 'emprestimo_pessoal', label: 'Empréstimo Pessoal' },
  { id: 'antecipacao_salario', label: 'Antecipação de Salário' },
  { id: 'antecipacao_irpf', label: 'Antecipação do Imposto de Renda' },
  { id: 'credito_trabalhador', label: 'Crédito do Trabalhador' },
  { id: 'pagamentos_cobranca_documentos', label: 'Pagamentos, cobrança e documentos' },
  { id: 'seguros', label: 'Seguros' },
  { id: 'beneficios', label: 'Benefícios' },
  { id: 'atendimento_e_chamados', label: 'Atendimento e chamados' },
];

export const RECADO_TIPOS = [
  { id: 'indisponibilidade', label: 'Indisponibilidade' },
  { id: 'instabilidade', label: 'Instabilidade' },
  { id: 'aviso', label: 'Aviso' },
];

export const RECADO_POLITICAS = [
  { id: 'fluxo_normal', label: 'Fluxo normal' },
  { id: 'nao_abrir', label: 'Não abrir chamado' },
  { id: 'abrir_se_persistir', label: 'Abrir se persistir' },
  { id: 'abrir_imediatamente', label: 'Abrir imediatamente' },
];

export const RECADO_PRIORIDADES = [
  { id: 'alta', label: 'Alta' },
  { id: 'media', label: 'Média' },
  { id: 'baixa', label: 'Baixa' },
];

export const EMPTY_RECADO_FORM = {
  titulo: '',
  areas: [],
  tipo: 'instabilidade',
  mensagemCliente: '',
  orientacaoAtendimento: '',
  politicaChamado: 'fluxo_normal',
  criterioChamado: '',
  prioridade: 'alta',
  telefonesOrigemLiberados: '',
};

export function areaLabel(id) {
  return RECADO_AREAS.find((item) => item.id === id)?.label || id;
}

export function politicaLabel(id) {
  return RECADO_POLITICAS.find((item) => item.id === id)?.label || id;
}

export function tipoLabel(id) {
  return RECADO_TIPOS.find((item) => item.id === id)?.label || id;
}
