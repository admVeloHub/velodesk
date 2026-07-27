/**
 * clienteAdapter v1.1.0 — múltiplos e-mails/telefones + whatsapp
 * VERSION: v1.1.0 | DATE: 2026-07-27
 */
import { normalizeCpf } from '../../services/desk/utils';

function normalizeListInput(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  const single = String(value ?? '').trim();
  return single ? [single] : [];
}

export function resolveWhatsappPhone(phoneList, whatsappPhone) {
  const phones = normalizeListInput(phoneList);
  if (!phones.length) return '';
  const selected = String(whatsappPhone ?? '').trim();
  if (selected && phones.includes(selected)) return selected;
  return phones[0];
}

export function getPrimaryDados(doc) {
  if (!doc?.clienteDados?.length) return null;
  return doc.clienteDados[0];
}

export function mapClienteDocToContact(doc) {
  const dados = getPrimaryDados(doc);
  if (!dados) return null;
  const cpf = normalizeCpf(dados.clienteCpf);
  const emails = dados.clienteEmail?.lista || [];
  const phones = dados.clienteTelefone?.lista || [];
  const whatsappPhone = dados.clienteTelefone?.whatsapp || resolveWhatsappPhone(phones, '');
  return {
    clienteId: doc._id || doc.id,
    clientCPF: cpf,
    clientName: dados.clienteNome || '',
    emails,
    phones,
    whatsappPhone,
    email: emails[0] || '',
    phone: whatsappPhone || phones[0] || '',
  };
}

export function buildClienteCreateBody({
  cpf,
  nome,
  email,
  telefone,
  emails,
  phones,
  whatsappPhone,
}) {
  const clienteCpf = normalizeCpf(cpf);
  const clienteNome = String(nome || '').trim();
  const emailList = normalizeListInput(emails ?? email);
  const phoneList = normalizeListInput(phones ?? telefone);
  const whatsapp = resolveWhatsappPhone(phoneList, whatsappPhone);
  return {
    clienteDados: [{
      clienteCpf,
      clienteNome,
      clienteEmail: { lista: emailList },
      clienteTelefone: {
        lista: phoneList,
        ...(whatsapp ? { whatsapp } : {}),
      },
    }],
    atendimentoHistorico: [],
  };
}

export async function persistClienteContact(clientsApi, {
  cpf,
  nome,
  email,
  telefone,
  emails,
  phones,
  whatsappPhone,
  clienteId,
}) {
  const payload = buildClienteCreateBody({
    cpf,
    nome,
    email,
    telefone,
    emails,
    phones,
    whatsappPhone,
  });
  const updatePayload = { clienteDados: payload.clienteDados };
  const id = String(clienteId || '').trim();

  if (id) {
    return clientsApi.update(id, updatePayload);
  }

  const cpfDigits = normalizeCpf(cpf);
  if (cpfDigits) {
    try {
      const existing = await clientsApi.getByCpf(cpfDigits);
      const existingId = existing?._id || existing?.id;
      if (existingId) return clientsApi.update(existingId, updatePayload);
    } catch (err) {
      if (err?.response?.status !== 404) throw err;
    }
  }

  const emailList = normalizeListInput(emails ?? email);
  const firstEmail = emailList[0] || '';
  if (firstEmail) {
    try {
      const existing = await clientsApi.getByEmail(firstEmail);
      const existingId = existing?._id || existing?.id;
      if (existingId) return clientsApi.update(existingId, updatePayload);
    } catch (err) {
      if (err?.response?.status !== 404) throw err;
    }
  }

  if (!cpfDigits && !firstEmail) {
    throw new Error('CPF ou e-mail necessário para atualizar o cadastro.');
  }

  return clientsApi.create(payload);
}

export function buildDraftTicketFromCliente(doc, agentName) {
  const contact = mapClienteDocToContact(doc);
  if (!contact) return null;
  const agent = agentName || 'Agente';
  const clientName = contact.clientName || 'Cliente';
  return {
    title: `Atendimento — ${clientName}`,
    clienteId: contact.clienteId,
    clientCPF: contact.clientCPF,
    clientName: contact.clientName,
    channel: 'WhatsApp',
    tipo: 'Solicitação',
    atribuir: `${agent} (eu)`,
    lateralForm: {
      cpf: contact.clientCPF,
      clienteCpf: contact.clientCPF,
      clienteNome: contact.clientName,
      clienteEmail: contact.emails,
      clienteTelefone: contact.phones,
      clienteTelefoneWhatsapp: contact.whatsappPhone,
      canal: 'WhatsApp',
      classificacaoTipo: 'Solicitação',
      produto: '',
      motivo: '',
      detalhe: '',
      responsavel: agent,
    },
  };
}
