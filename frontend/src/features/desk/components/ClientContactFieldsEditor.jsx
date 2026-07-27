/**
 * ClientContactFieldsEditor v1.0.0 — múltiplos e-mails/telefones + WhatsApp
 * VERSION: v1.0.0 | DATE: 2026-07-27
 */
import React from 'react';
import { isValidEmailFormat } from '../../../services/desk/utils';

function ensureMinOne(items) {
  return items.length ? items : [''];
}

export default function ClientContactFieldsEditor({
  name,
  onNameChange,
  emails,
  onEmailsChange,
  phones,
  onPhonesChange,
  whatsappPhone,
  onWhatsappPhoneChange,
  idPrefix = 'clientContact',
  showName = true,
  emailErrors = {},
  onEmailBlur,
}) {
  const emailRows = ensureMinOne(emails);
  const phoneRows = ensureMinOne(phones);

  const updateEmail = (index, value) => {
    const next = [...emailRows];
    next[index] = value;
    onEmailsChange(next);
  };

  const addEmail = () => onEmailsChange([...emailRows, '']);

  const removeEmail = (index) => {
    if (emailRows.length <= 1) {
      onEmailsChange(['']);
      return;
    }
    onEmailsChange(emailRows.filter((_, i) => i !== index));
  };

  const updatePhone = (index, value) => {
    const next = [...phoneRows];
    const prev = next[index];
    next[index] = value;
    onPhonesChange(next);
    if (whatsappPhone && whatsappPhone === prev) {
      onWhatsappPhoneChange(value.trim());
    }
  };

  const addPhone = () => onPhonesChange([...phoneRows, '']);

  const removePhone = (index) => {
    const removed = phoneRows[index];
    const next = phoneRows.length <= 1 ? [''] : phoneRows.filter((_, i) => i !== index);
    onPhonesChange(next);
    if (whatsappPhone && whatsappPhone === removed) {
      const fallback = next.map((item) => String(item || '').trim()).find(Boolean) || '';
      onWhatsappPhoneChange(fallback);
    }
  };

  const selectWhatsapp = (value) => {
    onWhatsappPhoneChange(String(value || '').trim());
  };

  return (
    <div className="client-contact-fields">
      {showName ? (
        <>
          <label className="client-contact-fields__label" htmlFor={`${idPrefix}Name`}>Nome</label>
          <input
            type="text"
            className="client-contact-fields__input"
            id={`${idPrefix}Name`}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            autoComplete="name"
          />
        </>
      ) : null}

      <div className="client-contact-fields__group">
        <div className="client-contact-fields__group-head">
          <span className="client-contact-fields__label">E-mails</span>
          <button type="button" className="client-contact-fields__add-btn" onClick={addEmail}>
            <i className="ti ti-plus" aria-hidden="true" />
            Adicionar
          </button>
        </div>
        {emailRows.map((email, index) => (
          <div className="client-contact-fields__row" key={`email-${index}`}>
            <input
              type="email"
              className={'client-contact-fields__input' + (emailErrors[index] ? ' client-contact-fields__input--error' : '')}
              id={`${idPrefix}Email-${index}`}
              value={email}
              onChange={(e) => updateEmail(index, e.target.value)}
              onBlur={() => onEmailBlur?.(index, email)}
              placeholder="nome@dominio.com"
              autoComplete={index === 0 ? 'email' : 'off'}
            />
            <button
              type="button"
              className="client-contact-fields__remove-btn"
              onClick={() => removeEmail(index)}
              aria-label="Remover e-mail"
              title="Remover"
            >
              <i className="ti ti-trash" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <div className="client-contact-fields__group">
        <div className="client-contact-fields__group-head">
          <span className="client-contact-fields__label">Telefones</span>
          <button type="button" className="client-contact-fields__add-btn" onClick={addPhone}>
            <i className="ti ti-plus" aria-hidden="true" />
            Adicionar
          </button>
        </div>
        {phoneRows.map((phone, index) => {
          const trimmed = String(phone || '').trim();
          const radioName = `${idPrefix}-whatsapp`;
          return (
            <div className="client-contact-fields__row client-contact-fields__row--phone" key={`phone-${index}`}>
              <input
                type="tel"
                className="client-contact-fields__input"
                id={`${idPrefix}Phone-${index}`}
                value={phone}
                onChange={(e) => updatePhone(index, e.target.value)}
                placeholder="(11) 99999-9999"
                autoComplete={index === 0 ? 'tel' : 'off'}
              />
              <label
                className={'client-contact-fields__wa' + (!trimmed ? ' is-disabled' : '')}
                title="Usar este número para WhatsApp"
              >
                <input
                  type="radio"
                  name={radioName}
                  checked={Boolean(trimmed && whatsappPhone === trimmed)}
                  disabled={!trimmed}
                  onChange={() => selectWhatsapp(trimmed)}
                />
                <i className="ti ti-brand-whatsapp" aria-hidden="true" />
                <span>WhatsApp</span>
              </label>
              <button
                type="button"
                className="client-contact-fields__remove-btn"
                onClick={() => removePhone(index)}
                aria-label="Remover telefone"
                title="Remover"
              >
                <i className="ti ti-trash" aria-hidden="true" />
              </button>
            </div>
          );
        })}
        <p className="client-contact-fields__hint">
          Marque qual número será usado para iniciar conversas no WhatsApp.
        </p>
      </div>
    </div>
  );
}

export function validateClientContactDraft({ name, emails, phones, whatsappPhone }, { requireName = true } = {}) {
  const nome = String(name || '').trim();
  if (requireName && !nome) {
    return { ok: false, message: 'Informe o nome do cliente.' };
  }

  const emailList = (emails || []).map((item) => String(item || '').trim()).filter(Boolean);
  for (let i = 0; i < (emails || []).length; i += 1) {
    const value = String(emails[i] || '').trim();
    if (value && !isValidEmailFormat(value)) {
      return { ok: false, message: 'Informe um e-mail válido (ex.: nome@dominio.com).', emailIndex: i };
    }
  }

  const phoneList = (phones || []).map((item) => String(item || '').trim()).filter(Boolean);
  if (phoneList.length > 1 && whatsappPhone && !phoneList.includes(String(whatsappPhone).trim())) {
    return { ok: false, message: 'Selecione um telefone válido para WhatsApp.' };
  }
  if (phoneList.length > 1 && !String(whatsappPhone || '').trim()) {
    return { ok: false, message: 'Selecione qual telefone será usado no WhatsApp.' };
  }

  return { ok: true, nome, emailList, phoneList, whatsappPhone: resolveWhatsappPhone(phoneList, whatsappPhone) };
}

export function resolveWhatsappPhone(phoneList, whatsappPhone) {
  const phones = (phoneList || []).map((item) => String(item || '').trim()).filter(Boolean);
  if (!phones.length) return '';
  const selected = String(whatsappPhone || '').trim();
  if (selected && phones.includes(selected)) return selected;
  return phones[0];
}

export function buildContactDraftFromFields(fields) {
  const emails = Array.isArray(fields.emails)
    ? fields.emails
    : (fields.email ? [fields.email] : []);
  const phones = Array.isArray(fields.phones)
    ? fields.phones
    : (fields.phone ? [fields.phone] : []);
  return {
    name: fields.name || '',
    emails: emails.length ? emails : [''],
    phones: phones.length ? phones : [''],
    whatsappPhone: fields.whatsappPhone || resolveWhatsappPhone(phones, fields.whatsappPhone),
  };
}
