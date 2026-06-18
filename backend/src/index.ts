/** index v1.0.2 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase, isMongoConnected } from './config/database';
import authRoutes from './routes/auth.routes';
import ticketsRoutes from './routes/tickets.routes';
import boxesRoutes from './routes/boxes.routes';
import formsRoutes from './routes/forms.routes';
import usersRoutes from './routes/users.routes';
import statsRoutes from './routes/stats.routes';
import uploadsRoutes from './routes/uploads.routes';
import { seedDevelopmentData } from './services/seed.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const whatsapp = require('./whatsapp/whatsappModule.js');

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  '/api/',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 200 })
);

app.get('/api/health', (_req, res) => {
  res.json({
    status: isMongoConnected() ? 'ok' : 'degraded',
    mongo: isMongoConnected(),
    whatsapp: whatsapp.getWhatsAppHealth(),
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: isMongoConnected() ? 'ok' : 'degraded',
    mongo: isMongoConnected(),
    whatsapp: whatsapp.getWhatsAppHealth(),
  });
});

app.use('/api', authRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/boxes', boxesRoutes);
app.use('/api/forms', formsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api', statsRoutes);
app.use('/api/uploads', uploadsRoutes);

if (env.enableWhatsapp) {
  whatsapp.mountWhatsAppRoutes(app);
}

async function start() {
  try {
    await connectDatabase();
    await seedDevelopmentData();
  } catch (err) {
    console.error('Falha ao conectar banco de dados:', (err as Error).message);
  }

  app.listen(env.port, () => {
    console.log(`API Velodesk v1.0.0 — http://localhost:${env.port}`);
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
