/** TelephonyCall v1.1.0 — registro de ligação Contact Tel / parceira IA telefônica */
import mongoose, { Document, Schema, Types } from 'mongoose';

export type TelephonyTicketStatus = 'none' | 'pending' | 'created';

export interface TelephonyTranscriptTurnDoc {
  role: string;
  message: string;
  originalMessage?: string | null;
  timeInCallSecs?: number;
}

export interface TelephonyTransferDoc {
  destinationType?: string;
  destinationValue?: string;
  targetUserName?: string;
  targetUserExtension?: string;
  waitMs?: number;
  answeredByName?: string;
  answeredAt?: Date;
}

export interface ITelephonyCall extends Document {
  externalCallId: string;
  provider: string;
  canonicalUrl?: string;
  direction?: string;
  origin?: string;
  callType?: string;
  status?: string;
  initiatedAt?: Date;
  answeredAt?: Date;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  ringDuration?: number;
  clientPhone: string;
  clientCpf: string;
  clientName: string;
  isConverted?: boolean;
  isOptout?: boolean;
  isMismatch?: boolean;
  terminationOrigin?: string;
  agentId?: string;
  agentName?: string;
  campaignId?: string;
  campaignName?: string;
  variables?: Record<string, unknown>;
  dataCollected?: Record<string, unknown>;
  transcript: string;
  summary: string;
  transcriptFull?: TelephonyTranscriptTurnDoc[];
  transfer?: TelephonyTransferDoc;
  outcome?: string;
  intent?: string;
  sentiment?: string;
  rawPayload: Record<string, unknown>;
  chamadoId?: Types.ObjectId | null;
  ticketStatus: TelephonyTicketStatus;
  clienteId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const TranscriptTurnSchema = new Schema<TelephonyTranscriptTurnDoc>(
  {
    role: { type: String, required: true },
    message: { type: String, default: '' },
    originalMessage: { type: String, default: null },
    timeInCallSecs: { type: Number },
  },
  { _id: false },
);

const TransferSchema = new Schema<TelephonyTransferDoc>(
  {
    destinationType: { type: String },
    destinationValue: { type: String },
    targetUserName: { type: String },
    targetUserExtension: { type: String },
    waitMs: { type: Number },
    answeredByName: { type: String },
    answeredAt: { type: Date },
  },
  { _id: false },
);

const TelephonyCallSchema = new Schema<ITelephonyCall>(
  {
    externalCallId: { type: String, required: true, unique: true, index: true },
    provider: { type: String, default: 'contact-tel', index: true },
    canonicalUrl: { type: String },
    direction: { type: String, index: true },
    origin: { type: String },
    callType: { type: String, index: true },
    status: { type: String, index: true },
    initiatedAt: { type: Date },
    answeredAt: { type: Date },
    startedAt: { type: Date },
    endedAt: { type: Date, index: true },
    durationSeconds: { type: Number },
    ringDuration: { type: Number },
    clientPhone: { type: String, default: '', index: true },
    clientCpf: { type: String, default: '', index: true },
    clientName: { type: String, default: '' },
    isConverted: { type: Boolean },
    isOptout: { type: Boolean },
    isMismatch: { type: Boolean },
    terminationOrigin: { type: String },
    agentId: { type: String },
    agentName: { type: String, index: true },
    campaignId: { type: String },
    campaignName: { type: String },
    variables: { type: Schema.Types.Mixed },
    dataCollected: { type: Schema.Types.Mixed },
    transcript: { type: String, default: '' },
    summary: { type: String, default: '' },
    transcriptFull: { type: [TranscriptTurnSchema], default: undefined },
    transfer: { type: TransferSchema },
    outcome: { type: String },
    intent: { type: String },
    sentiment: { type: String },
    rawPayload: { type: Schema.Types.Mixed, default: {} },
    chamadoId: { type: Schema.Types.ObjectId, ref: 'ChamadoN1', default: null },
    ticketStatus: {
      type: String,
      enum: ['none', 'pending', 'created'],
      default: 'none',
    },
    clienteId: { type: Schema.Types.ObjectId, ref: 'Cliente', default: null },
  },
  { timestamps: true, collection: 'telephony_calls' },
);

TelephonyCallSchema.index({ endedAt: -1 });
TelephonyCallSchema.index({ summary: 'text', transcript: 'text', clientName: 'text' });

export const TelephonyCall = mongoose.model<ITelephonyCall>('TelephonyCall', TelephonyCallSchema);
