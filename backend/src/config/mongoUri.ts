/** mongoUri v2.0.1 — opções do driver; URI de backend/.env */
import type { ConnectOptions } from 'mongoose';

export const MONGO_DRIVER_OPTIONS: ConnectOptions = {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
  family: 4,
};
