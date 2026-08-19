/** reclameAquiTicketCreate.service v1.1.1 — lote Hug Me sem roteamento/sininho por linha */
import { Types } from 'mongoose';
import { ChamadoN1 } from '../../models/ChamadoN1';
import type { IChamadoN1 } from '../../models/ChamadoN1';
import { createChamadoFromBody } from '../chamado.mapper';
import { buildFastPathTriagem } from '../agents/casosEspeciaisAgent.service';
import { routeCasoEspecialFormal } from '../agents/casosEspeciaisRouting.service';
import {
  findByChamadoId,
  findByIdDemandaExterna,
  upsertFromChamado,
} from '../reclamacoes/reclamacao.service';
import type { IReclameAquiHugmeRegistro } from '../../models/reclamacoes/ReclameAquiHugmeRegistro.schema';
import type { ParsedHugmeRow } from './hugmeSpreadsheet.service';

export interface RaTicketSource {
  idOrigem: string;
  idHugme?: string;
  consumidor: string;
  cpf?: string;
  email?: string;
  telefoneWhatsapp?: string;
  assunto: string;
  descricao: string;
  produto?: string;
  tipo?: string;
  hugmeMotivoRa?: string;
  hugmeCategoriaRa?: string;
  hugmeProblemaRa?: string;
  statusRa?: string;
  dataReclamacao?: string | Date;
  respostaPublica?: string;
  cidade?: string;
  uf?: string;
}

function asIso(value: string | Date | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const raw = String(value).trim();
  return raw || undefined;
}

export function registroToRaTicketSource(
  registro: IReclameAquiHugmeRegistro,
  row?: ParsedHugmeRow,
): RaTicketSource {
  const cols = (registro.colunasOriginais || {}) as Record<string, string>;
  return {
    idOrigem: String(registro.idOrigem || '').trim(),
    idHugme: String(registro.idHugme || '').trim(),
    consumidor: String(registro.consumidor || '').trim(),
    cpf: String(registro.cpf || '').trim(),
    email: String(registro.email || '').trim(),
    telefoneWhatsapp: String(registro.telefoneWhatsapp || '').trim(),
    assunto: String(registro.assunto || '').trim(),
    descricao: String(registro.descricao || '').trim(),
    produto: String(registro.produto || '').trim(),
    tipo: String(registro.tipo || 'Reclamação').trim(),
    hugmeMotivoRa: row?.hugmeMotivoRa || cols['Motivo da Reclamação RA'] || cols['Motivo da Reclamacao RA'] || '',
    hugmeCategoriaRa: row?.hugmeCategoriaRa || cols['Categoria RA'] || '',
    hugmeProblemaRa: row?.hugmeProblemaRa || cols['Problema RA'] || '',
    statusRa: String(registro.statusRa || '').trim() || 'nao-respondida',
    dataReclamacao: registro.dataReclamacao,
    respostaPublica: String(registro.respostaPublica || '').trim(),
    cidade: String(registro.cidade || '').trim(),
    uf: String(registro.uf || '').trim(),
  };
}

export function parsedRowToRaTicketSource(row: ParsedHugmeRow): RaTicketSource {
  return {
    idOrigem: String(row.idOrigem || '').trim(),
    idHugme: String(row.idHugme || '').trim(),
    consumidor: String(row.consumidor || '').trim(),
    cpf: String(row.cpf || '').trim(),
    email: String(row.email || '').trim(),
    telefoneWhatsapp: String(row.telefoneWhatsapp || '').trim(),
    assunto: String(row.assunto || '').trim(),
    descricao: String(row.descricao || '').trim(),
    produto: String(row.produto || '').trim(),
    tipo: String(row.tipo || 'Reclamação').trim(),
    hugmeMotivoRa: row.hugmeMotivoRa || '',
    hugmeCategoriaRa: row.hugmeCategoriaRa || '',
    hugmeProblemaRa: row.hugmeProblemaRa || '',
    statusRa: String(row.statusRa || '').trim() || 'nao-respondida',
    dataReclamacao: row.dataReclamacao,
    respostaPublica: String(row.respostaPublica || '').trim(),
    cidade: String(row.cidade || '').trim(),
    uf: String(row.uf || '').trim(),
  };
}

