/** ticketMerge.service v1.0.0 — mesclagem atômica de tickets duplicados (Client360) */
import type { AuthPayload } from '../middleware/auth';
import { Box } from '../models/Box';
import { ChamadoN1, IChamadoN1, IRegistro, ITabulacao } from '../models/ChamadoN1';
import {
  chamadoToTicket,
  currentStatus,
  gestaoTerminalStatusVariants,
  readTabulacaoSnapshot,
  resolveBoxIdForChamado,
  resolveRegistroAutor,
  type TicketDto,
} from './chamado.mapper';
import {
  assertCanActOnTicket,
  PermissionDeniedError,
} from './permission.service';
import { assertTabulacaoForStatus, TabulacaoValidationError } from './tabulation.service';

export { PermissionDeniedError, TabulacaoValidationError };

export class TicketMergeError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'TicketMergeError';
    this.status = status;
  }
}

function normalizeCpf(value?: string): string {
  return String(value ?? '').replace(/\D/g, '');
}

function getChamadoCpf(chamado: IChamadoN1): string {
  return normalizeCpf(chamado.cliente?.[0]?.clienteCpf);
}

function isTerminalStatus(status: string): boolean {
  const terminal = new Set(gestaoTerminalStatusVariants());
  return terminal.has(status.toLowerCase());
}

function isAlreadyMergedSource(chamado: IChamadoN1): boolean {
  return (chamado.registro ?? []).some((reg) => {
    const meta = reg.metadados;
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
    const merge = (meta as Record<string, unknown>).merge;
    return Boolean(
      merge
      && typeof merge === 'object'
      && (merge as Record<string, unknown>).role === 'source',
    );
  });
}

function buildMergeNote(sourceProtocol: string, targetProtocol: string): string {
  return `O ticket #${sourceProtocol} foi mesclado ao chamado #${targetProtocol}.`;
}

function diffTabulacao(before: ITabulacao, after: ITabulacao): Record<string, string> {
  const change: Record<string, string> = {};
  (['tipoChamado', 'produto', 'motivo', 'detalhe', 'responsavel', 'atribuido'] as const).forEach((key) => {
    const prev = String(before[key] ?? '').trim();
    const next = String(after[key] ?? '').trim();
    if (prev !== next) change[key] = next;
  });
  return change;
}

function appendMergeRegistro(
  chamado: IChamadoN1,
  params: {
    anotacaoInterna: string;
    status: string;
    metadados: Record<string, unknown>;
    alteracoes?: unknown[];
    authUser?: AuthPayload | null;
  },
): void {
  const autor = resolveRegistroAutor('agente', { authUser: params.authUser });
  const entry: IRegistro = {
    data: new Date(),
    origin: 'agente',
    autor,
    mensagemPublica: '',
    anexosMensagemPublica: [],
    anotacaoInterna: params.anotacaoInterna,
    anexosAnotacaoInterna: [],
    alteracoes: params.alteracoes ?? [],
    metadados: params.metadados,
    status: params.status,
  };
  if (!chamado.registro) chamado.registro = [];
  chamado.registro.push(entry);
}

export async function mergeTicketInto(
  sourceId: string,
  targetId: string,
  authUser: AuthPayload,
): Promise<{ source: TicketDto; target: TicketDto }> {
  if (sourceId === targetId) {
    throw new TicketMergeError('Não é possível mesclar um ticket com ele mesmo.');
  }

  const [sourceChamado, targetChamado] = await Promise.all([
    ChamadoN1.findById(sourceId),
    ChamadoN1.findById(targetId),
  ]);

  if (!sourceChamado || !targetChamado) {
    throw new TicketMergeError('Ticket não encontrado.', 404);
  }

  await assertCanActOnTicket(authUser, sourceChamado);
  await assertCanActOnTicket(authUser, targetChamado);

  const sourceCpf = getChamadoCpf(sourceChamado);
  const targetCpf = getChamadoCpf(targetChamado);
  if (!sourceCpf || sourceCpf !== targetCpf) {
    throw new TicketMergeError('Os tickets devem pertencer ao mesmo cliente (CPF).');
  }

  const targetStatus = currentStatus(targetChamado);
  if (isTerminalStatus(targetStatus)) {
    throw new TicketMergeError('O chamado de destino não está em andamento.');
  }

  if (isAlreadyMergedSource(sourceChamado)) {
    throw new TicketMergeError('Este ticket já foi mesclado anteriormente.');
  }

  const sourceProtocol = sourceChamado.chamadoProtocolo?.trim()
    || sourceChamado._id.toString();
  const targetProtocol = targetChamado.chamadoProtocolo?.trim()
    || targetChamado._id.toString();
  const mergeNote = buildMergeNote(sourceProtocol, targetProtocol);

  const beforeTab = readTabulacaoSnapshot(sourceChamado.tabulacao?.[0]);
  const targetTab = readTabulacaoSnapshot(targetChamado.tabulacao?.[0]);
  sourceChamado.tabulacao = [targetTab];

  await assertTabulacaoForStatus(targetTab, 'resolvido');

  const tabChanges = diffTabulacao(beforeTab, targetTab);

  appendMergeRegistro(sourceChamado, {
    anotacaoInterna: mergeNote,
    status: 'resolvido',
    alteracoes: Object.keys(tabChanges).length ? [tabChanges] : [],
    metadados: {
      merge: {
        role: 'source',
        targetId: targetChamado._id.toString(),
        targetProtocol,
      },
    },
    authUser,
  });

  appendMergeRegistro(targetChamado, {
    anotacaoInterna: mergeNote,
    status: targetStatus,
    metadados: {
      merge: {
        role: 'target',
        sourceId: sourceChamado._id.toString(),
        sourceProtocol,
      },
    },
    authUser,
  });

  await Promise.all([sourceChamado.save(), targetChamado.save()]);

  const boxes = await Box.find().sort({ order: 1 });
  const [sourceTicket, targetTicket] = await Promise.all([
    chamadoToTicket(sourceChamado, await resolveBoxIdForChamado(sourceChamado, boxes)),
    chamadoToTicket(targetChamado, await resolveBoxIdForChamado(targetChamado, boxes)),
  ]);

  return { source: sourceTicket, target: targetTicket };
}
