/** database v1.7.0 — reconexão cadastros/desk_config + não derruba processo */
import path from 'path';
import mongoose, { Connection } from 'mongoose';
import { env, envFile } from './env';
import { MONGO_DRIVER_OPTIONS } from './mongoUri';
import { maskMongoUri, resolveAtlasSrvUri } from './resolveAtlasUri';

let cadastrosConnection: Connection | null = null;
let deskConfigConnection: Connection | null = null;

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function isCadastrosConnected(): boolean {
  return cadastrosConnection?.readyState === 1;
}

export function isDeskConfigConnected(): boolean {
  return deskConfigConnection?.readyState === 1;
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
}

export async function disconnectDatabase(): Promise<void> {
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
