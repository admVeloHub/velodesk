/** DeskAgentQueueBox v1.1.0 — desk_preferences.desk_agent_boxex (caixas pessoais do agente) */
import { Schema, Document, Model } from 'mongoose';
import { getDeskPreferencesConnection } from '../config/database';

export interface IDeskAgentQueueBox extends Document {
  boxId: string;
  email: string;
  userId: string;
  name: string;
  action: string;
  actionLabel: string;
  dot: string;
  order: number;
  isCustom: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DeskAgentQueueBoxSchema = new Schema<IDeskAgentQueueBox>(
  {
    boxId: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    userId: { type: String, default: '' },
    name: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
    actionLabel: { type: String, default: '' },
    dot: { type: String, default: '#6366f1' },
    order: { type: Number, default: 0 },
    isCustom: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'desk_agent_boxex',
  },
);

DeskAgentQueueBoxSchema.index({ email: 1, order: 1 });
DeskAgentQueueBoxSchema.index({ email: 1, boxId: 1 }, { unique: true });

export function getDeskAgentQueueBoxModel(): Model<IDeskAgentQueueBox> {
  const conn = getDeskPreferencesConnection();
  if (conn.models.DeskAgentQueueBox) {
    return conn.models.DeskAgentQueueBox as Model<IDeskAgentQueueBox>;
  }
  return conn.model<IDeskAgentQueueBox>('DeskAgentQueueBox', DeskAgentQueueBoxSchema);
}
