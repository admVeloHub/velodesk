/** index v1.9.6 — rate limit 5000 + isenção GET leitura frequente */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env, getMongoHubCentralUri } from './config/env';
import {
  connectDatabase,
  disconnectDatabase,
  getAtlasConnectionInfo,
  getMongoStorageLabel,
  isAllMongoReady,
  isCadastrosConnected,
  isDeskConfigConnected,
  isFuncionariosConnected,
  isMongoConnected,
  tryConnectFuncionarios,
} from './config/database';
import authRoutes from './routes/auth.routes';
import ticketsRoutes from './routes/tickets.routes';
import boxesRoutes from './routes/boxes.routes';
import usersRoutes from './routes/users.routes';
import statsRoutes from './routes/stats.routes';
import uploadsRoutes from './routes/uploads.routes';
import clientsRoutes from './routes/clients.routes';
import tabulationRoutes from './routes/tabulation.routes';
import workflowsRoutes from './routes/workflows.routes';
import spellcheckRoutes from './routes/spellcheck.routes';
import composeRoutes from './routes/compose.routes';
import ticketAiRoutes from './routes/ticketAi.routes';
import agentsRoutes from './routes/agents.routes';
import inboundRoutes from './routes/inbound.routes';
import workspace360Routes from './routes/workspace360.routes';
import colaboradoresRoutes from './routes/colaboradores.routes';
import workflowNotificacoesRoutes from './routes/workflowNotificacoes.routes';
import { blockNoticiarioRoutes } from './middleware/blockNoticiarioRoutes';
import { shouldSkipApiRateLimit } from './middleware/rateLimitPolicy';
import { isLanguageToolConfigured, logLanguageToolStartupStatus } from './services/languagetool.service';
import {
  getOpenAiTicketSuggestStatus,
  isOpenAiTicketSuggestConfigured,
} from './services/openaiTicketSuggest.service';
import { seedDevelopmentData, purgeAllMockTickets } from './services/seed.service';
import { getAgentsStatus } from './services/agents/openaiAgent.util';
import { startGestaoChamadosJob } from './jobs/gestaoChamados.job';
import { bootstrapEmailServices } from './services/emailBootstrap.service';
import { startChamadoProtocoloWatcher } from './services/chamadoProtocoloWatcher.service';

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
app.use(blockNoticiarioRoutes);

app.use('/api/inbound', inboundRoutes);
app.use('/api/spellcheck', spellcheckRoutes);
app.use('/api/compose', composeRoutes);
app.use('/api/ticket-ai', ticketAiRoutes);
app.use('/api/agents', agentsRoutes);

app.use('/api', authRoutes);

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.apiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipApiRateLimit,
});

app.use('/api/', apiRateLimiter);

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
    funcionariosDbName: env.mongoFuncionariosDbName,
    mongoEnvConfigured: Boolean(getMongoHubCentralUri()),
    funcionariosConnected: isFuncionariosConnected(),
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
    funcionariosDbName: env.mongoFuncionariosDbName,
    mongoEnvConfigured: Boolean(getMongoHubCentralUri()),
    funcionariosConnected: isFuncionariosConnected(),
    whatsapp: whatsapp.getWhatsAppHealth(),
    languageTool: {
      configured: isLanguageToolConfigured(),
    },
  });
});

