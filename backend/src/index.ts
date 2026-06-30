/** index v1.2.0 — escuta PORT antes do Mongo (Cloud Run) + degradado se Atlas indisponível */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase, getAtlasConnectionInfo, getMongoStorageLabel, isCadastrosConnected, isDeskConfigConnected, isMongoConnected } from './config/database';
import authRoutes from './routes/auth.routes';
import ticketsRoutes from './routes/tickets.routes';
import boxesRoutes from './routes/boxes.routes';
import usersRoutes from './routes/users.routes';
import statsRoutes from './routes/stats.routes';
import uploadsRoutes from './routes/uploads.routes';
import clientsRoutes from './routes/clients.routes';
import tabulationRoutes from './routes/tabulation.routes';
import inboundRoutes from './routes/inbound.routes';
import { seedDevelopmentData, purgeLegacyDemoData } from './services/seed.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const whatsapp = require('./whatsapp/whatsappModule.js');

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/inbound', inboundRoutes);

app.use(
  '/api/',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 200 })
);

app.get('/api/health', (_req, res) => {
  res.json({
    status: isMongoConnected() ? 'ok' : 'degraded',
    mongo: isMongoConnected(),
    mongoStorage: getMongoStorageLabel(),
    atlas: getAtlasConnectionInfo(),
    mongoDbName: env.mongoDbName,
    cadastrosDbName: env.mongoCadastrosDbName,
    cadastrosConnected: isCadastrosConnected(),
    deskConfigDbName: env.mongoDeskConfigDbName,
    deskConfigConnected: isDeskConfigConnected(),
    whatsapp: whatsapp.getWhatsAppHealth(),
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: isMongoConnected() ? 'ok' : 'degraded',
    mongo: isMongoConnected(),
    mongoStorage: getMongoStorageLabel(),
    atlas: getAtlasConnectionInfo(),
    mongoDbName: env.mongoDbName,
    cadastrosDbName: env.mongoCadastrosDbName,
    cadastrosConnected: isCadastrosConnected(),
    deskConfigDbName: env.mongoDeskConfigDbName,
    deskConfigConnected: isDeskConfigConnected(),
    whatsapp: whatsapp.getWhatsAppHealth(),
  });
});

app.use('/api', authRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/boxes', boxesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api', statsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/tabulation', tabulationRoutes);

if (env.enableWhatsapp) {
  whatsapp.mountWhatsAppRoutes(app);
}

async function bootstrapDatabase() {
  if (!env.mongoUri) {
    console.error('[startup] MONGODB_URI ausente — configure no Cloud Run. /health retorna degraded.');
    return;
  }

  try {
    await connectDatabase();
    await purgeLegacyDemoData();
    await seedDevelopmentData();
  } catch (err) {
    const msg = (err as Error).message;
    console.error('Falha ao conectar ao Atlas:', msg);
    if (/whitelist|IP address/i.test(msg)) {
      console.error('Atlas → Network Access → libere 0.0.0.0/0 ou use VPC connector para Cloud Run.');
    } else if (/querySrv|ECONNREFUSED.*mongodb/i.test(msg)) {
      console.error('Falha de DNS SRV. Verifique MONGODB_URI (mongodb+srv) no Cloud Run.');
    }
    if (env.nodeEnv !== 'production') {
      process.exit(1);
    }
    console.error('[startup] Producao: API continua em modo degradado até MongoDB responder.');
  }
}

async function start() {
  app.listen(env.port, '0.0.0.0', () => {
    console.log(`API Velodesk v1.2.0 — http://0.0.0.0:${env.port} (${env.nodeEnv})`);
    void bootstrapDatabase().then(() => {
      if (env.enableWhatsapp) {
        console.log('Inicializando WhatsApp Web...');
        whatsapp.initializeWhatsApp();
      }
    });
  });
}

process.on('SIGINT', async () => {
  await whatsapp.destroyWhatsApp();
  await disconnectDatabase();
  process.exit(0);
});

start();

