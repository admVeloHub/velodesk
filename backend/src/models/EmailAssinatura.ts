/** EmailAssinatura v1.0.0 — desk_config.email_assinatura (singleton) */
import { Schema, Document, Model } from 'mongoose';
import { getDeskConfigConnection } from '../config/database';

export const EMAIL_ASSINATURA_CONFIG_KEY = 'desk_email_assinatura';

export interface IEmailAssinaturaImagem {
  objectKey: string;
  gcsPath: string;
  contentType: string;
  filename: string;
}

export interface IEmailAssinatura extends Document {
  configKey: string;
  html: string;
  imagens: IEmailAssinaturaImagem[];
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ImagemSchema = new Schema<IEmailAssinaturaImagem>(
  {
    objectKey: { type: String, required: true, trim: true },
    gcsPath: { type: String, default: '' },
    contentType: { type: String, default: 'image/png' },
    filename: { type: String, default: '' },
  },
  { _id: false },
);

const EmailAssinaturaSchema = new Schema<IEmailAssinatura>(
  {
    configKey: { type: String, required: true, unique: true, default: EMAIL_ASSINATURA_CONFIG_KEY },
    html: { type: String, default: '' },
    imagens: { type: [ImagemSchema], default: [] },
    updatedBy: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'email_assinatura',
  },
);

export function getEmailAssinaturaModel(): Model<IEmailAssinatura> {
  const conn = getDeskConfigConnection();
  if (conn.models.EmailAssinatura) {
    return conn.models.EmailAssinatura as Model<IEmailAssinatura>;
  }
  return conn.model<IEmailAssinatura>('EmailAssinatura', EmailAssinaturaSchema);
}
