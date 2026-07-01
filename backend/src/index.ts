/** index v1.5.0 — proxy LanguageTool spellcheck */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase, getAtlasConnectionInfo, getMongoStorageLabel, isAllMongoReady, isCadastrosConnected, isDeskConfigConnected, isMongoConnected } from './config/database';
import authRoutes from './routes/auth.routes';
import ticketsRoutes from './routes/tickets.routes';
import boxesRoutes from './routes/boxes.routes';
import usersRoutes from './routes/users.routes';
import statsRoutes from './routes/stats.routes';
import uploadsRoutes from './routes/uploads.routes';
import clientsRoutes from './routes/clients.routes';
import tabulationRoutes from './routes/tabulation.routes';
import spellcheckRoutes from './routes/spellcheck.routes';
import inboundRoutes from './routes/inbound.routes';
import { isLanguageToolConfigured, logLanguageToolStartupStatus } from './services/languagetool.service';
import { seedDevelopmentData, purgeLegacyDemoData } from './services/seed.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const whatsapp = require('./whatsapp/whatsappModule.js');

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/inbound', inboundRoutes);
app.use('/api/spellcheck', spellcheckRoutes);

app.use(
  '/api/',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 200 })
);

app.get('/api/health', (_req, res) => {
  const allReady = isAllMongoReady();
  res.json({
    status: allReady ? 'ok' : 'degraded',
    mongo: isMongoConnected(),
    mongoUriConfigured: Boolean(env.mongoUri?.trim()),
    googleClientIdConfigured: Boolean(env.googleClientId),
    mongoStorage: getMongoStorageLabel(),
    atlas: getAtlasConnectionInfo(),
    mongoDbName: env.mongoDbName,
    cadastrosDbName: env.mongoCadastrosDbName,
    cadastrosConnected: isCadastrosConnected(),
    deskConfigDbName: env.mongoDeskConfigDbName,
    deskConfigConnected: isDeskConfigConnected(),
    whatsapp: whatsapp.getWhatsAppHealth(),
    languageTool: {
      configured: isLanguageToolConfigured(),
      url: isLanguageToolConfigured() ? env.languageToolUrl : null,
    },
  });
});

app.get('/health', (_req, res) => {
  const allReady = isAllMongoReady();
  res.json({
    status: allReady ? 'ok' : 'degraded',
    mongo: isMongoConnected(),
    mongoUriConfigured: Boolean(env.mongoUri?.trim()),
    googleClientIdConfigured: Boolean(env.googleClientId),
    mongoStorage: getMongoStorageLabel(),
    atlas: getAtlasConnectionInfo(),
    mongoDbName: env.mongoDbName,
    cadastrosDbName: env.mongoCadastrosDbName,
    cadastrosConnected: isCadastrosConnected(),
    deskConfigDbName: env.mongoDeskConfigDbName,
    deskConfigConnected: isDeskConfigConnected(),
    whatsapp: whatsapp.getWhatsAppHealth(),
    languageTool: {
      configured: isLanguageToolConfigured(),
    },
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

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[express] erro não tratado:', err);
  if (!res.headersSent) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

let mongoRetryTimer: ReturnType<typeof setInterval> | null = null;

async function tryConnectDatabase(): Promise<boolean> {
  if (isAllMongoReady()) return true;

  try {
    await connectDatabase();
    await purgeLegacyDemoData();
    await seedDevelopmentData();
    console.log('[startup] MongoDB conectado (chamados + cadastros + desk_config).');
    return true;
  } catch (err) {
    const msg = (err as Error).message;
    console.error('Falha ao conectar ao Atlas:', msg);
    if (/whitelist|IP address/i.test(msg)) {
      console.error('Atlas → Network Access → libere 0.0.0.0/0 ou use VPC connector para Cloud Run.');
    } else if (/querySrv|ECONNREFUSED.*mongodb/i.test(msg)) {
      console.error('Falha de DNS SRV. Verifique MONGODB_URI (mongodb+srv) no Cloud Run.');
    }
    return false;
  }
}

function scheduleMongoRetry() {
  if (mongoRetryTimer) return;
  console.log('[startup] Monitoramento MongoDB a cada 15s (reconecta se cair).');
  mongoRetryTimer = setInterval(() => {
    if (!env.mongoUri?.trim() || isAllMongoReady()) return;
    void tryConnectDatabase();
  }, 15000);
}

async function bootstrapDatabase() {
  if (!env.mongoUri) {
    console.error('[startup] MONGODB_URI ausente — configure no Cloud Run (Variables & Secrets).');
    return;
  }

  const connected = await tryConnectDatabase();
  if (env.nodeEnv === 'production') {
    scheduleMongoRetry();
  } else if (!connected) {
    process.exit(1);
  }
}

async function start() {
  app.listen(env.port, '0.0.0.0', () => {
    console.log(`API Velodesk v1.2.0 — http://0.0.0.0:${env.port} (${env.nodeEnv})`);
    void bootstrapDatabase().then(async () => {
      await logLanguageToolStartupStatus();
      if (env.enableWhatsapp) {
        console.log('Inicializando WhatsApp Web...');
        whatsapp.initializeWhatsApp();
      }
    });
  });
}

process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException (processo continua):', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandledRejection (processo continua):', reason);
});

process.on('SIGINT', async () => {
  await whatsapp.destroyWhatsApp();
  await disconnectDatabase();
  process.exit(0);
});

start();

