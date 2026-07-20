/** migrateEscalonarPermissao v1.0.0 — workspace.escalonar → tickets.escalonar */
import { getDeskFuncaoPermissaoModel } from '../models/DeskFuncaoPermissao';
import { invalidateFuncaoPermissaoCache } from './funcaoPermissao.service';

export async function migrateEscalonarPermissao(): Promise<number> {
  const Model = getDeskFuncaoPermissaoModel();
  const docs = await Model.find({
    'permissoes.workspace.escalonar': { $exists: true },
  });

  let updated = 0;
  for (const doc of docs) {
    const permissoes = doc.permissoes as Record<string, Record<string, boolean>> | undefined;
    if (!permissoes?.workspace || permissoes.workspace.escalonar === undefined) continue;

    const escalonar = permissoes.workspace.escalonar;
    if (!permissoes.tickets) permissoes.tickets = {};
    if (permissoes.tickets.escalonar === undefined) {
      permissoes.tickets.escalonar = escalonar;
    }
    delete permissoes.workspace.escalonar;

    doc.permissoes = permissoes;
    doc.markModified('permissoes');
    await doc.save();
    updated += 1;
  }

  if (updated > 0) {
    invalidateFuncaoPermissaoCache();
    console.log(`Migração escalonar→tickets: ${updated} função(ões) atualizada(s)`);
  }

  return updated;
}
