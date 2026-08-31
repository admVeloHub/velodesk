/** database v1.9.0 — conexão chamados_reclamacoes (collections por órgão) */
import path from 'path';
import mongoose, { Connection } from 'mongoose';
import { env, envFile, getMongoDeskUri, getMongoHubCentralUri } from './env';
import { MONGO_DRIVER_OPTIONS } from './mongoUri';
import { maskMongoUri, resolveAtlasSrvUri } from './resolveAtlasUri';

/**
 * Conexões deste serviço (cluster VeloDesk): b2c_chamados, b2c_cadastros, desk_config, desk_preferences, chamados_reclamacoes.
 * Cadastro colaboradores: cluster VeloHubCentral → console_funcionarios (somente leitura).
 * VeloNews continua via API VeloHub (console_conteudo).
 */
let cadastrosConnection: Connection | null = null;
let deskConfigConnection: Connection | null = null;
let deskPreferencesConnection: Connection | null = null;
let funcionariosConnection: Connection | null = null;
let reclamacoesConnection: Connection | null = null;

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function isCadastrosConnected(): boolean {
  return cadastrosConnection?.readyState === 1;
}

export function isDeskConfigConnected(): boolean {
  return deskConfigConnection?.readyState === 1;
}

export function isDeskPreferencesConnected(): boolean {
  return deskPreferencesConnection?.readyState === 1;
}

export function isFuncionariosConnected(): boolean {
  return funcionariosConnection?.readyState === 1;
}

export function isReclamacoesConnected(): boolean {
  return reclamacoesConnection?.readyState === 1;
}

export function getCadastrosConnection(): Connection {
  if (!cadastrosConnection || cadastrosConnection.readyState !== 1) {
    throw new Error('Conexão b2c_cadastros indisponível');
  }
  return cadastrosConnection;
}

export function getDeskConfigConnection(): Connection {
  if (!deskConfigConnection || deskConfigConnection.readyState !== 1) {
    throw new Error('Conexão desk_config indisponível');
  }
  return deskConfigConnection;
}

export function getDeskPreferencesConnection(): Connection {
  if (!deskPreferencesConnection || deskPreferencesConnection.readyState !== 1) {
    throw new Error('Conexão desk_preferences indisponível');
  }
  return deskPreferencesConnection;
}

export function getFuncionariosConnection(): Connection {
  if (!funcionariosConnection || funcionariosConnection.readyState !== 1) {
    throw new Error('Conexão console_funcionarios (VeloHubCentral) indisponível');
  }
  return funcionariosConnection;
}

export function getReclamacoesConnection(): Connection {
  if (!reclamacoesConnection || reclamacoesConnection.readyState !== 1) {
    throw new Error('Conexão chamados_reclamacoes indisponível');
  }
  return reclamacoesConnection;
}

export function getMongoStorageLabel(): 'atlas' {
  return 'atlas';
}

export function getAtlasConnectionInfo() {
  const conn = mongoose.connection;
  return {
    storage: 'atlas' as const,
    host: conn.host || null,
    port: conn.port || null,
    dbName: conn.name || env.mongoDbName,
  };
}

function maskUri(uri: string): string {
  return maskMongoUri(uri);
}

export function isAllMongoReady(): boolean {
  return isMongoConnected()
    && isCadastrosConnected()
    && isDeskConfigConnected()
    && isDeskPreferencesConnected()
    && isReclamacoesConnected();
}

/**
 * Aguarda as conexões Mongo ficarem prontas, com timeout curto — cobre a janela entre
 * app.listen() (imediato) e connectDatabase() terminar no boot de uma instância nova
 * (ou um reconnect após soneca/blip de rede), quando requests reais já chegam mas as
 * rotas que dependem de desk_config/cadastros/reclamacoes ainda falhariam na hora com
 * "Conexão X indisponível". Sem custo depois de pronto (isAllMongoReady() é síncrono).
 */
export async function waitForMongoReady(timeoutMs = 12000): Promise<boolean> {
  if (isAllMongoReady()) return true;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (isAllMongoReady()) return true;
  }
  return isAllMongoReady();
}

async function resetConnection(conn: Connection | null): Promise<void> {
  if (!conn) return;
  try {
    await conn.close();
  } catch {
    /* ignore */
  }
}

async function connectCadastros(uri: string): Promise<void> {
  if (cadastrosConnection?.readyState === 1) return;

  if (cadastrosConnection) {
    await resetConnection(cadastrosConnection);
    cadastrosConnection = null;
  }

  cadastrosConnection = mongoose.createConnection(uri, {
    dbName: env.mongoCadastrosDbName,
    ...MONGO_DRIVER_OPTIONS,
  });
  await cadastrosConnection.asPromise();
  console.log(`Atlas cadastros conectado: ${env.mongoCadastrosDbName}`);
}

async function connectDeskConfig(uri: string): Promise<void> {
  if (deskConfigConnection?.readyState === 1) return;

  if (deskConfigConnection) {
    await resetConnection(deskConfigConnection);
    deskConfigConnection = null;
  }

  deskConfigConnection = mongoose.createConnection(uri, {
    dbName: env.mongoDeskConfigDbName,
    ...MONGO_DRIVER_OPTIONS,
  });
  await deskConfigConnection.asPromise();
  console.log(`Atlas desk_config conectado: ${env.mongoDeskConfigDbName}`);
}

