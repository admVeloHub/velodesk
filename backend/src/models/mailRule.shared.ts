/** mailRule.shared v1.0.0 — schema comum mail_ignorado / mail_spam / mail_priority */
import { Schema, Document, Model } from 'mongoose';
import { getDeskConfigConnection } from '../config/database';

export type MailRuleType = 'email' | 'domain';

export interface IMailRule extends Document {
  type: MailRuleType;
  value: string;
  note?: string;
  active: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const MailRuleSchema = new Schema<IMailRule>(
  {
    type: { type: String, enum: ['email', 'domain'], required: true },
    value: { type: String, required: true, trim: true, lowercase: true },
    note: { type: String, default: '', trim: true },
    active: { type: Boolean, default: true },
    createdBy: { type: String, default: '' },
    updatedBy: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

MailRuleSchema.index({ type: 1, value: 1 }, { unique: true });
MailRuleSchema.index({ active: 1 });

export function getMailRuleModel(
  modelName: string,
  collection: string,
): Model<IMailRule> {
  const conn = getDeskConfigConnection();
  if (conn.models[modelName]) {
    return conn.models[modelName] as Model<IMailRule>;
  }
  return conn.model<IMailRule>(modelName, MailRuleSchema, collection);
}
