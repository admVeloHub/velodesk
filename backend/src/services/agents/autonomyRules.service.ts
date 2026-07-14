/**
 * autonomyRules.service v1.0.0 — regras configuráveis de envio autônomo
 * VERSION: v1.0.0 | DATE: 2026-07-13
 */
import fs from 'fs';
import path from 'path';
import { AgentAutonomyRule, type IAgentAutonomyRule } from '../../models/AgentAutonomyRule';
import { env } from '../../config/env';
import type { TicketAiTabulationResult } from './agentTypes';
import { hasCriticalKeywords } from './criticalKeywords.service';

const DEFAULT_RULES_PATH = path.join(__dirname, '../../config/agentAutonomyRules.default.json');

export interface AutonomyEvaluateInput {
  tabulacao: TicketAiTabulationResult;
  canal?: string;
  threadMessageCount: number;
  auditScore: number;
  clientContext?: string;
  responseText?: string;
}

export interface AutonomyEvaluateResult {
  allowed: boolean;
  matchedRuleId?: string;
  reason?: string;
}

function loadDefaultRules(): Partial<IAgentAutonomyRule>[] {
  try {
    if (!fs.existsSync(DEFAULT_RULES_PATH)) return [];
    const raw = fs.readFileSync(DEFAULT_RULES_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.rules) ? parsed.rules : [];
  } catch {
    return [];
  }
}

export async function listAutonomyRules(): Promise<IAgentAutonomyRule[]> {
  const dbRules = await AgentAutonomyRule.find().sort({ prioridade: -1, createdAt: -1 }).lean();
  if (dbRules.length > 0) return dbRules as unknown as IAgentAutonomyRule[];
  return loadDefaultRules() as IAgentAutonomyRule[];
}

export async function createAutonomyRule(data: Partial<IAgentAutonomyRule>) {
  return AgentAutonomyRule.create(data);
}

export async function updateAutonomyRule(id: string, data: Partial<IAgentAutonomyRule>) {
  return AgentAutonomyRule.findByIdAndUpdate(id, data, { new: true });
}

export async function deleteAutonomyRule(id: string) {
  return AgentAutonomyRule.findByIdAndDelete(id);
}

function ruleMatches(
  rule: Partial<IAgentAutonomyRule>,
  input: AutonomyEvaluateInput,
): boolean {
  if (rule.enabled === false) return false;
  if (input.auditScore < (rule.minAuditScore ?? env.agentAuditThresholdAuto)) return false;
  if (input.threadMessageCount > (rule.maxMessagesInThread ?? 2)) return false;

  if (rule.tipo?.trim() && rule.tipo.trim() !== input.tabulacao.tipo) return false;
  if (rule.produto?.trim() && rule.produto.trim() !== input.tabulacao.produto) return false;
  if (rule.motivo?.trim() && rule.motivo.trim() !== input.tabulacao.motivo) return false;
  if (rule.detalhe?.trim() && rule.detalhe.trim() !== input.tabulacao.detalhe) return false;

  if (rule.canais?.length) {
    const canal = String(input.canal || '').trim().toLowerCase();
    const allowed = rule.canais.map((c) => String(c).trim().toLowerCase());
    if (canal && !allowed.some((c) => canal.includes(c) || c.includes(canal))) return false;
  }

  const bloqueios = rule.bloqueios || [];
  if (bloqueios.length && hasCriticalKeywords(input.clientContext, input.responseText, bloqueios.join(' '))) {
    return false;
  }

  return true;
}

export async function evaluateAutonomy(input: AutonomyEvaluateInput): Promise<AutonomyEvaluateResult> {
  if (!env.agentsAutonomyEnabled) {
    return { allowed: false, reason: 'Autonomia desabilitada (AGENTS_AUTONOMY_ENABLED=false)' };
  }

  if (hasCriticalKeywords(input.clientContext, input.responseText)) {
    return { allowed: false, reason: 'Palavras críticas detectadas no contexto' };
  }

  const rules = await listAutonomyRules();
  const enabledRules = rules.filter((r) => r.enabled !== false);

  if (enabledRules.length === 0) {
    return { allowed: false, reason: 'Nenhuma regra de autonomia cadastrada' };
  }

  for (const rule of enabledRules.sort((a, b) => (b.prioridade ?? 0) - (a.prioridade ?? 0))) {
    if (ruleMatches(rule, input)) {
      return {
        allowed: true,
        matchedRuleId: rule._id?.toString?.() || 'default',
      };
    }
  }

  return { allowed: false, reason: 'Nenhuma regra compatível com o caso' };
}
