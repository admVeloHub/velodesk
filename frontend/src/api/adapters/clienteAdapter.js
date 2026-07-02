/**
 * clienteAdapter v1.0.4 — persistência de contato no cadastro
 * VERSION: v1.0.4 | DATE: 2026-07-02
 */
import { normalizeCpf } from '../../services/desk/utils';

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
  return {
    clienteId: doc._id || doc.id,
    clientCPF: cpf,
    clientName: dados.clienteNome || '',
    emails,
    phones,
    email: emails[0] || '',
    phone: phones[0] || '',
  };
}

export function buildClienteCreateBody({ cpf, nome, email, telefone }) {
  const clienteCpf = normalizeCpf(cpf);
  const clienteNome = String(nome || '').trim();
  const emailTrim = String(email || '').trim();
  const telTrim = String(telefone || '').trim();
  return {
    clienteDados: [{
      clienteCpf,
      clienteNome,
      clienteEmail: { lista: emailTrim ? [emailTrim] : [] },
      clienteTelefone: { lista: telTrim ? [telTrim] : [] },
    }],
    atendimentoHistorico: [],
  };
}

export async function persistClienteContact(clientsApi, {
  cpf,
  nome,
  email,
  telefone,
  clienteId,
}) {
  const payload = buildClienteCreateBody({ cpf, nome, email, telefone });
  const updatePayload = { clienteDados: payload.clienteDados };
  const id = String(clienteId || '').trim();

  if (id) {
    return clientsApi.update(id, updatePayload);
  }

  const cpfDigits = normalizeCpf(cpf);
  if (!cpfDigits) {
    throw new Error('CPF não informado para atualizar o cadastro.');
  }

  try {
    const existing = await clientsApi.getByCpf(cpfDigits);
    const existingId = existing?._id || existing?.id;
    if (existingId) return clientsApi.update(existingId, updatePayload);
  } catch (err) {
    if (err?.response?.status !== 404) throw err;
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
      canal: 'WhatsApp',
      classificacaoTipo: 'Solicitação',
      produto: '',
      motivo: '',
      detalhe: '',
      responsavel: agent,
    },
  };
}