async function connectDeskPreferences(uri: string): Promise<void> {
  if (deskPreferencesConnection?.readyState === 1) return;

  if (deskPreferencesConnection) {
    await resetConnection(deskPreferencesConnection);
    deskPreferencesConnection = null;
  }

  deskPreferencesConnection = mongoose.createConnection(uri, {
    dbName: env.mongoDeskPreferencesDbName,
    ...MONGO_DRIVER_OPTIONS,
  });
  await deskPreferencesConnection.asPromise();
  console.log(`Atlas desk_preferences conectado: ${env.mongoDeskPreferencesDbName}`);
}

async function connectReclamacoes(uri: string): Promise<void> {
  if (reclamacoesConnection?.readyState === 1) return;

  if (reclamacoesConnection) {
    await resetConnection(reclamacoesConnection);
    reclamacoesConnection = null;
  }

  reclamacoesConnection = mongoose.createConnection(uri, {
    dbName: env.mongoReclamacoesDbName,
    ...MONGO_DRIVER_OPTIONS,
  });
  await reclamacoesConnection.asPromise();
  console.log(`Atlas reclamacoes conectado: ${env.mongoReclamacoesDbName}`);
}

async function connectFuncionarios(): Promise<void> {
  if (funcionariosConnection?.readyState === 1) return;

  const rawUri = getMongoHubCentralUri();
  if (!rawUri) {
    console.warn(
      '[mongo] MONGO_ENV ausente — lista de colaboradores Desk indisponível (VeloHubCentral / console_funcionarios).',
    );
    return;
  }

  const deskUri = getMongoDeskUri();
  if (deskUri && rawUri === deskUri) {
    console.error(
      '[mongo] MONGO_ENV igual a MONGO_URI/MONGODB_URI — use clusters distintos (VeloHubCentral vs desk_dev).',
    );
    return;
  }

  if (funcionariosConnection) {
    await resetConnection(funcionariosConnection);
    funcionariosConnection = null;
  }

  const { uri: atlasUri, method } = await resolveAtlasSrvUri(rawUri);
  funcionariosConnection = mongoose.createConnection(atlasUri, {
    dbName: env.mongoFuncionariosDbName,
    ...MONGO_DRIVER_OPTIONS,
  });
  await funcionariosConnection.asPromise();
  console.log(
    `Atlas funcionarios conectado: ${env.mongoFuncionariosDbName} @ ${maskUri(atlasUri)} (${method}) [MONGO_ENV]`,
  );
}

export async function tryConnectFuncionarios(): Promise<boolean> {
  try {
    await connectFuncionarios();
    if (isFuncionariosConnected()) {
      const { warmResponsavelDisplayCache } = await import('../services/colaboradoresCadastro.service');
      void warmResponsavelDisplayCache(true).catch((err) => {
        console.warn('[responsavel] Falha ao aquecer índice de nomes:', (err as Error).message);
      });
    }
    return isFuncionariosConnected();
  } catch (err) {
    console.error(
      '[mongo] Falha ao conectar console_funcionarios (VeloHubCentral / MONGO_ENV):',
      (err as Error).message,
    );
    return false;
  }
}

export async function connectDatabase(uriOverride?: string): Promise<void> {
  const mongoUri = (uriOverride || env.mongoUri || '').trim();
  if (!mongoUri) {
    throw new Error('MONGODB_URI ausente');
  }

  const envPath = envFile.envPath || path.join(process.cwd(), '.env');
  const envSource = (envFile as { source?: string }).source || 'unknown';
  console.log(`[env] backend env: ${envPath} (${envSource})`);

  const { uri: atlasUri, method } = await resolveAtlasSrvUri(mongoUri);
  const options = { dbName: env.mongoDbName, ...MONGO_DRIVER_OPTIONS };

  if (!isMongoConnected()) {
    await mongoose.connect(atlasUri, options);
    console.log(`Atlas conectado: ${env.mongoDbName} @ ${maskUri(atlasUri)} (${method})`);
  }

  await connectCadastros(atlasUri);
  await connectDeskConfig(atlasUri);
  await connectDeskPreferences(atlasUri);
  await connectReclamacoes(atlasUri);
  await tryConnectFuncionarios();
}

export async function disconnectDatabase(): Promise<void> {
  if (funcionariosConnection) {
    await funcionariosConnection.close();
    funcionariosConnection = null;
  }
  if (deskConfigConnection) {
    await deskConfigConnection.close();
    deskConfigConnection = null;
  }
  if (deskPreferencesConnection) {
    await deskPreferencesConnection.close();
    deskPreferencesConnection = null;
  }
  if (cadastrosConnection) {
    await cadastrosConnection.close();
    cadastrosConnection = null;
  }
  if (reclamacoesConnection) {
    await reclamacoesConnection.close();
    reclamacoesConnection = null;
  }
  await mongoose.disconnect();
}
