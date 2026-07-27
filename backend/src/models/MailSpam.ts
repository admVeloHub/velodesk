/** MailSpam v1.0.0 — desk_config.mail_spam */
import type { IMailRule } from './mailRule.shared';
import { getMailRuleModel } from './mailRule.shared';

export type { IMailRule as IMailSpam, MailRuleType as MailSpamType } from './mailRule.shared';

export function getMailSpamModel() {
  return getMailRuleModel('MailSpam', 'mail_spam');
}

export type MailSpamDoc = IMailRule;
