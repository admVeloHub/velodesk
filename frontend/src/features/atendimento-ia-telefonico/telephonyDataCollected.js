/**
 * telephonyDataCollected v1.0.0 — rótulos e formatadores do dicionário LetícIA
 */

const FIELD_LABELS = {
  rota_atendida: 'Rota atendida',
  produto_identificado: 'Produto identificado',
  primeiro_nome: 'Primeiro nome',
  cpf_resolvido: 'CPF resolvido',
  nome_informado: 'Nome informado',
  cliente_velotax: 'Cliente Velotax',
  assunto_principal: 'Assunto principal',
  duvida_respondida: 'Dúvida respondida',
  precisa_acesso_sistema: 'Precisa acesso ao sistema',
  motivo_acesso_sistema: 'Motivo do acesso',
  chamado_octadesk_registrado: 'Chamado registrado',
  octadesk_ticket_form: 'Formulário Octadesk',
  ids_tickets_abertos: 'IDs dos tickets',
  numeros_tickets_abertos: 'Números dos tickets',
  whatsapp_retorno_confirmado: 'WhatsApp de retorno confirmado',
  identidade_validada: 'Identidade validada',
  handoff_urgente: 'Handoff urgente',
  csat_participou: 'CSAT — participou',
  csat_nota: 'CSAT — nota',
  csat_comentario: 'CSAT — comentário',
  csat_motivo_nao_coletado: 'CSAT — motivo não coletado',
  recados_operacionais_status: 'Status dos recados',
  recados_operacionais_ativos: 'Recados ativos na ligação',
  desfecho: 'Desfecho',
  call_summary: 'Resumo da chamada',
};

const ENUM_LABELS = {
  rota_atendida: {
    emprestimo_pessoal: 'Empréstimo Pessoal',
    antecipacao_salario: 'Antecipação de Salário',
    antecipacao_irpf_2026: 'Antecipação IRPF 2026',
    credito_trabalhador: 'Crédito do Trabalhador',
    celcoin_conta: 'Conta Celcoin',
    procedimentos_gerais: 'Procedimentos gerais',
    triagem_geral: 'Triagem geral',
  },
  desfecho: {
    faq_resolvida: 'FAQ resolvida',
    chamado_sac_registrado: 'Chamado SAC registrado',
    canal_cobranca_especializado: 'Canal de cobrança especializado',
    aguardar_prazo_oficial: 'Aguardar prazo oficial',
    orientacao_seguradora: 'Orientação seguradora',
    orientacao_app: 'Orientação pelo app',
    orientacao_seguranca: 'Orientação de segurança',
    fora_escopo: 'Fora do escopo',
    falha_interacao: 'Falha na interação',
  },
  recados_operacionais_status: {
    not_loaded: 'Não carregado',
    available: 'Disponível',
    empty: 'Sem recados',
    invalid_contract: 'Contrato inválido',
    unavailable: 'Indisponível',
  },
  octadesk_ticket_form: {
    credito: 'Crédito',
    antecipacao_2026: 'Antecipação IRPF 2026',
    solicitacao_atendimento: 'Solicitação de atendimento',
  },
  csat_motivo_nao_coletado: {
    nota_nao_informada: 'Nota não informada',
    comentario_nao_informado: 'Comentário não informado',
    pesquisa_recusada: 'Pesquisa recusada',
    pesquisa_interrompida: 'Pesquisa interrompida',
    nova_demanda_antes_da_pesquisa: 'Nova demanda antes da pesquisa',
    nova_demanda_durante_pesquisa: 'Nova demanda durante a pesquisa',
    recusou: 'Recusou',
    desligou_antes_de_responder: 'Desligou antes de responder',
    sem_resposta: 'Sem resposta',
    nao_oferecida: 'Não oferecida',
  },
};

const FIELD_GROUPS = [
  {
    id: 'demanda',
    title: 'Demanda',
    fields: ['rota_atendida', 'produto_identificado', 'assunto_principal', 'desfecho'],
  },
  {
    id: 'identidade',
    title: 'Identificação',
    fields: ['primeiro_nome', 'cpf_resolvido', 'nome_informado', 'cliente_velotax', 'identidade_validada'],
  },
  {
    id: 'operacional',
    title: 'Operacional',
    fields: ['duvida_respondida', 'precisa_acesso_sistema', 'motivo_acesso_sistema', 'handoff_urgente'],
  },
  {
    id: 'chamado',
    title: 'Chamado',
    fields: [
      'chamado_octadesk_registrado',
      'octadesk_ticket_form',
      'ids_tickets_abertos',
      'numeros_tickets_abertos',
      'whatsapp_retorno_confirmado',
    ],
  },
  {
    id: 'recados',
    title: 'Recados operacionais',
    fields: ['recados_operacionais_status', 'recados_operacionais_ativos'],
  },
  {
    id: 'csat',
    title: 'Pesquisa de satisfação',
    fields: ['csat_participou', 'csat_nota', 'csat_comentario', 'csat_motivo_nao_coletado'],
  },
  {
    id: 'resumo',
    title: 'Resumo',
    fields: ['call_summary'],
  },
];