function buildReclameAquiMeta(source: RaTicketSource) {
  const idOrigem = String(source.idOrigem || '').trim();
  return {
    protocoloRa: idOrigem,
    idReclamacaoRa: idOrigem,
    idOrigem,
    idHugme: String(source.idHugme || '').trim(),
    statusRa: source.statusRa || 'nao-respondida',
    dataReclamacao: asIso(source.dataReclamacao),
    assunto: source.assunto,
    descricao: source.descricao,
    consumidor: source.consumidor,
    cpf: source.cpf,
    produto: source.produto,
    tipo: source.tipo,
    cidade: source.cidade,
    uf: source.uf,
    hugmeMotivoRa: source.hugmeMotivoRa || '',
    hugmeCategoriaRa: source.hugmeCategoriaRa || '',
    hugmeProblemaRa: source.hugmeProblemaRa || '',
    passivelNota: false,
  };
}

export function buildTicketPayloadFromRaSource(source: RaTicketSource, author = 'sistema') {
  const meta = buildReclameAquiMeta(source);
  const cpf = String(source.cpf ?? '').replace(/\D/g, '');

  return {
    chamadoTitulo: String(source.assunto || '').trim() || 'Reclamação Reclame Aqui',
    title: String(source.assunto || '').trim() || 'Reclamação Reclame Aqui',
    text: String(source.descricao || '').trim(),
    description: String(source.descricao || '').trim(),
    status: 'novo',
    clientName: String(source.consumidor || '').trim(),
    clientCPF: cpf || undefined,
    author,
    lateralForm: {
      classificacaoTipo: source.tipo || 'Reclamação',
      tipoChamado: source.tipo || 'Reclamação',
      produto: '',
      motivo: '',
      detalhe: 'Reclamação Reclame Aqui',
      canal: 'Reclame Aqui',
      responsavel: author,
      clienteCpf: cpf,
      cpf,
      clienteNome: source.consumidor || '',
      clienteTelefone: source.telefoneWhatsapp ? [source.telefoneWhatsapp] : [],
      clienteEmail: source.email ? [source.email] : [],
      reclameAqui: meta,
    },
  };
}

export function buildTicketPayloadFromHugmeRegistro(
  registro: IReclameAquiHugmeRegistro,
  _workflow: Record<string, unknown> | null,
  author = 'sistema',
) {
  return buildTicketPayloadFromRaSource(registroToRaTicketSource(registro), author);
}

function buildPersistedTriagem(idOrigem: string, origemEntrada: string) {
  const triagem = buildFastPathTriagem('reclame_aqui', [
    `${origemEntrada}:reclame-aqui`,
    `idOrigem:${idOrigem}`,
  ]);
  return {
    ...triagem,
    signals: [`${origemEntrada}:reclame-aqui`],
    at: new Date().toISOString(),
  };
}

async function persistRaReclamacao(
  chamado: IChamadoN1,
  source: RaTicketSource,
  origemEntrada: string,
  options: { route?: boolean } = {},
) {
  const persisted = buildPersistedTriagem(source.idOrigem, origemEntrada);
  if (options.route !== false) {
    const routed = await routeCasoEspecialFormal(chamado, persisted, { origemEntrada });
    if (!routed.success) {
      throw new Error(routed.error || 'Falha no roteamento Reclame Aqui');
    }
  }

  let reclamacao = await findByChamadoId('reclame_aqui', chamado._id!.toString());
  if (!reclamacao || options.route === false) {
    reclamacao = await upsertFromChamado(chamado, persisted, { origemEntrada });
  }
  if (!reclamacao) {
    throw new Error('Falha ao persistir reclamacao em reclamacoes_reclameAqui');
  }
  return reclamacao;
}

