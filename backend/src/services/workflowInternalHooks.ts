/** workflowInternalHooks v1.0.0 — registry v1 de webhooks internos do workflow */
import type { IChamadoN1 } from '../models/ChamadoN1';

export interface InternalHookContext {
  chamado: IChamadoN1;
  workflowId: string;
  workflowSlug: string;
  step: number;
  passoId: string | null;
}

export interface InternalHookResult {
  ok: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

export const WORKFLOW_INTERNAL_HOOKS: Record<
  string,
  { label: string; handler: (ctx: InternalHookContext) => Promise<InternalHookResult> }
> = {
  'gestao.alert': {
    label: 'Alerta gestão (stub)',
    handler: async () => ({ ok: true, message: 'Hook gestao.alert executado' }),
  },
  'integracao.stub': {
    label: 'Integração stub',
    handler: async () => ({ ok: true, message: 'Hook integracao.stub executado' }),
  },
};

export async function invokeInternalHook(
  hookId: string,
  ctx: InternalHookContext,
): Promise<InternalHookResult> {
  const hook = WORKFLOW_INTERNAL_HOOKS[hookId];
  if (!hook) {
    return { ok: false, message: `Hook interno não encontrado: ${hookId}` };
  }
  return hook.handler(ctx);
}

export function listInternalHookOptions(): Array<{ id: string; label: string }> {
  return Object.entries(WORKFLOW_INTERNAL_HOOKS).map(([id, meta]) => ({
    id,
    label: meta.label,
  }));
}
