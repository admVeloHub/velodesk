/** test-parse-consumidor-gov-email v1.0.0 — parser PRIORIZAR-CGOV */
import {
  isCgovPrioritySubject,
  isCgovStructuredInboundEmail,
  parseConsumidorGovInboundEmail,
} from '../src/services/inbound-email/parseConsumidorGovEmail.service';
import type { InboundEmailPayload } from '../src/services/inbound-email/types';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const SAMPLE_EMAIL = `Dados do Reclamante
Nome\tGustavo Azevedo Moscoso
CPF\t035.509.424-00
E-mail\tgustavo.moscoso@yahoo.com.br
Telefone\t77991924029
Localidade\tVitória da Conquista - BA

Dados da Reclamação
Protocolo: 20260700015790834
Área\tServiços Financeiros
Assunto\tCrédito Pessoal e Demais Empréstimos (exceto financiamento de imóveis e veículos)
Problema\tCálculo de juros, saldo devedor (contestação, solicitação de histórico, dúvidas)
Situação\tEm Análise Pelo Fornecedor
Abertura\t31/07/2026
Prazo\t10/08/2026
Protocolo da empresa\tvia celular

Descrição da Reclamação
Descrição
Venho por meio desta reclamação solicitar a renegociação da minha dívida referente ao contrato Nº 5081141/ empréstimo pessoal/antecipação do imposto de renda junto a essa instituição financeira. O valor atual da dívida é de R$6.181,13 e atualmente não possuo condições financeiras de arcar com o valor integral cobrado.

Nome: Gustavo Azevedo Moscoso
Contrato: 5081141
CPF: 03550942400`;

function buildPayload(subject: string, textBody: string): InboundEmailPayload {
  return {
    messageId: '<cgov-test@example.com>',
    subject,
    from: { email: 'forward@empresa.com.br', name: 'Encaminhador' },
    to: ['consumidor.gov@empresa.com.br'],
    textBody,
    htmlBody: '',
    attachments: [],
    receivedAt: new Date(),
  };
}

function testPrioritySubjectDetection() {
  assert(isCgovPrioritySubject('PRIORIZAR - CGOV'), 'deve detectar PRIORIZAR - CGOV');
  assert(isCgovPrioritySubject('priorizar - cgov'), 'deve ser case-insensitive');
  assert(!isCgovPrioritySubject('Demanda comum'), 'subject comum não deve acionar');
}

function testStructuredDetection() {
  const payload = buildPayload('PRIORIZAR - CGOV', SAMPLE_EMAIL);
  assert(isCgovStructuredInboundEmail(payload), 'subject PRIORIZAR deve marcar estruturado');

  const bodyOnly = buildPayload('Demanda Consumidor.gov', SAMPLE_EMAIL);
  assert(isCgovStructuredInboundEmail(bodyOnly), 'corpo tabular deve marcar estruturado');
}

function testHappyPathParse() {
  const parsed = parseConsumidorGovInboundEmail(SAMPLE_EMAIL);
  assert(parsed.isValid(), 'parse de exemplo deve ser válido');
  assert(parsed.nome === 'Gustavo Azevedo Moscoso', 'nome');
  assert(parsed.cpf === '03550942400', 'cpf normalizado');
  assert(parsed.email === 'gustavo.moscoso@yahoo.com.br', 'email');
  assert(parsed.telefone === '77991924029', 'telefone');
  assert(parsed.cidade === 'Vitória da Conquista', 'cidade');
  assert(parsed.uf === 'BA', 'uf');
  assert(parsed.protocolo === '20260700015790834', 'protocolo');
  assert(parsed.area === 'Serviços Financeiros', 'area');
  assert(parsed.assunto.includes('Crédito Pessoal'), 'assunto');
  assert(parsed.problema.includes('Cálculo de juros'), 'problema');
  assert(parsed.descricao.includes('renegociação'), 'descricao');
  assert(Boolean(parsed.dataAberturaIso), 'data abertura ISO');
  assert(Boolean(parsed.prazoIso), 'prazo ISO');
}

function testMultilineDescription() {
  const body = `${SAMPLE_EMAIL}\n\nLinha extra da descrição.`;
  const parsed = parseConsumidorGovInboundEmail(body);
  assert(parsed.descricao.includes('Linha extra da descrição'), 'descricao multilinha');
}

function testInvalidParse() {
  const parsed = parseConsumidorGovInboundEmail('E-mail sem estrutura CGOV');
  assert(!parsed.isValid(), 'corpo inválido não deve passar isValid');
}

async function main() {
  testPrioritySubjectDetection();
  testStructuredDetection();
  testHappyPathParse();
  testMultilineDescription();
  testInvalidParse();
  console.log('test-parse-consumidor-gov-email: OK (5 checks)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
