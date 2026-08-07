/** telephonyRecado.validation v2.0.0 — validação do contrato v2 de recados operacionais */
import {
  RECADO_AREAS,
  RECADO_LIMITS,
  RECADO_POLITICAS,
  RECADO_PRIORIDADES,
  RECADO_TIPOS,
  TelephonyRecadoArea,
  TelephonyRecadoPolitica,
  TelephonyRecadoPrioridade,
  TelephonyRecadoTipo,
} from './telephonyRecado.constants';

const RECADO_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export interface RecadoInputPayload {
  titulo?: unknown;
  areas?: unknown;
  tipo?: unknown;
  mensagemCliente?: unknown;
  orientacaoAtendimento?: unknown;
  politicaChamado?: unknown;
  criterioChamado?: unknown;
  prioridade?: unknown;
  telefonesOrigemLiberados?: unknown;
  ativo?: unknown;
}

export interface ValidatedRecadoInput {
  titulo: string;
  areas: TelephonyRecadoArea[];
  tipo: TelephonyRecadoTipo;
  mensagemCliente: string;
  orientacaoAtendimento: string;
  politicaChamado: TelephonyRecadoPolitica;
  criterioChamado: string | null;
  prioridade: TelephonyRecadoPrioridade;
  telefonesOrigemLiberados: string[] | null;
  ativo: boolean;
}

export function normalizeRecadoPrioridade(value: unknown): TelephonyRecadoPrioridade {
  const raw = String(value ?? 'media').trim().toLowerCase();
  if (raw === 'alta' || raw === 'high') return 'alta';
  if (raw === 'baixa' || raw === 'low') return 'baixa';
  return 'media';
}

export function normalizePhoneE164(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.length >= 12) return `+${digits}`;
  return null;
}

export function normalizeTelefonesOrigem(value: unknown): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) throw new Error('telefonesOrigemLiberados deve ser null ou array');
  if (value.length === 0) return [];
  if (value.length > RECADO_LIMITS.maxHomologPhones) {
    throw new Error(`Máximo de ${RECADO_LIMITS.maxHomologPhones} telefones de homologação`);
  }
  const normalized: string[] = [];
  for (const item of value) {
    const phone = normalizePhoneE164(item);
    if (!phone) throw new Error('Telefone de homologação inválido ou vazio');
    if (phone.length > RECADO_LIMITS.maxPhoneLength) {
      throw new Error(`Telefone de homologação excede ${RECADO_LIMITS.maxPhoneLength} caracteres`);
    }
    normalized.push(phone);
  }
  return [...new Set(normalized)];
}

function parseAreas(value: unknown): TelephonyRecadoArea[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Selecione ao menos uma área');
  }
  if (value.length > RECADO_LIMITS.maxAreasPerItem) {
    throw new Error(`Máximo de ${RECADO_LIMITS.maxAreasPerItem} áreas por recado`);
  }
  const areas: TelephonyRecadoArea[] = [];
  for (const item of value) {
    const code = String(item ?? '').trim();
    if (!RECADO_AREAS.includes(code as TelephonyRecadoArea)) {
      throw new Error(`Área desconhecida: ${code}`);
    }
    if (!areas.includes(code as TelephonyRecadoArea)) {
      areas.push(code as TelephonyRecadoArea);
    }
  }
  return areas;
}

function parseEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  const raw = String(value ?? '').trim();
  if (!allowed.includes(raw as T)) {
    throw new Error(`${label} inválido`);
  }
  return raw as T;
}

function parseRequiredText(value: unknown, label: string, maxLength: number): string {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} é obrigatório`);
  if (text.length > maxLength) {
    throw new Error(`${label} deve ter no máximo ${maxLength} caracteres`);
  }
  return text;
}

export function validateRecadoInput(input: RecadoInputPayload, partial = false): ValidatedRecadoInput {
  const titulo = input.titulo !== undefined
    ? parseRequiredText(input.titulo, 'Título', RECADO_LIMITS.maxTituloLength)
    : partial ? '' : parseRequiredText('', 'Título', RECADO_LIMITS.maxTituloLength);

  const areas = input.areas !== undefined ? parseAreas(input.areas) : partial ? [] : parseAreas([]);
  const tipo = input.tipo !== undefined
    ? parseEnum(input.tipo, RECADO_TIPOS, 'Tipo')
    : partial ? 'aviso' : parseEnum('', RECADO_TIPOS, 'Tipo');

  const mensagemCliente = input.mensagemCliente !== undefined
    ? parseRequiredText(input.mensagemCliente, 'Mensagem ao cliente', RECADO_LIMITS.maxMensagemClienteLength)
    : partial ? '' : parseRequiredText('', 'Mensagem ao cliente', RECADO_LIMITS.maxMensagemClienteLength);

  const orientacaoAtendimento = input.orientacaoAtendimento !== undefined
    ? parseRequiredText(input.orientacaoAtendimento, 'Orientação de atendimento', RECADO_LIMITS.maxOrientacaoLength)
    : partial ? '' : parseRequiredText('', 'Orientação de atendimento', RECADO_LIMITS.maxOrientacaoLength);

  const politicaChamado = input.politicaChamado !== undefined
    ? parseEnum(input.politicaChamado, RECADO_POLITICAS, 'Política de chamado')
    : partial ? 'fluxo_normal' : parseEnum('', RECADO_POLITICAS, 'Política de chamado');

  let criterioChamado: string | null = null;
  if (politicaChamado === 'abrir_se_persistir') {
    if (input.criterioChamado === undefined && partial) {
      criterioChamado = null;
    } else {
      criterioChamado = parseRequiredText(
        input.criterioChamado,
        'Critério para abertura',
        RECADO_LIMITS.maxCriterioLength,
      );
    }
  } else if (input.criterioChamado != null && String(input.criterioChamado).trim()) {
    throw new Error('Critério para abertura só é permitido com política abrir_se_persistir');
  }

  const prioridade = input.prioridade !== undefined
    ? parseEnum(normalizeRecadoPrioridade(input.prioridade), RECADO_PRIORIDADES, 'Prioridade')
    : 'media';

  const telefonesOrigemLiberados = input.telefonesOrigemLiberados !== undefined
    ? normalizeTelefonesOrigem(input.telefonesOrigemLiberados)
    : null;

  const ativo = input.ativo === undefined ? true : Boolean(input.ativo);

  if (!partial && (!titulo || !areas.length || !mensagemCliente || !orientacaoAtendimento)) {
    throw new Error('Preencha todos os campos obrigatórios do recado');
  }

  return {
    titulo,
    areas,
    tipo,
    mensagemCliente,
    orientacaoAtendimento,
    politicaChamado,
    criterioChamado,
    prioridade,
    telefonesOrigemLiberados,
    ativo,
  };
}

export function validateRecadoId(id: string): void {
  if (!id || id.length > RECADO_LIMITS.maxIdLength || !RECADO_ID_PATTERN.test(id)) {
    throw new Error('Identificador do recado inválido');
  }
}

export function generateRecadoId(titulo: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const suffix = Date.now().toString(36);
  const candidate = `${base || 'recado'}-${suffix}`;
  validateRecadoId(candidate);
  return candidate;
}
