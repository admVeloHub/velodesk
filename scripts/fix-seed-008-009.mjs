import fs from 'fs';
const p = 'backend/src/services/workflowTestSeed.service.ts';
let f = fs.readFileSync(p, 'utf8');

// 008 Roberto - Estorno duplicidade
f = f.replace(
  `      chamadoProtocolo: \`\${WORKFLOW_TEST_PROTOCOL_PREFIX}008\`,
      chamadoTitulo: '[TESTE] AprovaÃ§Ã£o reembolso â€” Roberto Alves',
      cliente: [{ clienteCpf: roberto.cpf, clienteId: clientRefs.get(roberto.cpf) ?? null }],
      tabulacao: [{
        tipoChamado: 'SolicitaÃ§Ã£o',
        produto: 'Produto X',
        motivo: 'Reembolso',
        detalhe: 'Dentro de 7 dias',
        responsavel: 'Ana Silva',
        atribuido: '',
      }],
      registro: [
        buildClienteMessage(
          'Preciso do reembolso do Produto X. Compra realizada por e-mail hÃ¡ 5 dias.',
          roberto.nome,
          8,
        ),
        buildWorkflowAgentRegistro({
          agentName: 'Ana Silva (Atendimento)',
          note: 'Cliente elegÃ­vel â€” encaminhado ao financeiro.',
          stepActiveHoursAgo: 2.75,
          approval: buildApprovalMeta({
            valor: 249.9,
            canal: 'E-mail',
            formaPagamento: 'CartÃ£o Â· final 4521',
          }),
        }),
      ],`,
  `      chamadoProtocolo: \`\${WORKFLOW_TEST_PROTOCOL_PREFIX}008\`,
      chamadoTitulo: '[TESTE] Estorno duplicidade — Roberto Alves',
      cliente: [{ clienteCpf: roberto.cpf, clienteId: clientRefs.get(roberto.cpf) ?? null }],
      tabulacao: [{
        tipoChamado: 'Solicitação',
        produto: 'duplicidade',
        motivo: 'Estorno',
        detalhe: 'Em análise',
        responsavel: 'Ana Silva',
        atribuido: '',
      }],
      registro: [
        buildClienteMessage(
          'Fui cobrado duas vezes pelo mesmo produto. Solicito estorno da duplicidade.',
          roberto.nome,
          8,
        ),
        buildWorkflowAgentRegistro({
          agentName: 'Ana Silva (Atendimento)',
          note: 'Duplicidade confirmada — encaminhado ao financeiro.',
          stepActiveHoursAgo: 2.75,
          tabulacao: { produto: 'duplicidade', motivo: 'Estorno', detalhe: 'Em análise' },
          approval: buildApprovalMeta({
            valor: 89.9,
            canal: 'E-mail',
            formaPagamento: 'Cartão · final 4521',
          }),
        }),
      ],`
);

// 009 Fernanda - Produto Y R$599 SLA critico
f = f.replace(
  `      chamadoProtocolo: \`\${WORKFLOW_TEST_PROTOCOL_PREFIX}009\`,
      chamadoTitulo: '[TESTE] AprovaÃ§Ã£o reembolso â€” Fernanda Lima (SLA crÃ­tico)',
      cliente: [{ clienteCpf: fernanda.cpf, clienteId: clientRefs.get(fernanda.cpf) ?? null }],
      tabulacao: [{
        tipoChamado: 'SolicitaÃ§Ã£o',
        produto: 'Produto X',
        motivo: 'Reembolso',
        detalhe: 'Dentro de 7 dias',
        responsavel: 'Ana Silva',
        atribuido: '',
      }],
      registro: [
        buildClienteMessage(
          'Liguei para solicitar reembolso do Produto X. A compra foi hÃ¡ 3 dias e preciso de urgÃªncia.',
          fernanda.nome,
          10,
        ),
        buildWorkflowAgentRegistro({
          agentName: 'Ana Silva (Atendimento)',
          note: 'Urgente â€” SLA financeiro prestes a vencer.',
          stepActiveHoursAgo: 3.85,
          approval: buildApprovalMeta({
            valor: 249.9,
            canal: 'Telefone',
            diasDesdeCompra: 3,
          }),
        }),
      ],`,
  `      chamadoProtocolo: \`\${WORKFLOW_TEST_PROTOCOL_PREFIX}009\`,
      chamadoTitulo: '[TESTE] Reembolso Produto Y — Fernanda Lima (SLA crítico)',
      cliente: [{ clienteCpf: fernanda.cpf, clienteId: clientRefs.get(fernanda.cpf) ?? null }],
      tabulacao: [{
        tipoChamado: 'Solicitação',
        produto: 'Produto Y',
        motivo: 'Reembolso',
        detalhe: 'Dentro de 7 dias',
        responsavel: 'Ana Silva',
        atribuido: '',
      }],
      registro: [
        buildClienteMessage(
          'Liguei para solicitar reembolso do Produto Y. A compra foi há 3 dias e preciso de urgência.',
          fernanda.nome,
          10,
        ),
        buildWorkflowAgentRegistro({
          agentName: 'Ana Silva (Atendimento)',
          note: 'Urgente — SLA financeiro prestes a vencer.',
          stepActiveHoursAgo: 3.83,
          tabulacao: { produto: 'Produto Y', motivo: 'Reembolso', detalhe: 'Dentro de 7 dias' },
          approval: buildApprovalMeta({
            valor: 599,
            canal: 'Telefone',
            diasDesdeCompra: 3,
          }),
        }),
      ],`
);

fs.writeFileSync(p, f, 'utf8');
console.log('008/009 patched');
