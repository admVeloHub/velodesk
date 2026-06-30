/** index v1.1.1 — inbound e-mail + falha se MongoDB Atlas indisponível */
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

async function start() {
  try {
    await connectDatabase();
    await purgeLegacyDemoData();
    await seedDevelopmentData();
  } catch (err) {
    const msg = (err as Error).message;
    console.error('Falha ao conectar ao Atlas â€” backend nÃ£o iniciarÃ¡:', msg);
    if (/whitelist|IP address/i.test(msg)) {
      console.error('');
      console.error('Atlas â†’ Network Access â†’ adicione o IP pÃºblico desta mÃ¡quina.');
      console.error('Enquanto o backend nÃ£o subir, o frontend exibe ECONNREFUSED em /api/* (porta 8001).');
    } else if (/querySrv|ECONNREFUSED.*mongodb/i.test(msg)) {
      console.error('');
      console.error('Falha de DNS SRV local. Reinicie o backend (resolveAtlasUri deve converter a URI).');
    }
    process.exit(1);
  }

  app.listen(env.port, () => {
    console.log(`API Velodesk v1.0.0 â€” http://localhost:${env.port}`);
    if (env.enableWhatsapp) {
      console.log('Inicializando WhatsApp Web...');
      whatsapp.initializeWhatsApp();
    }
  });
}

process.on('SIGINT', async () => {
  await whatsapp.destroyWhatsApp();
  await disconnectDatabase();
  process.exit(0);
});

start();

