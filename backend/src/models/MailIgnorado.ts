/** MailIgnorado v1.0.0 — desk_config.mail_ignorado */
import type { IMailRule } from './mailRule.shared';
import { getMailRuleModel } from './mailRule.shared';

export type { IMailRule as IMailIgnorado, MailRuleType as MailIgnoradoType } from './mailRule.shared';

export function getMailIgnoradoModel() {
  return getMailRuleModel('MailIgnorado', 'mail_ignorado');
}

export type MailIgnoradoDoc = IMailRule;