async function appendRespostaPublica(chamado: IChamadoN1, text: string, author: string) {
  if (!text.trim() || !chamado.registro?.[0]) return;
  chamado.registro.push({
    data: new Date(),
    origin: 'agente',
    autor: author,
    mensagemPublica: text.trim(),
    anexosMensagemPublica: [],
    anotacaoInterna: '',
    anexosAnotacaoInterna: [],
    alteracoes: [],
    metadados: { source: 'hugme-import-resposta' },
    status: 'novo',
  });
  chamado.markModified('registro');
  await chamado.save();
}

export interface CreateRaTicketResult {
  chamadoId: Types.ObjectId;
  chamadoProtocolo: string;
  reclamacaoId: Types.ObjectId;
  updated?: boolean;
}

export async function upsertRaTicketFromSource(
  source: RaTicketSource,
  author = 'sistema',
  origemEntrada = 'hugme-import',
): Promise<CreateRaTicketResult> {
  const idOrigem = String(source.idOrigem || '').trim();
  if (!idOrigem) {
    throw new Error('Id Origem obrigatório');
  }

  const existing = await findByIdDemandaExterna('reclame_aqui', idOrigem);
  if (existing?.chamadoId) {
    const chamado = await ChamadoN1.findById(existing.chamadoId);
    if (!chamado) {
      throw new Error(`Chamado ${existing.chamadoId} não encontrado para Id Origem ${idOrigem}`);
    }

    const payload = buildTicketPayloadFromRaSource(source, author);
    const lf = payload.lateralForm as Record<string, unknown>;
    chamado.chamadoTitulo = payload.chamadoTitulo;
    const raMeta = lf.reclameAqui;
    const registros = chamado.registro ?? [];
    const raIdx = registros.findIndex(
      (reg) => String(reg.metadados?.source ?? '').toLowerCase() === 'reclame-aqui',
    );
    if (raIdx >= 0) {
      const existingMeta = registros[raIdx].metadados && typeof registros[raIdx].metadados === 'object'
        ? registros[raIdx].metadados
        : {};
      registros[raIdx].metadados = {
        ...existingMeta,
        source: 'reclame-aqui',
        reclameAqui: raMeta,
      };
      chamado.markModified('registro');
    }
    const lastIdx = chamado.tabulacao?.length ? chamado.tabulacao.length - 1 : -1;
    if (lastIdx >= 0) {
      chamado.tabulacao[lastIdx] = {
        ...chamado.tabulacao[lastIdx],
        canal: 'Reclame Aqui',
      };
      chamado.markModified('tabulacao');
    }
    await chamado.save();

    const reclamacao = await persistRaReclamacao(chamado, source, origemEntrada, { route: false });

    return {
      chamadoId: chamado._id as Types.ObjectId,
      chamadoProtocolo: String(chamado.chamadoProtocolo ?? ''),
      reclamacaoId: reclamacao._id as Types.ObjectId,
      updated: true,
    };
  }

  const payload = buildTicketPayloadFromRaSource(source, author);
  const partial = await createChamadoFromBody(payload, 'novo');
  const chamado = await ChamadoN1.create(partial) as IChamadoN1;
  const reclamacao = await persistRaReclamacao(chamado, source, origemEntrada, {
    route: origemEntrada !== 'hugme-import',
  });
  await appendRespostaPublica(chamado, source.respostaPublica || '', author);

  return {
    chamadoId: chamado._id as Types.ObjectId,
    chamadoProtocolo: String(chamado.chamadoProtocolo ?? ''),
    reclamacaoId: reclamacao._id as Types.ObjectId,
    updated: false,
  };
}

export async function createRaTicketFromHugmeRegistro(
  registro: IReclameAquiHugmeRegistro,
  author = 'sistema',
  row?: ParsedHugmeRow,
): Promise<CreateRaTicketResult> {
  return upsertRaTicketFromSource(
    registroToRaTicketSource(registro, row),
    author,
    'hugme-import',
  );
}
