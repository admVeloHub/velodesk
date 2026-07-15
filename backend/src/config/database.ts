/** database v1.8.2 — MONGO_ENV runtime (VeloHubCentral / colaboradores) */
import path from 'path';
import mongoose, { Connection } from 'mongoose';
import { env, envFile, getMongoDeskUri, getMongoHubCentralUri } from './env';
import { MONGO_DRIVER_OPTIONS } from './mongoUri';
import { maskMongoUri, resolveAtlasSrvUri } from './resolveAtlasUri';

/**
 * Conexões deste serviço (cluster VeloDesk): b2c_chamados, b2c_cadastros, desk_config.
 * Cadastro colaboradores: cluster VeloHubCentral → console_funcionarios (somente leitura).
 * VeloNews continua via API VeloHub (console_conteudo).
 */
let cadastrosConnection: Connection | null = null;
let deskConfigConnection: Connection | null = null;
let funcionariosConnection: Connection | null = null;

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function isCadastrosConnected(): boolean {
  return cadastrosConnection?.readyState === 1;
}

export function isDeskConfigConnected(): boolean {
  return deskConfigConnection?.readyState === 1;
}

export function isFuncionariosConnected(): boolean {
  return funcionariosConnection?.readyState === 1;
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

export function getFuncionariosConnection(): Connection {
  if (!funcionariosConnection || funcionariosConnection.readyState !== 1) {
    throw new Error('Conexão console_funcionarios (VeloHubCentral) indisponível');
  }
  return funcionariosConnection;
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
  return isMongoConnected() && isCadastrosConnected() && isDeskConfigConnected();
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
  if (cadastrosConnection) {
    await cadastrosConnection.close();
    cadastrosConnection = null;
  }
  await mongoose.disconnect();
}
