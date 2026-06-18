/** database v1.1.0 — conexão MongoDB b2c_chamados (velodesk-dev) */
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from './env';

let memoryServer: MongoMemoryServer | null = null;

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.mongoUri, {
      dbName: env.mongoDbName,
      serverSelectionTimeoutMS: 4000,
    });
    console.log(`MongoDB conectado: ${env.mongoDbName} @ ${env.mongoUri}`);
    return;
  } catch (err) {
    if (env.nodeEnv !== 'development') {
      throw err;
    }

    console.warn('MongoDB Atlas indisponível — instância em memória (dev):', (err as Error).message);
    memoryServer = await MongoMemoryServer.create({ instance: { dbName: env.mongoDbName } });
    await mongoose.connect(memoryServer.getUri(), { dbName: env.mongoDbName });
    console.log(`MongoDB em memória conectado (dev) — db: ${env.mongoDbName}`);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
