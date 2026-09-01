/** seed-funcoes-permissoes v1.0.0 — inicializa funções/permissões padrão em setup local */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { getDeskFuncaoPermissaoModel } from '../src/models/DeskFuncaoPermissao';

const DEFAULT_FUNCOES = [
  {
    slug: 'atendimento-n1',
    nome: 'Atendimento N1',
    nivel: 1,
    herdaDe: [],
    portalVisivel: ['agent', 'especiais'],
    permissoes: {
      tickets: {
        ver_proprios: true,
        atuar_responsavel: true,
        ver_tipos_canais: ['email', 'whatsapp', 'telefone'],
      },
      workspace: { dashboard: true },
      acesso: { tickets: true },
    },
  },
  {
    slug: 'atendimento-n2',
    nome: 'Atendimento N2',
    nivel: 2,
    herdaDe: ['atendimento-n1'],
    portalVisivel: ['agent', 'especiais'],
    permissoes: {
      tickets: {
        ver_todos: true,
        atuar_responsavel: true,
        assumir_ticket: true,
        ver_tipos_canais: ['email', 'whatsapp', 'telefone'],
      },
      workspace: { dashboard: true },
      workflow: { painel_aprovacao: true },
      acesso: { tickets: true, workflow: true },
    },
  },
  {
    slug: 'financeiro',
    nome: 'Financeiro',
    nivel: 3,
    herdaDe: [],
    portalVisivel: ['agent'],
    permissoes: {
      tickets: {
        ver_todos: true,
        atuar_responsavel: true,
        ver_tipos_canais: ['email'],
      },
      workspace: { dashboard: true },
      acesso: { tickets: true },
    },
  },
  {
    slug: 'produtos',
    nome: 'Produtos',
    nivel: 3,
    herdaDe: [],
    portalVisivel: ['agent', 'config'],
    permissoes: {
      tickets: { ver_todos: true },
      workspace: { dashboard: true },
      config: { tabulacao: true, workflow: true, email: true },
      acesso: { tickets: true, config: true },
    },
  },
  {
    slug: 'gestor',
    nome: 'Gestor de Equipe',
    nivel: 2,
    herdaDe: ['atendimento-n2'],
    portalVisivel: ['agent', 'gestao', 'workflow', 'especiais'],
    permissoes: {
      tickets: {
        ver_todos: true,
        atuar_responsavel: true,
        assumir_ticket: true,
        ver_tipos_canais: ['email', 'whatsapp', 'telefone'],
      },
      workspace: { dashboard: true, painel_360: true },
      workflow: { painel_aprovacao: true, gerenciar_workflows: true },
      acesso: { tickets: true, workspace: true, workflow: true },
    },
  },
  {
    slug: 'suporte',
    nome: 'Suporte Técnico',
    nivel: 2,
    herdaDe: ['atendimento-n1'],
    portalVisivel: ['agent', 'especiais'],
    permissoes: {
      tickets: {
        ver_todos: true,
        atuar_responsavel: true,
        assumir_ticket: true,
        ver_tipos_canais: ['email', 'whatsapp', 'telefone'],
      },
      workspace: { dashboard: true },
      acesso: { tickets: true },
    },
  },
  {
    slug: 'admin-config',
    nome: 'Admin Configuração',
    nivel: 10,
    herdaDe: [],
    portalVisivel: ['agent', 'config', 'gestao', 'workflow', 'especiais'],
    permissoes: {
      tickets: { ver_todos: true, atuar_responsavel: true, assumir_ticket: true },
      workspace: { dashboard: true, painel_360: true },
      workflow: { painel_aprovacao: true, gerenciar_workflows: true },
      config: { tabulacao: true, workflow: true, email: true, funcoes: true },
      acesso: { tickets: true, workspace: true, workflow: true, config: true },
    },
  },
];

async function main() {
  await connectDatabase();
  const Model = getDeskFuncaoPermissaoModel();

  console.log(`[seed-funcoes] iniciando seed de ${DEFAULT_FUNCOES.length} funções padrão...`);

  const existing = await Model.countDocuments();
  if (existing > 0) {
    console.log(`[seed-funcoes] ⚠️  já existem ${existing} funções no banco — pulando seed`);
    return;
  }

  let inserted = 0;
  for (const funcao of DEFAULT_FUNCOES) {
    try {
      await Model.updateOne({ slug: funcao.slug }, { $set: funcao }, { upsert: true });
      inserted++;
      console.log(`  ✓ ${funcao.nome} (${funcao.slug})`);
    } catch (err) {
      console.error(`  ✗ erro em ${funcao.slug}:`, (err as Error).message);
    }
  }

  console.log(`[seed-funcoes] ✓ seed completo: ${inserted}/${DEFAULT_FUNCOES.length} funções criadas`);
}

main()
  .catch((err) => {
    console.error('[seed-funcoes] ERRO FATAL:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