app.use('/api/tickets', ticketsRoutes);
app.use('/api/boxes', boxesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/colaboradores', colaboradoresRoutes);
app.use('/api', statsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/tabulation', tabulationRoutes);
app.use('/api/workflows', workflowsRoutes);
app.use('/api/workflow-notificacoes', workflowNotificacoesRoutes);
app.use('/api/workspace360', workspace360Routes);

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
let devMemoryServer: { getUri: (dbName?: string) => string } | null = null;
let activeMongoUri = env.mongoUri;

async function tryConnectDatabase(uri?: string): Promise<boolean> {
  if (isAllMongoReady()) return true;

  const targetUri = (uri || activeMongoUri || '').trim();
  if (!targetUri) return false;

  try {
    await connectDatabase(targetUri);
    activeMongoUri = targetUri;
    await purgeAllMockTickets();
    await seedDevelopmentData();
    await startChamadoProtocoloWatcher();
    console.log('[startup] MongoDB conectado (chamados + cadastros + desk_config).');
    return true;
  } catch (err) {
    const msg = (err as Error).message;
    console.error('Falha ao conectar ao MongoDB:', msg);
    if (/whitelist|IP address/i.test(msg)) {
      console.error('Atlas → Network Access → libere 0.0.0.0/0 ou use VPC connector para Cloud Run.');
    } else if (/querySrv|ECONNREFUSED|ECONNREFUSED.*mongodb/i.test(msg)) {
      console.error('MongoDB indisponível. Em dev local, o backend tentará memória embarcada ou reconectar.');
    }
    return false;
  }
}

async function tryDevMemoryMongo(): Promise<string | null> {
  if (env.nodeEnv === 'production') return null;

  try {
    if (!devMemoryServer) {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      devMemoryServer = await MongoMemoryServer.create();
    }
    const uri = devMemoryServer.getUri('velodesk');
    console.log('[startup] MongoDB em memória (dev) — dados não persistem entre reinícios.');
    return uri;
  } catch (err) {
    console.error('[startup] Falha ao iniciar MongoDB em memória:', err);
    return null;
  }
}

function scheduleMongoRetry() {
  if (mongoRetryTimer) return;
  console.log('[startup] Monitoramento MongoDB a cada 15s (reconecta se cair).');
  mongoRetryTimer = setInterval(() => {
    if (!activeMongoUri?.trim()) return;
    if (!isAllMongoReady()) {
      void tryConnectDatabase(activeMongoUri).then((ok) => {
        if (ok) void bootstrapEmailServices();
      });
      return;
    }
    if (!isFuncionariosConnected() && getMongoHubCentralUri()) {
      void tryConnectFuncionarios();
    }
  }, 15000);
}

async function bootstrapDatabase() {
  if (!env.mongoUri) {
    console.error('[startup] MONGODB_URI ausente — configure no Cloud Run (Variables & Secrets).');
    return;
  }

  let connected = await tryConnectDatabase(env.mongoUri);
  if (!connected && env.nodeEnv !== 'production') {
    const memoryUri = await tryDevMemoryMongo();
    if (memoryUri) {
      connected = await tryConnectDatabase(memoryUri);
    }
  }

  if (!connected) {
    scheduleMongoRetry();
    if (env.nodeEnv !== 'production') {
      console.warn('[startup] API ativa sem MongoDB — aguardando reconexão ou login dev após subir o banco.');
    }
  }
}

async function start() {
  const hubUri = getMongoHubCentralUri();
  console.log(
    `[env] Desk cluster (MONGO_URI/MONGODB_URI): ${env.mongoUri ? 'configurado' : 'AUSENTE'}`,
  );
  console.log(
    `[env] VeloHubCentral colaboradores (MONGO_ENV): ${hubUri ? 'configurado' : 'AUSENTE — /api/colaboradores retorna 503'}`,
  );

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`API Velodesk v1.2.0 — http://0.0.0.0:${env.port} (${env.nodeEnv})`);
    void bootstrapDatabase().then(async () => {
      await bootstrapEmailServices();
      await logLanguageToolStartupStatus();
      if (isOpenAiTicketSuggestConfigured()) {
        console.log('[ticket-ai] OpenAI configurado (sugestão resposta + tabulação).');
      } else {
        const aiStatus = getOpenAiTicketSuggestStatus();
        console.warn(
          '[ticket-ai] OpenAI NÃO configurado — sugestão IA retornará 503. Faltam:',
          aiStatus.missing.join(', ') || '(desconhecido)',
        );
      }
      if (env.agentsEnabled) {
        const agentsStatus = getAgentsStatus();
        console.log('[agents] Programa de agentes paralelos ativo.', {
          configured: agentsStatus.configured,
          autonomy: env.agentsAutonomyEnabled,
        });
        startGestaoChamadosJob();
      }
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