function extractEntry(raw) {
  if (raw && typeof raw === 'object' && 'value' in raw) {
    return {
      value: raw.value,
      rationale: raw.rationale ?? null,
    };
  }
  return { value: raw ?? null, rationale: null };
}

function translateEnum(fieldKey, value) {
  if (value == null || value === '') return '—';
  const map = ENUM_LABELS[fieldKey];
  if (map && map[String(value)]) return map[String(value)];
  return String(value).replace(/_/g, ' ');
}

function formatBoolean(value) {
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  return '—';
}

function formatArray(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'string' && value.trim()) return value;
  return '—';
}

export function formatDataCollectedValue(fieldKey, rawEntry) {
  const { value } = extractEntry(rawEntry);
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return formatBoolean(value);
  if (fieldKey === 'recados_operacionais_ativos') return value;
  if (Array.isArray(value)) return formatArray(value);
  if (ENUM_LABELS[fieldKey]) return translateEnum(fieldKey, value);
  return String(value);
}

export function parseRecadosAtivos(rawEntry) {
  const { value } = extractEntry(rawEntry);
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function buildDataCollectedSections(dataCollected) {
  if (!dataCollected || typeof dataCollected !== 'object') return [];

  const used = new Set();
  const sections = FIELD_GROUPS.map((group) => {
    const items = group.fields
      .filter((key) => key in dataCollected)
      .map((key) => {
        used.add(key);
        const entry = extractEntry(dataCollected[key]);
        return {
          key,
          label: FIELD_LABELS[key] || key,
          value: entry.value,
          displayValue: formatDataCollectedValue(key, dataCollected[key]),
          rationale: entry.rationale,
          isRecadosJson: key === 'recados_operacionais_ativos',
          recados: key === 'recados_operacionais_ativos'
            ? parseRecadosAtivos(dataCollected[key])
            : [],
        };
      })
      .filter((item) => item.value != null && item.value !== '');
    return { ...group, items };
  }).filter((section) => section.items.length > 0);

  const leftovers = Object.keys(dataCollected)
    .filter((key) => !used.has(key))
    .map((key) => {
      const entry = extractEntry(dataCollected[key]);
      if (entry.value == null || entry.value === '') return null;
      return {
        key,
        label: FIELD_LABELS[key] || key,
        value: entry.value,
        displayValue: formatDataCollectedValue(key, dataCollected[key]),
        rationale: entry.rationale,
        isRecadosJson: false,
        recados: [],
      };
    })
    .filter(Boolean);

  if (leftovers.length) {
    sections.push({ id: 'outros', title: 'Outros', items: leftovers });
  }

  return sections;
}

export function buildCsatSummary(dataCollected) {
  if (!dataCollected || typeof dataCollected !== 'object') return null;

  const participou = extractEntry(dataCollected.csat_participou).value;
  const notaRaw = extractEntry(dataCollected.csat_nota).value;
  const comentario = extractEntry(dataCollected.csat_comentario).value;
  const motivo = extractEntry(dataCollected.csat_motivo_nao_coletado).value;

  if (participou == null && notaRaw == null && !comentario && !motivo) return null;

  const nota = notaRaw != null && Number.isFinite(Number(notaRaw)) ? Number(notaRaw) : null;

  return {
    participou,
    nota,
    comentario: comentario || null,
    motivoNaoColetadoLabel: motivo ? translateEnum('csat_motivo_nao_coletado', motivo) : null,
  };
}

export function desfechoLabel(value) {
  return translateEnum('desfecho', value);
}

export function recadosStatusLabel(value) {
  return translateEnum('recados_operacionais_status', value);
}

export const DESFECHO_FILTER_OPTIONS = Object.entries(ENUM_LABELS.desfecho).map(([id, label]) => ({
  id,
  label,
}));

export const ROTA_FILTER_OPTIONS = Object.entries(ENUM_LABELS.rota_atendida).map(([id, label]) => ({
  id,
  label,
}));
