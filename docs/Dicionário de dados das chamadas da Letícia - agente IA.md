Dicionário de dados das chamadas da Letícia
Velotax SAC
Objetivo
Este documento descreve os dados de negócio que podem ser enviados no campo data_collected
de cada chamada finalizada da Letícia Velotax SAC.
O objetivo é permitir que a Velotax decida quais informações deseja armazenar, exibir, pesquisar ou
usar em automações internas após receber o POST da chamada finalizada.
Versão deste dicionário: 1.0
Última atualização: 05/08/2026
Formato no payload
Cada dado é identificado por uma chave estável e possui, no mínimo, a seguinte estrutura:
Plain text
{
"data_collected": {
"produto_identificado": {
"value": "emprestimo_pessoal",
"rationale": "A pessoa solicitou informações sobre o empréstimo pessoal."
}
}
}
Propriedades de cada item:
Propriedade Tipo Descrição
value
varia
conforme o
campo
Valor que deve ser usado pelas integrações e regras de negócio.
rationale
string |
null
Explicação textual da evidência usada para preencher o valor.
Pode ser null quando o dado foi obtido de forma estruturada.
Não deve ser usado como chave de automação.
__source
object
opcional
Metadado técnico de procedência do segmento da chamada.
Pode não existir e não é necessário para interpretar o valor.
Regras gerais de consumo
Nem todos os campos aparecem em todas as chamadas.
Um campo pode estar ausente, conter value: null ou, nos campos textuais, conter uma string
vazia quando não houve informação conclusiva.
As automações devem usar a propriedade value , nunca interpretar o texto de rationale como
regra de negócio.
CPF deve ser tratado como texto, preservando os onze dígitos e eventuais zeros à esquerda.
IDs e números de chamados também devem ser tratados como texto.
Consumidores devem tolerar novos campos e novos valores de enumeração no futuro, registrando
valores desconhecidos sem rejeitar o payload completo.
O payload contém dados pessoais. Seu armazenamento e uso devem respeitar os controles de
acesso e retenção aplicáveis na Velotax.
Visão geral dos campos
Campo Tipo de value Presença Finalidade
rota_atendida
string
enumerada
Opcional
Rota ampla de
atendimento usada para
conduzir a conversa.
produto_identificado
string
enumerada
Opcional
Produto ou área mais
específica reconhecida
na demanda.
primeiro_nome string Opcional
Primeiro nome obtido
após validação de
identidade.
cpf_resolvido string Opcional
CPF de onze dígitos
efetivamente usado na
consulta de cadastro.
nome_informado string Opcional
Nome informado ou
confirmado pela própria
pessoa.
cliente_velotax boolean Opcional
Resultado conclusivo
da consulta de cadastro
pelo CPF.
assunto_principal
string
enumerada
Opcional
Motivo principal do
contato.
duvida_respondida boolean Opcional
Indica se a dúvida foi
respondida com
informação aprovada.
precisa_acesso_sistema boolean Opcional
Indica dependência de
dado individual, análise
ou ação operacional.
motivo_acesso_sistema string Condicional Motivo resumido para a
dependência
operacional.
chamado_octadesk_registrado boolean Opcional
Confirma se um
chamado foi realmente
registrado.
octadesk_ticket_form
string
enumerada
Condicional
Formulário do chamado
registrado no Octadesk.
ids_tickets_abertos
array<string>
| string
Condicional
IDs técnicos dos
chamados criados na
ligação.
numeros_tickets_abertos
array<string>
| string
Condicional
Números de
acompanhamento dos
chamados criados.
whatsapp_retorno_confirmado boolean Condicional
Confirmação do
WhatsApp de retorno
para o chamado.
identidade_validada boolean Opcional
Resultado da validação
por CPF e mês de
nascimento.
handoff_urgente boolean Opcional
Indica necessidade
aparente de prioridade
humana.
csat_participou boolean Opcional
Indica se houve
participação na
pesquisa de satisfação.
csat_nota integer Condicional
Nota de satisfação
entre um e cinco.
csat_comentario string Condicional
Resposta textual sobre
o que poderia melhorar.
csat_motivo_nao_coletado
string
enumerada
Condicional
Motivo de ausência ou
incompletude da
pesquisa.
recados_operacionais_status
string
enumerada
Opcional
Situação da consulta de
recados temporários no
início da chamada.
recados_operacionais_ativos
string
contendo JSON
Opcional
Recados temporários
efetivamente
disponíveis para aquela
chamada.
desfecho
string
enumerada
Opcional
Resultado final
consolidado do
atendimento.
call_summary string Opcional
Resumo objetivo da
chamada, sem CPF ou
outros segredos de
validação.
Identificação e contexto da demanda
rota_atendida
Rota ampla que concentrou o atendimento. É útil para distribuição por grandes famílias de atendimento
e para relatórios de volume.
Tipo: string
Valor Significado
emprestimo_pessoal Atendimento relacionado ao Empréstimo Pessoal.
antecipacao_salario Atendimento relacionado à Antecipação de Salário.
antecipacao_irpf_2026
Atendimento relacionado à Antecipação do Imposto de Renda da
safra de 2026.
credito_trabalhador Atendimento relacionado ao Crédito do Trabalhador.
celcoin_conta Atendimento relacionado à conta digital Celcoin vinculada à Velotax.
procedimentos_gerais
Procedimento que não pertence a uma única linha de crédito, como
aplicativo, cadastro, pagamentos, segurança ou benefícios.
triagem_geral Demanda ainda ampla ou não identificada com precisão suficiente.
produto_identificado
Produto ou área mais específica reconhecida durante a conversa. Pode ser usado para relatórios com
maior granularidade do que rota_atendida .
Tipo: string
Valor Significado
emprestimo_pessoal Empréstimo Pessoal.
antecipacao_salario Antecipação de Salário.
antecipacao_irpf_2026 Antecipação do Imposto de Renda da safra de 2026.
credito_trabalhador Crédito do Trabalhador.
conta_celcoin Conta digital Celcoin vinculada à Velotax.
app_conta
Acesso, cadastro, funcionamento ou navegação no aplicativo e na
conta.
pagamento
Pagamentos, parcelas, baixa, quitação ou movimentações
relacionadas.
cobranca Cobrança, atraso ou negociação pelos canais especializados.
cancelamento Cancelamento de produto, contrato, serviço ou conta.
seguranca
Segurança da conta, suspeita de fraude ou movimentação não
reconhecida.
senha_transacao Senha usada para confirmar transações.
otp Código temporário de confirmação ou autenticação.
dados_cadastrais Atualização ou correção de dados pessoais e de acesso.
indicacoes Programa Indique e Ganhe e códigos de indicação.
creditos_cupons Créditos, cupons e benefícios promocionais.
malha_fina Assuntos relacionados à malha fina.
retificadora Assuntos relacionados à declaração retificadora.
seguros
Contratação, cobertura, cancelamento, sinistro ou suporte de
seguros.
produtos_nao_oferecidos Produto financeiro ou serviço que a Velotax não oferece.
apostas_bets Dúvida sobre uso da conta ou serviços em apostas e bets.
indefinido Não foi possível determinar uma categoria específica.
fora_escopo Demanda sem relação com os produtos e serviços atendidos.
assunto_principal
Motivo mais importante da ligação. Deve ser usado para identificar a intenção principal, mesmo quando
outros temas também tiverem sido mencionados.
Tipo: string
Valor Significado
contratacao
Como contratar ou andamento inicial de uma
contratação.
elegibilidade Disponibilidade ou elegibilidade para uma oferta.
negativa_credito Oferta ou crédito não aprovado.
open_finance
Conexão, renovação ou falha relacionada ao Open
Finance.
ecac Acesso, autorização ou procedimento no e-CAC.
caf Dúvida ou procedimento relacionado ao CAF.
ccb
Cédula de Crédito Bancário ou etapa contratual
associada.
pagamento Forma, confirmação ou orientação geral de pagamento.
atraso Parcela, contrato ou obrigação em atraso.
renegociacao Pedido de renegociação de obrigação.
cancelamento Pedido ou dúvida sobre cancelamento.
devolucao Devolução de valor recebido.
pix_cpf
Uso do CPF como chave Pix ou problema diretamente
associado.
quitacao Quitação de contrato ou saldo.
chave_pix
Cadastro, portabilidade, localização ou situação de
chave Pix.
quebra_contratual
Descumprimento ou condição contratual que exige
análise.
duplicidade_pagamento Pagamento realizado mais de uma vez.
desconto_folha Desconto em folha de pagamento.
repasse_fgts_digital Repasse ou processamento por FGTS Digital.
reembolso_estorno Reembolso, estorno ou reversão de valor.
otp Código temporário não recebido, inválido ou vencido.
senha_transacao
Criação, alteração, bloqueio ou erro da senha de
transação.
extrato Consulta ou divergência de extrato.
limite_pix Consulta ou alteração do limite Pix.
pix_destinatario_errado Pix enviado para destinatário incorreto.
saldo_bloqueado Saldo indisponível ou bloqueado.
fechamento_conta Encerramento da conta Velotax/Celcoin.
indicacao_recompensa
Código, elegibilidade, acompanhamento ou resgate do
Indique e Ganhe.
cupom_creditos Cupom, crédito promocional ou saldo de benefício.
alteracao_cadastral
Correção de nome, e-mail, telefone, data de nascimento
ou outro dado cadastral.
erro_tecnico Erro técnico no aplicativo ou em algum fluxo digital.
produto_nao_oferecido Solicitação de produto que não é oferecido pela Velotax.
renegociacao_cobranca_externa
Negociação que deve ser tratada pela Central de
Pagamentos ou parceiro externo.
apostas_bets Dúvida relacionada a apostas ou bets.
malha_fina Dúvida relacionada à malha fina.
retificadora Dúvida relacionada à declaração retificadora.
seguros
Dúvida geral ou demanda de seguro sem subtipo mais
específico.
status_contrato Consulta da situação de um contrato.
suporte_app
Ajuda para acesso, instalação, navegação ou
funcionamento do aplicativo.
liberacao_credito
Crédito contratado, aprovado ou em andamento que
ainda não foi liberado.
baixa_pagamento
Pagamento realizado que ainda não teve baixa
reconhecida.
cancelamento_seguro Cancelamento de seguro.
cobertura_seguro
Consulta de cobertura, condições ou abrangência de
seguro.
regularizacao_negativacao
Regularização de SPC, Serasa ou outra negativação
após pagamento.
sinistro_seguro Abertura, orientação ou acompanhamento de sinistro.
acompanhamento_chamado_anterior
Pessoa já possui chamado e procura posição ou
resposta.
retorno_humano
Pessoa aguardava contato humano combinado e
informa que ele não ocorreu.
dados_sensiveis
Solicitação que envolve dado sensível ou informação
protegida.
fora_escopo Tema sem relação com o atendimento da Velotax.
nao_identificado Não foi possível identificar o motivo principal.
Pessoa e validação de identidade
primeiro_nome
Primeiro nome retornado pelo cadastro e usado pela Letícia depois da validação de identidade.
Tipo: string
Exemplo: "Mariana"
Deve ficar ausente ou vazio quando a identidade não foi validada.
cpf_resolvido
CPF efetivamente usado em uma consulta válida durante a ligação.
Tipo: string
Formato: exatamente onze dígitos, sem pontuação.
Exemplo sintético: "12345678900"
Um CPF apenas mencionado, incompleto ou não enviado para consulta não deve ser considerado
resolvido.
nome_informado
Nome informado ou confirmado pela própria pessoa para identificação ou abertura de chamado. Pode
existir mesmo quando o CPF não corresponde a um cliente.
Tipo: string
Exemplo: "Mariana Souza"
cliente_velotax
Resultado conclusivo da busca de cadastro pelo CPF.
Tipo: boolean
true : o CPF consultado foi localizado como cliente Velotax.
false : o CPF era válido, foi consultado e não foi localizado.
Ausente ou null : não houve resultado conclusivo. Não deve ser interpretado como false .
identidade_validada
Indica se a pessoa concluiu a validação por CPF e mês de nascimento quando o acesso a dados
individuais ou outra ação protegida exigiu essa confirmação.
Tipo: boolean
true : identidade validada.
false : validação não concluída ou divergente.
Ausente: a validação pode não ter sido necessária ou não ter sido iniciada.
Este campo deve ser verificado antes de usar qualquer informação individual do cadastro ou dos
contratos.
Resolução e necessidade operacional
duvida_respondida
Indica se a dúvida principal recebeu uma resposta baseada em informação aprovada, sem depender de
uma nova ação operacional.
Tipo: boolean
true : orientação concluída durante a chamada.
false : a demanda não foi resolvida apenas com orientação.
precisa_acesso_sistema
Indica que o caso depende de consulta individual, contrato, status, elegibilidade, análise humana ou
execução de uma ação operacional.
Tipo: boolean
Não significa, isoladamente, que um chamado foi aberto.
motivo_acesso_sistema
Descrição curta do motivo operacional quando precisa_acesso_sistema é true .
Tipo: string
Texto livre e resumido.
Não deve conter CPF, senha, token ou outro segredo de validação.
handoff_urgente
Sinaliza situação que aparenta exigir prioridade humana por risco operacional real, por exemplo conta
invadida, saldo bloqueado, devolução parcial ou cancelamento dentro de prazo crítico.
Tipo: boolean
Não significa que houve transferência em tempo real.
Acompanhamento comum de chamado e portabilidade de chave não são urgentes por si só.
desfecho
Resultado final consolidado do atendimento.
Tipo: string
Valor Significado
faq_resolvida Dúvida resolvida com orientação durante a chamada.
chamado_sac_registrado Chamado de atendimento registrado com sucesso.
canal_cobranca_especializado
Pessoa orientada para a Central de Pagamentos ou canal
especializado.
aguardar_prazo_oficial
Caso ainda está dentro do prazo oficial e a orientação foi
aguardar.
orientacao_seguradora Pessoa orientada para o fluxo ou canal da seguradora.
orientacao_app Resolução ou próximo passo indicado pelo aplicativo.
orientacao_seguranca Orientação de segurança, prevenção ou proteção de conta.
fora_escopo Demanda fora do escopo atendido pela Letícia.
falha_interacao A interação não chegou a um desfecho confiável.
Chamados no Octadesk
chamado_octadesk_registrado
Confirma se uma ferramenta de abertura de chamado retornou sucesso e o registro foi efetivamente
criado ou reconhecido como duplicado da mesma solicitação.
Tipo: boolean
true : existe confirmação positiva do registro.
false : nenhum chamado foi confirmado.
Não se deve inferir sucesso apenas porque a Letícia disse que tentaria abrir ou encaminhar uma
solicitação.
octadesk_ticket_form
Formulário usado no chamado confirmado.
Tipo: string
Valor Significado
credito Formulário de Crédito.
antecipacao_2026 Formulário de Antecipação de IRPF 2026.
solicitacao_atendimento Formulário geral de Solicitação de Atendimento.
string vazia Nenhum formulário de chamado foi confirmado.
ids_tickets_abertos
Identificadores técnicos dos chamados realmente criados durante a ligação, na ordem de criação.
Tipo preferencial: array<string> .
Exemplo: ["8f38b570-37e0-4bb2-a8af-7f23d5ec6401"] .
Por compatibilidade, pode aparecer como string com mais de um ID separado por vírgula. O
consumidor deve normalizar os dois formatos.
Ausente, string vazia ou lista vazia significa que nenhum ID foi confirmado.
numeros_tickets_abertos
Números de acompanhamento dos chamados realmente criados durante a ligação, na mesma ordem de
ids_tickets_abertos .
Tipo preferencial: array<string> .
Exemplo: ["202608051234"] .
Por compatibilidade, pode aparecer como string com números separados por vírgula.
Ausente, string vazia ou lista vazia significa que nenhum número foi confirmado.
whatsapp_retorno_confirmado
Indica que a pessoa confirmou o WhatsApp de contato usado no chamado.
Tipo: boolean
Só deve orientar regras de retorno quando houver chamado ou promessa de registro associada
àquela confirmação.
Pesquisa de satisfação
csat_participou
Indica se a pessoa aceitou participar e respondeu pelo menos uma etapa da pesquisa.
Tipo: boolean
true : houve participação total ou parcial.
false : houve recusa antes do início.
Ausente ou null : a pesquisa não chegou a uma conclusão sobre participação.
csat_nota
Nota informada pela própria pessoa para o atendimento da Letícia.
Tipo: integer
Valores válidos: 1 , 2 , 3 , 4 ou 5 .
Ausente ou null : nenhuma nota válida foi coletada.
Elogios ou críticas sem número não são convertidos automaticamente em nota.
csat_comentario
Resposta textual à pergunta sobre o que poderia melhorar no atendimento.
Tipo: string
O conteúdo é preservado de forma fiel, sem resumo ou reinterpretação.
Ausente, vazio ou null : nenhum comentário foi coletado.
csat_motivo_nao_coletado
Explica por que a pesquisa não foi concluída integralmente. Deve ser analisado em conjunto com
csat_participou , csat_nota e csat_comentario .
Tipo: string
Valores do fluxo atual:
Valor Significado
nota_nao_informada A pesquisa começou, mas não houve nota válida.
comentario_nao_informado
Houve nota ou participação, mas não foi coletado
comentário.
pesquisa_recusada A pessoa recusou participar antes do início.
pesquisa_interrompida
A pesquisa começou, mas a ligação ou interação foi
interrompida.
nova_demanda_antes_da_pesquisa
A pessoa apresentou outra necessidade antes de iniciar a
pesquisa.
nova_demanda_durante_pesquisa
A pessoa apresentou outra necessidade enquanto a
pesquisa estava em andamento.
Valores de compatibilidade que também devem ser aceitos:
Valor Significado
recusou Recusa explícita da pesquisa.
desligou_antes_de_responder
A chamada terminou durante a oferta ou antes de qualquer
resposta.
sem_resposta
A pesquisa foi oferecida, mas não houve resposta
compreensível.
nao_oferecida O fluxo não chegou à oferta da pesquisa.
Quando a coleta foi completa, o campo normalmente fica ausente ou com value: null .
Recados operacionais temporários
recados_operacionais_status
Resultado da consulta de recados temporários aplicáveis à chamada.
Tipo: string
Valor Significado
not_loaded A consulta ainda não foi carregada ou não chegou a ser executada.
available
Um ou mais recados foram encontrados e disponibilizados para a
chamada.
empty A consulta foi concluída e não havia recado aplicável.
invalid_contract
O conteúdo recebido não atendia ao contrato esperado e foi
desconsiderado.
unavailable A consulta não pôde ser concluída por indisponibilidade.
Um status diferente de available não deve ser interpretado como recado ativo.
recados_operacionais_ativos
Snapshot dos recados temporários que estavam efetivamente disponíveis para a Letícia naquela
chamada, depois das regras de publicação e homologação.
Tipo externo: string contendo um array JSON válido.
Sem recados: "[]" .
Para consumir os itens, o sistema deve primeiro interpretar a string como JSON.
A lista representa o estado observado no início da ligação e serve para auditoria posterior da
orientação disponível naquele momento.
Exemplo de value já interpretado como JSON:
Plain text
[
{
"id": "pix-entrada-2026-08-05",
"titulo": "Instabilidade na entrada de Pix",
"areas": ["conta_e_pix"],
"tipo": "instabilidade",
"mensagemCliente": "Identificamos uma instabilidade temporária na entrada de
Pix.",
"orientacaoAtendimento": "Orientar que a regularização está em andamento.",
"politicaChamado": "nao_abrir",
"criterioChamado": null,
"prioridade": "alta",
"updatedAt": "2026-08-05T15:00:00Z"
}
]
Campos de cada recado:
Campo Tipo Descrição
id string Identificador único do recado.
titulo string Nome curto para identificação humana.
areas array<string> Áreas de atendimento afetadas.
tipo string Natureza do recado.
mensagemCliente string
Mensagem aprovada para comunicação ao
cliente.
orientacaoAtendimento string
Orientação temporária aplicável ao
atendimento.
politicaChamado string
Regra temporária para eventual abertura de
chamado.
criterioChamado string | null
Condição adicional quando a política depende
de persistência.
prioridade string Prioridade relativa entre recados aplicáveis.
updatedAt string
Data e hora da última atualização em ISO 8601
UTC.
Opções de areas :
geral
app_cadastro_seguranca
conta_e_pix
emprestimo_pessoal
antecipacao_salario
antecipacao_irpf
credito_trabalhador
pagamentos_cobranca_documentos
seguros
beneficios
atendimento_e_chamados
Opções de tipo :
indisponibilidade
instabilidade
aviso
Opções de politicaChamado :
fluxo_normal
nao_abrir
abrir_se_persistir
abrir_imediatamente
Opções de prioridade :
alta
media
baixa
Resumo da chamada
call_summary
Resumo objetivo em português do atendimento. Pode registrar produto, dúvida, orientação prestada,
necessidade de chamado, validação de identidade, canais e prazo de retorno realmente informados e o
desfecho final.
Tipo: string
Não deve conter CPF, mês de nascimento, senha, token ou outro segredo de validação.
É adequado para leitura humana e pesquisa textual.
Regras de automação devem priorizar os campos estruturados deste dicionário, não a interpretação
do resumo.
Exemplo consolidado
O exemplo abaixo é sintético e contém somente parte dos campos possíveis:
Plain text
{
"data_collected": {
"rota_atendida": {
"value": "emprestimo_pessoal",
"rationale": "A demanda principal foi sobre uma parcela do empréstimo."
},
"produto_identificado": {
"value": "emprestimo_pessoal",
"rationale": "A pessoa confirmou que a dúvida era sobre Empréstimo
Pessoal."
},
"cpf_resolvido": {
"value": "12345678900",
"rationale": null
},
"cliente_velotax": {
"value": true,
"rationale": null
},
"identidade_validada": {
"value": true,
"rationale": "CPF e mês de nascimento foram confirmados."
},
"assunto_principal": {
"value": "baixa_pagamento",
"rationale": "A pessoa informou que pagou e ainda não visualiza a baixa."
},
"chamado_octadesk_registrado": {
"value": true,
"rationale": "O registro do chamado retornou sucesso."
},
"octadesk_ticket_form": {
"value": "credito",
"rationale": null
},
"ids_tickets_abertos": {
"value": ["8f38b570-37e0-4bb2-a8af-7f23d5ec6401"],
"rationale": null
},
"numeros_tickets_abertos": {
"value": ["202608051234"],
"rationale": null
},
"csat_participou": {
"value": true,
"rationale": null
},
"csat_nota": {
"value": 5,
"rationale": null
},
"csat_comentario": {
"value": "O atendimento foi claro.",
"rationale": null
},
"recados_operacionais_status": {
"value": "empty",
"rationale": null
},
"recados_operacionais_ativos": {
"value": "[]",
"rationale": null
},
"desfecho": {
"value": "chamado_sac_registrado",
"rationale": "A demanda exigiu análise e o chamado foi criado."
}
}
}
Recomendações para integrações da Velotax
1. Tratar todos os campos como opcionais.
2. Usar cliente_velotax e identidade_validada separadamente: localizar um cadastro não
significa que a identidade foi validada.
3. Usar chamado_octadesk_registrado como confirmação de abertura e os arrays de IDs e
números para correlação.
4. Não interpretar precisa_acesso_sistema como confirmação de chamado.
5. Avaliar CSAT pelo conjunto dos quatro campos, não somente pela nota.
6. Interpretar recados_operacionais_ativos como JSON antes de consultar seus itens.
7. Priorizar enums e booleanos para automações; usar call_summary e rationale para apoio
humano e auditoria.
8. Aceitar campos e opções adicionais no futuro sem falhar o processamento da chamada inteira.