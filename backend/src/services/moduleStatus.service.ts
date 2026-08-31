/**
 * moduleStatus.service v1.0.0 — status dos serviços (Painel 360°), espelha o VeloHub
 * VERSION: v1.0.0 | DATE: 2026-08-31
 *
 * Lê o snapshot mais recente de VeloHubCentral/console_config/module_status (mesma
 * coleção que alimenta o "mostrador de serviços" do VeloHub). Cada save é um documento
 * novo com um campo por módulo (prefixo "_", ex.: "_pessoal": "on"); não fazemos upsert
 * por módulo — só lemos o findOne mais recente por createdAt.
 *
 * A lista de módulos NÃO é fixa aqui: pega dinamicamente todo campo prefixado com "_"
 * do documento (exceto "_id"), então um módulo novo/removido no VeloHub aparece/some do
 * Painel 360° sem precisar mexer no código do Desk.
 */
import { getConsoleConfigConnection, isConsoleConfigConnected } from '../config/database';

const COLLECTION_NAME = 'module_status';

export type ModuleStatusValue = 'on' | 'off' | 'revisao' | string;

export interface ModuleStatusItem {
  key: string;
  label: string;
  status: ModuleStatusValue;
}

function moduleStatusCollection() {
  return getConsoleConfigConnection().db!.collection(COLLECTION_NAME);
}

/** "_pgtoAntecip" → "Pgto Antecip" — genérico, sem dicionário por módulo. */
function labelFromFieldKey(field: string): string {
  const withoutPrefix = field.replace(/^_/, '');
  const spaced = withoutPrefix.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function getModuleStatusItems(): Promise<ModuleStatusItem[]> {
  if (!isConsoleConfigConnected()) return [];

  const doc = await moduleStatusCollection().findOne({}, { sort: { createdAt: -1 } });
  if (!doc) return [];

  return Object.keys(doc)
    .filter((key) => key.startsWith('_') && key !== '_id')
    .map((key) => ({
      key: key.replace(/^_/, ''),
      label: labelFromFieldKey(key),
      status: String((doc as Record<string, unknown>)[key] ?? ''),
    }))
    .filter((item) => item.label);
}
