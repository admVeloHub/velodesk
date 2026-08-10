export const DEFAULT_QUEUE_EXTERNAL_IDS = [
  '68a4cecc60d8c4fe3ccf6371', // Credito P1
  '68a4cccc9b6d9dfe77f56b73', // Credito P2 / Portabilidade
  '672bb28d03c19b4515bc8d4b', // Calculadora
  '69cae90abb1c77576ebedbb6', // Suporte eCac
  '69ebbca326437217d30a801f', // Consumidor.gov
  '672bb27f2d20e0452535e0d2', // IRPF legado
];

// Modelo do Dashboard: "todas as filas, EXCETO" estas. Cobre filas ativas/ramal
// (saída interna) e cobrança — que ficam desmarcadas na operação. As demais filas
// (inclusive redirecionamento p/ IA e ligações retidas na URA sem fila) entram.
// Enviado ao SQL como padrões ILIKE (get_dashboard_kpis / get_dashboard_by_queue).
export const DASHBOARD_EXCLUDED_QUEUE_PATTERNS = ['%ativo%', '%ramal%', '%cobranca%', '%cobrança%'];

const EXCLUDED_QUEUE_REGEXES = [/ativo/, /ramal/, /cobran[cç]a/];

// Guarda equivalente à exclusão do SQL, para uso no client/rotas (ex.: satisfação, export).
// Fila vazia (URA sem fila) NÃO é excluída — conta como recebida.
export function isExcludedDashboardQueue(name: string | null | undefined): boolean {
  const n = String(name ?? '').trim().toLowerCase();
  if (!n) return false;
  return EXCLUDED_QUEUE_REGEXES.some((re) => re.test(n));
}

const QUEUE_DISPLAY_BY_EXTERNAL_ID: Record<string, string> = {
  '68a4cecc60d8c4fe3ccf6371': 'Crédito',
  '68a4cccc9b6d9dfe77f56b73': 'Portabilidade',
  '672bb28d03c19b4515bc8d4b': 'Calculadora',
  '69cae90abb1c77576ebedbb6': 'Suporte eCac',
  '69ebbca326437217d30a801f': 'Consumidor.gov',
};

const QUEUE_BY_ORIGIN_PHONE: Record<string, { externalId: string; name: string }> = {
  '08002371339': { externalId: '69cae90abb1c77576ebedbb6', name: 'Suporte eCac' },
  '1130422019': { externalId: '69ebbca326437217d30a801f', name: 'Consumidor.gov' },
  '551130422019': { externalId: '69ebbca326437217d30a801f', name: 'Consumidor.gov' },
};

export function onlyDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function queueByOriginPhone(value: string | null | undefined): { externalId: string; name: string } | null {
  const digits = onlyDigits(value);
  return QUEUE_BY_ORIGIN_PHONE[digits] ?? null;
}

/**
 * Números que aparecem no campo "Operador" quando a ligação é redirecionada (via fila
 * "...redirecionamento...") para a IA de voz Letícia — diferente de `QUEUE_BY_ORIGIN_PHONE`
 * (que usa "Telefone Entrada"/DID, não "Operador"). Existem outras regras de redirecionamento
 * que não vão para a Letícia; só os números aqui contam como Letícia.
 */
export const LETICIA_OPERATOR_PHONES = ['08002371339'];

/** Fila de redirecionamento da 55PBX (ex.: "4691-redirecionamento") — mesmo critério usado em `queueDisplayName`. */
export function isRedirectQueueName(name: string | null | undefined): boolean {
  return normalizeQueueName(String(name ?? '')).includes('redirecionamento');
}

/** Ligação atendida via redirecionamento cujo "Operador" é um dos números da Letícia. */
export function isLeticiaOperatorPhone(operador: string | null | undefined): boolean {
  const digits = onlyDigits(operador);
  return digits.length > 0 && LETICIA_OPERATOR_PHONES.includes(digits);
}

function normalizeQueueName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function queueDisplayName(name: string | null | undefined, externalId?: string | null): string {
  if (externalId && QUEUE_DISPLAY_BY_EXTERNAL_ID[externalId]) {
    return QUEUE_DISPLAY_BY_EXTERNAL_ID[externalId];
  }

  const raw = String(name ?? '').trim();
  if (!raw) return 'Não identificada';

  const normalized = normalizeQueueName(raw);
  if (normalized.includes('credito_p1')) return 'Crédito';
  if (normalized.includes('credito_p2') || normalized.includes('credito__p2')) return 'Portabilidade';
  if (normalized.includes('calculadora')) return 'Calculadora';
  if (normalized.includes('suporte_ecac') || normalized.includes('ecac')) return 'Suporte eCac';
  if (normalized.includes('consumidor_gov')) return 'Consumidor.gov';
  if (normalized.includes('redirecionamento')) return 'Atendimento IA telefone';

  return raw;
}
