/** AgentPresence v1.0.0 — desk_config.desk_agent_presence */
import { Schema, Document, Model } from 'mongoose';
import { getDeskConfigConnection } from '../config/database';

export interface IAgentPresence extends Document {
  userId: string;
  email: string;
  responsavelKey: string;
  online: boolean;
  lastSeenAt: Date;
  lastOfflineAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AgentPresenceSchema = new Schema<IAgentPresence>(
  {
    userId: { type: String, required: true },
    email: { type: String, required: true },
    responsavelKey: { type: String, default: '' },
    online: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: null },
    lastOfflineAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'desk_agent_presence',
  },
);

AgentPresenceSchema.index({ userId: 1 }, { unique: true });
AgentPresenceSchema.index({ email: 1 });
AgentPresenceSchema.index({ online: 1, lastSeenAt: -1 });

export function getAgentPresenceModel(): Model<IAgentPresence> {
  const conn = getDeskConfigConnection();
  if (conn.models.AgentPresence) {
    return conn.models.AgentPresence as Model<IAgentPresence>;
  }
  return conn.model<IAgentPresence>('AgentPresence', AgentPresenceSchema);
}
