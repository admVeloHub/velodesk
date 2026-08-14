/** parseConsumidorGovEmail v1.0.0 — parser e-mail estruturado PRIORIZAR - CGOV */
import type { InboundEmailPayload } from './types';

export const CGOV_PRIORITY_SUBJECT_PATTERN = /PRIORIZAR\s*-\s*CGOV/i;

export interface ParsedCgovInboundEmail {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  cidade: string;
  uf: string;
  protocolo: string;
  area: string;
  assunto: string;
  problema: string;
  situacao: string;
  dataAberturaIso?: string;
  prazoIso?: string;
  protocoloEmpresa: string;
  descricao: string;
  isValid(): boolean;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCpf(value: string): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 11);
}

function normalizeTelefone(value: string): string {
  return String(value ?? '').replace(/\D/g, '');
}

function parseLocalidade(value: string): { cidade: string; uf: string } {
  const raw = String(value ?? '').trim();
  if (!raw) return { cidade: '', uf: '' };
  const parts = raw.split(/\s*-\s*/);
  if (parts.length >= 2) {
    const uf = parts[parts.length - 1].trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(uf)) {
      return {
        cidade: parts.slice(0, -1).join(' - ').trim(),
        uf,
      };
    }
  }
  return { cidade: raw, uf: '' };
}

function parseBrDate(value: string, endOfDay = false): string | undefined {
  const match = String(value ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return undefined;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 12,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function extractField(text: string, labels: string[]): string {
  for (const label of labels) {
    const escaped = escapeRegex(label);
    const patterns = [
      new RegExp(`^${escaped}\\s*[:\\t]\\s*(.+)$`, 'im'),
      new RegExp(`^${escaped}\\s+(.+)$`, 'im'),
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
  }
  return '';
}

function extractSection(text: string, header: string, nextHeaders: string[]): string {
  const startPattern = new RegExp(`^\\s*${escapeRegex(header)}\\s*$`, 'im');
  const startMatch = text.match(startPattern);
  if (!startMatch || startMatch.index == null) return '';

  const start = startMatch.index + startMatch[0].length;
  let end = text.length;
  for (const next of nextHeaders) {
    const nextPattern = new RegExp(`^\\s*${escapeRegex(next)}\\s*$`, 'im');
    const nextMatch = text.slice(start).match(nextPattern);
    if (nextMatch?.index != null) {
      end = Math.min(end, start + nextMatch.index);
    }
  }
  return text.slice(start, end).trim();
}

function extractDescricao(text: string): string {
  const block = extractSection(text, 'Descrição da Reclamação', []);
  if (!block) return '';

  const lines = block.split(/\r?\n/);
  const cleaned: string[] = [];
  let skippedHeader = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!skippedHeader && /^descri[cç][aã]o$/i.test(trimmed)) {
      skippedHeader = true;
      continue;
    }
    cleaned.push(line);
  }

  return cleaned.join('\n').trim();
}

function hasCgovBodyStructure(text: string): boolean {
  const body = String(text ?? '');
  return body.includes('Dados do Reclamante') && body.includes('Dados da Reclamação');
}

export function isCgovPrioritySubject(subject: string): boolean {
  return CGOV_PRIORITY_SUBJECT_PATTERN.test(String(subject ?? '').trim());
}

export function isCgovStructuredInboundEmail(
  payload: InboundEmailPayload,
  bodyText?: string,
): boolean {
  if (isCgovPrioritySubject(payload.subject)) return true;
  const body = bodyText ?? payload.textBody ?? '';
  return hasCgovBodyStructure(body);
}

export function parseConsumidorGovInboundEmail(bodyText: string): ParsedCgovInboundEmail {
  const text = String(bodyText ?? '').replace(/\r\n/g, '\n');

  const reclamanteSection = extractSection(text, 'Dados do Reclamante', [
    'Dados da Reclamação',
    'Descrição da Reclamação',
  ]);
  const reclamacaoSection = extractSection(text, 'Dados da Reclamação', [
    'Descrição da Reclamação',
  ]);

  const nome = extractField(reclamanteSection, ['Nome']);
  const cpf = normalizeCpf(extractField(reclamanteSection, ['CPF']));
  const email = extractField(reclamanteSection, ['E-mail', 'Email']);
  const telefone = normalizeTelefone(extractField(reclamanteSection, ['Telefone']));
  const localidade = parseLocalidade(extractField(reclamanteSection, ['Localidade']));

  const protocolo = extractField(reclamacaoSection, ['Protocolo']).replace(/^#+/, '').trim();
  const area = extractField(reclamacaoSection, ['Área', 'Area']);
  const assunto = extractField(reclamacaoSection, ['Assunto']);
  const problema = extractField(reclamacaoSection, ['Problema']);
  const situacao = extractField(reclamacaoSection, ['Situação', 'Situacao']);
  const aberturaRaw = extractField(reclamacaoSection, ['Abertura']);
  const prazoRaw = extractField(reclamacaoSection, ['Prazo']);
  const protocoloEmpresa = extractField(reclamacaoSection, ['Protocolo da empresa']);
  const descricao = extractDescricao(text);

  const dataAberturaIso = parseBrDate(aberturaRaw, false);
  const prazoIso = parseBrDate(prazoRaw, true);

  const parsed: ParsedCgovInboundEmail = {
    nome,
    cpf,
    email,
    telefone,
    cidade: localidade.cidade,
    uf: localidade.uf,
    protocolo,
    area,
    assunto,
    problema,
    situacao,
    dataAberturaIso,
    prazoIso,
    protocoloEmpresa,
    descricao,
    isValid() {
      return Boolean(
        parsed.nome
        && parsed.cpf.length === 11
        && parsed.protocolo
        && parsed.assunto
        && parsed.descricao,
      );
    },
  };

  return parsed;
}
