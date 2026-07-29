/** Contrato canônico interno para ligações recebidas da parceira de telefonia IA */

export interface TelephonyTranscriptTurn {
  role: string;
  message: string;
  originalMessage?: string | null;
  timeInCallSecs?: number;
}

export interface TelephonyTransferInfo {
  destinationType?: string;
  destinationValue?: string;
  targetUserName?: string;
  targetUserExtension?: string;
  waitMs?: number;
  answeredByName?: string;
  answeredAt?: Date;
}

export interface TelephonyCallInput {
  externalCallId: string;
  provider?: string;
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
  clientPhone?: string;
  clientCpf?: string;
  clientName?: string;
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
  transcript?: string;
  summary?: string;
  transcriptFull?: TelephonyTranscriptTurn[];
  transfer?: TelephonyTransferInfo;
  outcome?: string;
  intent?: string;
  sentiment?: string;
}

export interface TelephonyInboundResult {
  action: 'created' | 'duplicate';
  callId: string;
  externalCallId: string;
}

export interface TelephonyRecadosInboundResponse {
  updatedAt: string;
  items: Array<{
    id: string;
    titulo: string;
    mensagem: string;
    prioridade: string;
  }>;
}
