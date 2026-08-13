/** test-parse-bacen-rdr-email v1.0.0 — parser PRIORIZAR - BACEN/ RDR */
import {
  isBacenRdrPrioritySubject,
  isBacenRdrStructuredInboundEmail,
  parseBacenRdrInboundEmail,
} from '../src/services/inbound-email/parseBacenRdrEmail.service';
import type { InboundEmailPayload } from '../src/services/inbound-email/types';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const SAMPLE_EMAIL = `Dados do Demandante
Nome\tCAMILA ANGELO NOGUEIRA LOPES
Documento\t01265323208
Endereço\tPedro Alvares Cabral, 464, Estacao Experimenta, RIO BRANCO , AC - CEP: 69918-174
Telefone(s)\t(68) 99211-0513
E-mail\tcamilanogueeira@gmail.com
Id Bacen\t20261074668
Dados da Reclamação
Id(20261074668)
Descrição
EXTERNA - SISCAP em 23/07/2026 11:44


Tipo: Reclamação
Mensagem: Contratei, por intermédio da Velotax, uma operação de antecipação da restituição do Imposto de Renda, vinculada à Via Capital/Celcoin SCD, recebendo aproximadamente R$ 2.632,20.

Antes do vencimento, solicitei apenas a desvinculação da minha chave Pix da conta indicada pela instituição. Fui informada somente de que isso acarretaria 'quebra contratual', sem qualquer informação clara sobre as consequências financeiras.

Por gentileza verificar a possibilidade de atender a demandante abaixo:

Nome: CAMILA ANGELO NOGUEIRA LOPES
CPF: 01265323208
Contrato: 5248479`;

function buildPayload(subject: string, textBody: string): InboundEmailPayload {
  return {
    messageId: '<bacen-test@example.com>',
    subject,
    from: { email: 'forward@empresa.com.br', name: 'Encaminhador' },
    to: ['bacen-rdr@empresa.com.br'],
    textBody,
    htmlBody: '',
    attachments: [],
    receivedAt: new Date(),
  };
}

function testPrioritySubjectDetection() {
  assert(isBacenRdrPrioritySubject('PRIORIZAR -  BACEN/ RDR'), 'deve detectar PRIORIZAR - BACEN/ RDR');
  assert(isBacenRdrPrioritySubject('priorizar - bacen/rdr'), 'deve ser case-insensitive');
  assert(!isBacenRdrPrioritySubject('PRIORIZAR - CGOV'), 'subject CGOV não deve acionar Bacen');
}

function testStructuredDetection() {
  const payload = buildPayload('PRIORIZAR -  BACEN/ RDR', SAMPLE_EMAIL);
  assert(isBacenRdrStructuredInboundEmail(payload), 'subject PRIORIZAR deve marcar estruturado');

  const bodyOnly = buildPayload('Demanda Bacen', SAMPLE_EMAIL);
  assert(isBacenRdrStructuredInboundEmail(bodyOnly), 'corpo tabular deve marcar estruturado');
}

function testHappyPathParse() {
  const parsed = parseBacenRdrInboundEmail(SAMPLE_EMAIL);
  assert(parsed.isValid(), 'parse de exemplo deve ser válido');
  assert(parsed.nome === 'CAMILA ANGELO NOGUEIRA LOPES', 'nome');
  assert(parsed.cpf === '01265323208', 'cpf normalizado');
  assert(parsed.email === 'camilanogueeira@gmail.com', 'email');
  assert(parsed.telefone === '68992110513', 'telefone');
  assert(parsed.cidade === 'RIO BRANCO', 'cidade');
  assert(parsed.uf === 'AC', 'uf');
  assert(parsed.idDemanda === '20261074668', 'id demanda');
  assert(parsed.protocoloBacen === 'BC-2026-61074668', 'protocolo bacen');
  assert(parsed.tipo === 'Reclamação', 'tipo');
  assert(parsed.mensagem.includes('Contratei, por intermédio da Velotax'), 'mensagem');
  assert(parsed.descricao.includes('EXTERNA - SISCAP'), 'descricao header');
  assert(parsed.descricao.includes('Contrato: 5248479'), 'contrato na descricao');
  assert(parsed.contrato === '5248479', 'contrato');
  assert(Boolean(parsed.dataDemandaIso), 'data demanda ISO');
  assert(parsed.assunto.includes('Contratei'), 'assunto derivado');
}

function testInvalidParse() {
  const parsed = parseBacenRdrInboundEmail('E-mail sem estrutura Bacen');
  assert(!parsed.isValid(), 'corpo inválido não deve passar isValid');
}

async function main() {
  testPrioritySubjectDetection();
  testStructuredDetection();
  testHappyPathParse();
  testInvalidParse();
  console.log('test-parse-bacen-rdr-email: OK (4 checks)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
