/** MailPriority v1.0.0 — desk_config.mail_priority */
import type { IMailRule } from './mailRule.shared';
import { getMailRuleModel } from './mailRule.shared';

export type { IMailRule as IMailPriority, MailRuleType as MailPriorityType } from './mailRule.shared';

export function getMailPriorityModel() {
  return getMailRuleModel('MailPriority', 'mail_priority');
}

export type MailPriorityDoc = IMailRule;
