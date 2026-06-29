/** test-mongo-connection v1.2.0 — conexão Atlas via backend/.env */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { env, envFile } from '../src/config/env';

function maskUri(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
}

async function main(): Promise<void> {
  console.log('--- Teste MongoDB Atlas ---');
  console.log('.env:', envFile.envPath || '(não encontrado)');
  console.log('MONGODB_DB_NAME:', env.mongoDbName);
  console.log('MONGODB_CADASTROS_DB_NAME:', env.mongoCadastrosDbName);
  console.log('MONGODB_URI:', maskUri(env.mongoUri));

  try {
    await connectDatabase();
    console.log('Conectado — readyState chamados:', mongoose.connection.readyState);
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    console.error('Falha:', (err as Error).message);
    process.exit(1);
  }
}

main();
