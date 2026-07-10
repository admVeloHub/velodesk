/** EmailTransportConfig v1.0.1 — desk_config.email_transport (Gmail API + delegation) */
import { Schema, Document, Model } from 'mongoose';
import { env } from '../config/env';
import { getDeskConfigConnection } from '../config/database';

export interface IServiceAccountJson {
  client_email?: string;
  private_key?: string;
  [key: string]: unknown;
}

export interface IEmailTransportConfig extends Document {
  configKey: string;
  transportMode: 'gmail_api' | 'smtp';
  defaultFromEmail: string;
  delegatedUserEmail: string;
  serviceAccountJson: IServiceAccountJson | null;
  createdAt: Date;
  updatedAt: Date;
}

const EmailTransportSchema = new Schema<IEmailTransportConfig>(
  {
    configKey: { type: String, required: true, unique: true, default: () => env.deskEmailTransportDocumentId },
    transportMode: { type: String, enum: ['gmail_api', 'smtp'], default: 'gmail_api' },
    defaultFromEmail: { type: String, default: '', trim: true, lowercase: true },
    delegatedUserEmail: { type: String, default: '', trim: true, lowercase: true },
    serviceAccountJson: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: env.deskEmailTransportCollection,
  }
);

export function getEmailTransportModel(): Model<IEmailTransportConfig> {
  const conn = getDeskConfigConnection();
  if (conn.models.EmailTransportConfig) {
    return conn.models.EmailTransportConfig as Model<IEmailTransportConfig>;
  }
  return conn.model<IEmailTransportConfig>('EmailTransportConfig', EmailTransportSchema);
}

export async function findEmailTransportSingleton() {
  const Model = getEmailTransportModel();
  return Model.findOne({ configKey: env.deskEmailTransportDocumentId }).lean().exec();
}
