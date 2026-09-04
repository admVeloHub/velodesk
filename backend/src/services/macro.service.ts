/** macro.service v1.0.0 — CRUD das macros de resposta rápida do compose */
import type { IMacro } from '../models/Macro';
import { getMacroModel } from '../models/Macro';

export interface MacroDto {
  _id: string;
  nome: string;
  texto: string;
  ordem: number;
  ativo: boolean;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

function macroToDto(doc: IMacro): MacroDto {
  return {
    _id: doc._id.toString(),
    nome: doc.nome,
    texto: doc.texto,
    ordem: doc.ordem,
    ativo: doc.ativo,
    updatedBy: doc.updatedBy,
    createdAt: doc.createdAt?.toISOString?.() || '',
    updatedAt: doc.updatedAt?.toISOString?.() || '',
  };
}

export async function listMacros(includeInactive = true): Promise<MacroDto[]> {
  const Model = getMacroModel();
  const filter = includeInactive ? {} : { ativo: true };
  const docs = await Model.find(filter).sort({ ordem: 1, nome: 1 });
  return docs.map(macroToDto);
}

export async function getMacroById(id: string): Promise<MacroDto | null> {
  const Model = getMacroModel();
  const doc = await Model.findById(id);
  return doc ? macroToDto(doc) : null;
}

export async function createMacro(
  body: { nome?: string; texto?: string; ordem?: number; ativo?: boolean },
  updatedBy: string,
): Promise<MacroDto> {
  const Model = getMacroModel();
  const nome = String(body.nome || '').trim();
  if (!nome) throw new Error('Nome da macro é obrigatório');
  const texto = String(body.texto || '').trim();
  if (!texto) throw new Error('Texto da macro é obrigatório');

  let ordem = body.ordem;
  if (ordem === undefined) {
    const last = await Model.findOne().sort({ ordem: -1 }).select('ordem').lean();
    ordem = ((last as { ordem?: number } | null)?.ordem ?? -1) + 1;
  }

  const doc = await Model.create({
    nome,
    texto,
    ordem,
    ativo: body.ativo !== false,
    updatedBy,
  });
  return macroToDto(doc);
}

export async function updateMacro(
  id: string,
  body: { nome?: string; texto?: string; ordem?: number; ativo?: boolean },
  updatedBy: string,
): Promise<MacroDto | null> {
  const Model = getMacroModel();
  const doc = await Model.findById(id);
  if (!doc) return null;

  if (body.nome !== undefined) {
    const nome = String(body.nome).trim();
    if (!nome) throw new Error('Nome da macro é obrigatório');
    doc.nome = nome;
  }
  if (body.texto !== undefined) {
    const texto = String(body.texto).trim();
    if (!texto) throw new Error('Texto da macro é obrigatório');
    doc.texto = texto;
  }
  if (body.ordem !== undefined) doc.ordem = body.ordem;
  if (body.ativo !== undefined) doc.ativo = body.ativo;
  doc.updatedBy = updatedBy;

  await doc.save();
  return macroToDto(doc);
}

export async function deleteMacro(id: string): Promise<boolean> {
  const Model = getMacroModel();
  const result = await Model.findByIdAndDelete(id);
  return Boolean(result);
}
