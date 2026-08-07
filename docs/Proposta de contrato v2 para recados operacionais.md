Proposta de contrato v2 para recados operacionais
da Velotax
Data da proposta: 5 de agosto de 2026
Status: proposta funcional validada para implementação e homologação entre Velotax e Contact-Tel
1. Objetivo
Este documento propõe a evolução do contrato de consulta de recados operacionais temporários utilizados
durante o atendimento telefônico da LetícIA.
Os recados representam situações transitórias, como:
indisponibilidade ou instabilidade de um produto ou serviço;
orientação temporária diferente do fluxo normal;
alteração provisória na política de abertura de chamado;
informação emergencial que precisa ser comunicada durante um incidente.
Os recados não substituem a base permanente de conhecimento da agente. Um recado fica vigente
enquanto estiver presente na resposta do endpoint e deixa de ser aplicado a novas chamadas quando for
removido.
2. Princípio da proposta: simples para quem publica
Recados emergenciais normalmente são cadastrados sob pressão. O contrato não deve exigir que a pessoa
responsável conheça detalhes técnicos do atendimento nem escolha entre dezenas de operações.
A proposta usa somente onze áreas amplas, correspondentes aos grandes grupos de atendimento. A pessoa
seleciona uma ou mais áreas e descreve, em texto simples, qual situação específica está acontecendo.
A separação de responsabilidades fica assim:
a pessoa informa a área geral afetada;
o sistema encaminha o recado somente para as áreas selecionadas;
dentro da área, a LetícIA relaciona o texto do recado à dúvida do cliente;
áreas não selecionadas não recebem nem interpretam o recado.
Esse desenho preserva isolamento e previsibilidade sem transformar o cadastro de uma mensagem urgente
em um formulário complexo.
3. Limitação da versão atual
A versão atual devolve somente:
Plain text
{
"id": "...",
"titulo": "...",
"mensagem": "...",
"prioridade": "alta"
}
Essa estrutura não informa:
em qual área da agente o recado deve ser usado;
qual parte pode ser falada diretamente ao cliente;
qual parte representa orientação interna de atendimento;
se o recado muda temporariamente a abertura de chamados;
qual condição precisa ser cumprida antes de abrir um chamado.
A versão v2 acrescenta somente os campos necessários para resolver essas ambiguidades, mantendo o
preenchimento operacional curto.
4. Experiência esperada para o operador
4.1 Campos preenchidos pela pessoa
A pessoa responsável pelo recado preenche:
1. título;
2. uma ou mais áreas afetadas;
3. tipo da ocorrência;
4. mensagem que pode ser comunicada ao cliente;
5. orientação de atendimento;
6. política de chamado;
7. critério para abertura, somente quando necessário;
8. prioridade.
4.2 Campos gerados automaticamente
O sistema gera e mantém:
schemaVersion ;
id ;
updatedAt do conjunto;
updatedAt de cada item.
A pessoa não precisa preencher identificadores, timestamps nem informações técnicas.
5. Endpoint e autenticação
O endpoint e o mecanismo de autenticação já existentes podem ser preservados:
Plain text
GET /api/inbound/telephony/recados
X-Inbound-Secret: <segredo compartilhado>
Este documento não contém nem redefine credenciais. A credencial deve permanecer armazenada somente
como segredo de runtime.
O retorno deve usar Content-Type: application/json; charset=utf-8 .
6. Resposta canônica v2
Plain text
{
"schemaVersion": "2.0",
"updatedAt": "2026-08-05T14:30:00Z",
"items": [
{
"id": "recado_123",
"titulo": "Instabilidade no Pix recebido",
"areas": ["conta_e_pix"],
"tipo": "instabilidade",
"mensagemCliente": "Estamos com uma instabilidade temporária na entrada de Pix
nas contas.",
"orientacaoAtendimento": "Use este aviso somente quando o cliente disser que
recebeu um Pix, mas o saldo ainda não foi atualizado.",
"politicaChamado": "nao_abrir",
"criterioChamado": null,
"prioridade": "alta",
"telefonesOrigemLiberados": [],
"updatedAt": "2026-08-05T14:30:00Z"
}
]
}
7. Campos do envelope
Campo Tipo Obrigatório Preenchimento
Valor
esperado
Motivo
schemaVersion string Sim Automático
Exatamente
2.0
Identifica de
forma inequívoca
o contrato
utilizado
updatedAt
string
ISO
8601
Sim Automático
Data e hora
em UTC
Permite rastrear
de forma
inequívoca as
mudanças do
conjunto
items array Sim Automático
Zero ou mais
recados
válidos
Array vazio
representa
ausência de
recado ativo
7.1 schemaVersion
Nesta proposta, o valor deve ser exatamente 2.0 . Uma futura alteração incompatível deve usar outra
versão, evitando que a integração tente interpretar campos com semântica diferente.
7.2 updatedAt do envelope
Deve mudar sempre que:
um recado for criado;
um recado ativo for alterado;
um recado for removido;
a prioridade, área, mensagem ou política mudar.
Mesmo quando items estiver vazio, updatedAt deve informar a última mudança do conjunto.
7.3 items
É sempre obrigatório:
com recados ativos: contém os itens vigentes;
sem recados ativos: deve ser [] ;
null ou campo ausente não são respostas válidas.
8. Campos de cada recado
Campo Tipo Obrigatório Preenchimento Valor esperado
id string Sim Automático
Identificador único e
estável
titulo string Sim Operador
Título administrativo
curto
areas
array
de
strings
Sim Operador
Uma ou mais áreas da
lista documentada
tipo enum Sim Operador
indisponibilidade ,
instabilidade ou
aviso
mensagemCliente string Sim Operador
Informação aprovada
para comunicação
externa
orientacaoAtendimento string Sim Operador
Ação temporária
esperada da LetícIA
politicaChamado enum Sim Operador
Uma das quatro
políticas
documentadas
criterioChamado
string
ou
null
Sim
Operador
condicional
Critério objetivo para
abrir_se_persistir
prioridade enum Sim Operador
alta , media ou
baixa
telefonesOrigemLiberados
array
de
strings
ou
null
Sim Operador
Telefones autorizados
para homologação, ou
vazio para publicação
geral
updatedAt
string
ISO
8601
Sim Automático
Última alteração do
recado
8.1 id
O sistema deve gerar um identificador sem dados pessoais. Ele permanece igual enquanto o mesmo recado
estiver sendo editado.
Se um incidente for encerrado, removido e depois acontecer novamente, recomendamos criar outro id ,
preservando a separação histórica.
8.2 titulo
É usado para identificação administrativa no painel. Deve ser curto e claro, por exemplo:
Instabilidade no Pix recebido ;
Aplicativo indisponível ;
Atraso na baixa de pagamentos .
O título não será usado para decidir onde o recado se aplica. Essa decisão vem de areas .
8.3 areas
É uma seleção simples de um ou mais grandes grupos de atendimento. O operador não precisa escolher
operações ou subtópicos.
O recado será disponibilizado somente nas áreas selecionadas. Se a ocorrência afetar mais de uma área, o
operador pode selecionar todas elas no mesmo item, desde que mensagem, orientação e política sejam
iguais.
Se o tratamento for diferente entre áreas, devem ser criados recados separados.
8.4 tipo
Valor Quando usar Exemplo
indisponibilidade
O produto ou serviço afetado não pode
ser utilizado
Aplicativo fora do ar
instabilidade
O serviço funciona parcialmente, de forma
intermitente, lenta ou com atraso
Alguns Pix recebidos demoram
para aparecer no saldo
aviso
Existe uma orientação temporária sem
falha técnica
Atendimento excepcional por
determinado canal
Quando a situação normalizar, o recado deve ser removido. Não é necessário um tipo normalizado .
8.5 mensagemCliente
Contém apenas o que pode ser comunicado ao cliente. Deve ser:
escrito em português do Brasil com acentuação correta;
natural e adequado para fala;
objetivo;
livre de nomes de sistemas internos, logs e códigos HTTP;
livre de prazos não confirmados;
limitado a quinhentos caracteres.
Não usar comandos como “diga”, “informe” ou “oriente”. Esses comandos pertencem a
orientacaoAtendimento .
Números, siglas, telefones, e-mails e sites devem ser escritos de maneira adequada para leitura em voz.
8.6 orientacaoAtendimento
Descreve como a LetícIA deve aplicar o recado e delimita o caso específico dentro da área ampla.
Exemplo:
Plain text
Use este aviso somente quando o cliente disser que recebeu um Pix, mas o saldo
ainda não foi atualizado. Não aplique a envio de Pix ou cadastro de chave.
Esse texto pode orientar a agente a:
pedir que o cliente aguarde;
pedir uma nova tentativa;
explicar uma mudança temporária;
informar um canal específico;
não abrir chamado para uma ocorrência geral já conhecida;
abrir chamado de acordo com a política selecionada.
Não incluir credenciais, nomes de ferramentas, variáveis internas, JSON ou instruções para ignorar controles
permanentes.
8.7 politicaChamado
Valor Comportamento esperado
fluxo_normal O recado não altera a regra permanente daquele caso
nao_abrir
Não oferecer nem abrir chamado por causa da ocorrência coberta enquanto
o recado estiver ativo
abrir_se_persistir
Executar primeiro o critério informado e abrir somente se o cliente confirmar
que o problema continua
abrir_imediatamente
Permitir seguir diretamente para o fluxo normal de abertura, sem exigir
tentativa anterior
A política não dispensa dados obrigatórios nem permite declarar sucesso sem retorno positivo do sistema
responsável.
8.8 criterioChamado
Deve ser preenchido somente quando politicaChamado for abrir_se_persistir .
Exemplo:
Plain text
Abra chamado somente se o cliente confirmar que atualizou o aplicativo e o
erro continua.
Nos demais casos, deve ser null . Na interface, esse campo pode aparecer somente quando a política
correspondente for selecionada.
8.9 prioridade
Valor Uso esperado
alta
Incidente urgente que deve ser considerado antes da orientação normal quando relacionado
à demanda
media Informação temporária importante, mas sem precedência máxima
baixa Contexto complementar usado apenas quando diretamente relacionado
Prioridade não amplia as áreas selecionadas e não permite ignorar segurança ou regras permanentes.
8.10 updatedAt do item
É gerado automaticamente e deve mudar quando qualquer campo do recado for alterado. Ele permite
ordenar itens e identificar qual versão foi consultada.
8.11 telefonesOrigemLiberados
Permite homologar um recado em ligações reais sem disponibilizá-lo para todos os clientes:
null ou [] : o recado está liberado para qualquer telefone de origem;
lista não vazia: o recado é entregue somente quando o telefone de origem da ligação corresponde a um
dos números informados;
lista não vazia com telefone de origem ausente ou inválido: o recado não é entregue naquela ligação.
Exemplo de recado restrito:
Plain text
"telefonesOrigemLiberados": ["+5511999999999", "+5548999999999"]
Recomendamos que a interface aceite números com ou sem máscara, apresente-os no formato brasileiro e
envie preferencialmente o padrão E.164, com código do país. A comparação aceitará espaços, pontuação e o
prefixo brasileiro, mas o padrão E.164 reduz ambiguidades.
Esse campo controla apenas a exposição do recado. Ele não é autenticação, não autoriza acesso a dados
individuais e nunca pode flexibilizar validação de identidade ou outra regra de segurança.
A lista serve somente para decidir se o recado pode ser usado naquela ligação. Os números de homologação
não devem ser falados ao cliente nem incorporados ao conteúdo do recado.
9. Áreas disponíveis
Código
Nome sugerido na
interface
Abrangência
geral Geral
Ocorrência que realmente afeta toda a
operação da Velotax
app_cadastro_seguranca
App, cadastro e
segurança
Aplicativo, login, senha, OTP, cadastro,
atualização cadastral e validação de
identidade
conta_e_pix Conta e Pix
Conta Velotax, Celcoin, Velobank,
saldo, extrato, ativação, encerramento
e operações Pix
emprestimo_pessoal
Empréstimo
Pessoal
Oferta, contratação, análise, Open
Finance, liberação, contrato, parcelas e
pagamentos do produto
antecipacao_salario
Antecipação de
Salário
Oferta, contratação, Open Finance,
liberação, pagamento e cancelamento
do produto
antecipacao_irpf
Antecipação do
Imposto de Renda
Consulta, contratação, restituição,
liberação, parcelas, quitação e
portabilidade
credito_trabalhador
Crédito do
Trabalhador
Simulação, elegibilidade, margem,
contratação, liberação, parcelas, folha
e boleto
pagamentos_cobranca_documentos
Pagamentos,
cobrança e
documentos
Baixa, boleto, comprovante, cobrança,
renegociação, contrato, CCB e
informes
seguros Seguros
Contratação, disponibilidade e sinistros
de seguros
beneficios Benefícios
Indique e Ganhe, resgates, cupons e
Vibe
atendimento_e_chamados
Atendimento e
chamados
Abertura, acompanhamento e retorno
de atendimento humano
9.1 Uso de geral
geral deve ser usado somente quando o mesmo recado realmente se aplicar a todas as áreas. Para
incidentes transversais parciais, basta selecionar as áreas afetadas.
Exemplo: se app e conta estão indisponíveis, mas produtos de crédito continuam funcionando, selecione
app_cadastro_seguranca e conta_e_pix . Não selecione geral .
10. Vigência e ciclo de vida
A vigência é definida pela presença no endpoint:
item presente: recado ativo para novas consultas;
item removido: recado inativo para novas consultas;
item alterado: versão nova aplicada às consultas seguintes.
Não são necessários active , startsAt ou expiresAt , conforme a decisão de que a Velotax removerá
os recados quando deixarem de ser válidos.
O conjunto consultado para uma ligação permanece estável até o fim daquela chamada. Alterações e
remoções passam a valer nas ligações iniciadas depois da atualização.
11. Múltiplos recados na mesma área
É permitido manter mais de um recado ativo na mesma área, pois eles podem tratar situações diferentes. Por
exemplo, uma instabilidade no Pix recebido e um aviso sobre encerramento de conta podem coexistir em
conta_e_pix .
Para evitar ambiguidade:
orientacaoAtendimento deve indicar claramente quando cada aviso se aplica;
recados contraditórios sobre a mesma situação não devem permanecer ativos ao mesmo tempo;
quando uma orientação substituir outra, a anterior deve ser removida;
prioridade organiza a apresentação, mas não resolve contradição de conteúdo.
Não é necessário criar regras complexas de conflito por subtópico.
12. Ordenação
O endpoint deve ordenar por:
1. prioridade: alta , media , baixa ;
2. updatedAt mais recente primeiro;
3. id crescente como desempate estável.
Essa ordenação deve ser aplicada na própria resposta do endpoint para produzir um resultado estável e fácil
de conferir.
13. Validações e limites
Recomendamos validar o recado antes de torná-lo ativo.
Elemento Limite proposto
Itens ativos 20
Áreas por item 5
id 128 caracteres
titulo 120 caracteres
mensagemCliente 500 caracteres
orientacaoAtendimento 500 caracteres
criterioChamado 500 caracteres
Telefones de homologação por item 20
Telefone de homologação 32 caracteres
Corpo completo 32 KiB em UTF-8
Validações obrigatórias:
rejeitar área desconhecida;
rejeitar enum desconhecido;
rejeitar área duplicada no mesmo item;
exigir ao menos uma área;
exigir criterioChamado em abrir_se_persistir ;
exigir criterioChamado: null nas demais políticas;
exigir telefonesOrigemLiberados como null ou array;
rejeitar telefone de homologação vazio ou impossível de normalizar;
nunca converter uma lista não vazia inválida em publicação geral;
rejeitar campo obrigatório ausente;
rejeitar data fora do formato ISO 8601;
não devolver item parcialmente válido.
14. Semântica HTTP
HTTP Significado
200 Consulta concluída; corpo contém envelope v2 válido, com ou sem itens
401 Credencial ausente ou inválida
503 Integração desabilitada ou temporariamente indisponível
5xx Falha interna ou dependência indisponível
Não retornar 200 com payload de erro. Também não omitir silenciosamente um item inválido e devolver os
demais como se o conjunto estivesse completo.
15. Exemplos completos
15.1 Instabilidade no Pix recebido
Plain text
{
"schemaVersion": "2.0",
"updatedAt": "2026-08-05T14:30:00Z",
"items": [
{
"id": "pix-recebido-2026-08-05",
"titulo": "Instabilidade no Pix recebido",
"areas": ["conta_e_pix"],
"tipo": "instabilidade",
"mensagemCliente": "Estamos com uma instabilidade temporária na entrada de Pix
nas contas.",
"orientacaoAtendimento": "Use este aviso somente quando o cliente disser que
recebeu um Pix, mas o saldo ainda não foi atualizado. Não aplique a envio de Pix ou
cadastro de chave.",
"politicaChamado": "nao_abrir",
"criterioChamado": null,
"prioridade": "alta",
"telefonesOrigemLiberados": [],
"updatedAt": "2026-08-05T14:30:00Z"
}
]
}
15.2 Erro de login com tentativa anterior à abertura
Plain text
{
"schemaVersion": "2.0",
"updatedAt": "2026-08-05T15:10:00Z",
"items": [
{
"id": "app-login-versao-desatualizada",
"titulo": "Falha de login em versão desatualizada",
"areas": ["app_cadastro_seguranca"],
"tipo": "instabilidade",
"mensagemCliente": "Identificamos uma dificuldade temporária de acesso em
algumas versões do aplicativo.",
"orientacaoAtendimento": "Peça que o cliente atualize o aplicativo e tente
acessar novamente.",
"politicaChamado": "abrir_se_persistir",
"criterioChamado": "Abra chamado somente se o cliente confirmar que atualizou o
aplicativo e o erro continua.",
"prioridade": "media",
"telefonesOrigemLiberados": ["+5511999999999"],
"updatedAt": "2026-08-05T15:10:00Z"
}
]
}
15.3 Aviso que afeta mais de uma área
Plain text
{
"schemaVersion": "2.0",
"updatedAt": "2026-08-05T16:00:00Z",
"items": [
{
"id": "manutencao-app-conta-8472",
"titulo": "Manutenção temporária no app e na conta",
"areas": ["app_cadastro_seguranca", "conta_e_pix"],
"tipo": "indisponibilidade",
"mensagemCliente": "O aplicativo e as funções da conta estão temporariamente
indisponíveis.",
"orientacaoAtendimento": "Explique a indisponibilidade e oriente o cliente a
tentar novamente mais tarde.",
"politicaChamado": "nao_abrir",
"criterioChamado": null,
"prioridade": "alta",
"telefonesOrigemLiberados": [],
"updatedAt": "2026-08-05T16:00:00Z"
}
]
}
15.4 Nenhum recado ativo
Plain text
{
"schemaVersion": "2.0",
"updatedAt": "2026-08-05T18:00:00Z",
"items": []
}
16. Como escrever um bom recado
Um bom recado responde:
1. qual área geral está afetada;
2. qual situação específica está acontecendo;
3. o que pode ser falado ao cliente;
4. quando a orientação deve ser aplicada;
5. o que a agente deve orientar;
6. se a política de chamado muda temporariamente.
Boas práticas:
usar título curto;
selecionar apenas as áreas afetadas;
delimitar o caso em orientacaoAtendimento ;
escrever a mensagem externa como fala natural;
usar somente prazos confirmados;
separar recados com políticas diferentes;
remover o item assim que deixar de ser válido.
Para homologar antes da publicação geral:
1. adicione um ou mais números em telefonesOrigemLiberados ;
2. ligue a partir de um número autorizado e valide a fala;
3. confirme que outro número não recebe o recado;
4. depois da aprovação, altere o campo para [] ou null .
17. Como não escrever
Escopo ambíguo
Plain text
O Pix está com problema. Avise o cliente.
Melhor:
Plain text
Mensagem: Estamos com uma instabilidade temporária na entrada de Pix.
Orientação: Use somente quando o cliente disser que recebeu um Pix, mas o saldo
ainda não foi atualizado. Não aplique a envio ou cadastro de chave.
Incidentes com tratamentos diferentes no mesmo item
Plain text
O app está indisponível e alguns pagamentos estão demorando para baixar.
Se impacto, mensagem ou política forem diferentes, use recados separados.
Informação técnica interna
Plain text
O microsserviço de pagamentos está retornando HTTP 500.
Detalhes internos não são apropriados para o cliente.
Prazo não confirmado
Plain text
O sistema voltará em dez minutos.
O prazo só deve ser incluído quando estiver confirmado.
18. Regras que um recado nunca pode sobrescrever
Um recado nunca pode:
dispensar ou falsificar validação de identidade;
liberar dados pessoais, cadastrais, financeiros ou contratuais;
autorizar invenção de dados;
alterar credenciais, endpoints ou parâmetros de integrações;
declarar que um chamado foi aberto sem retorno positivo;
autorizar transações ou ações irreversíveis fora do fluxo existente;
expor raciocínio interno, detalhes técnicos ou segredos;
exigir abertura de chamado sem os dados obrigatórios;
transformar prioridade em exceção de segurança.
19. Garantias funcionais esperadas
O comportamento observável da integração deve atender às seguintes garantias:
1. cada recado é considerado somente nas áreas selecionadas;
2. o texto é aplicado somente quando corresponder à situação relatada pelo cliente;
3. recados de outras áreas não são misturados na resposta;
4. prioridade ordena recados aplicáveis, mas não amplia seu escopo;
5. politicaChamado modifica somente o tratamento temporário da ocorrência descrita;
6. validação de identidade, confirmação de dados e sucesso real da abertura de chamado continuam
obrigatórios;
7. recados restritos são usados somente para telefones autorizados;
8. sem recados aplicáveis, o atendimento segue normalmente, sem inventar indisponibilidade, manutenção
ou aviso;
9. resposta indisponível ou inválida não impede o atendimento normal;
10. credenciais, diagnósticos técnicos e telefones de homologação nunca são comunicados ao cliente.
20. Exemplos validados em simulação
Em 5 de agosto de 2026, a proposta foi exercitada em 21 cenários com recados ativos, cobrindo todas as
áreas, as quatro políticas de chamado, restrição por telefone, múltiplos recados e falhas de contrato. Também
foram executados 33 cenários representativos sem recados ativos. Os exemplos abaixo reproduzem
configurações usadas nessa validação.
20.1 Pix recebido com tentativa obrigatória antes do chamado
Configuração usada:
Plain text
{
"titulo": "Atualização temporária do saldo após Pix recebido",
"areas": ["conta_e_pix"],
"tipo": "instabilidade",
"mensagemCliente": "Alguns recebimentos por Pix podem levar mais tempo para aparecer
no saldo.",
"orientacaoAtendimento": "Use somente quando o cliente disser que recebeu um Pix,
mas o saldo ainda não foi atualizado. Peça para fechar e abrir novamente o aplicativo
antes de avaliar chamado.",
"politicaChamado": "abrir_se_persistir",
"criterioChamado": "Abra chamado somente se o cliente confirmar que fechou e abriu
novamente o aplicativo e o saldo continua sem atualização.",
"prioridade": "alta",
"telefonesOrigemLiberados": []
}
Efeito esperado: comunicar o atraso, orientar a fechar e abrir o aplicativo e não abrir chamado antes da
confirmação de que o problema persistiu.
Efeito observado: a LetícIA comunicou que alguns Pix podem demorar para aparecer, orientou a tentativa e,
quando o cliente perguntou se já poderia abrir chamado, respondeu que a abertura só seria avaliada se o
saldo continuasse sem atualização. Nenhum chamado foi aberto.
20.2 Instabilidade de Empréstimo Pessoal sem abertura de chamado
Configuração usada:
Plain text
{
"titulo": "Instabilidade na liberação do Empréstimo Pessoal",
"areas": ["emprestimo_pessoal"],
"tipo": "instabilidade",
"mensagemCliente": "Estamos com uma instabilidade temporária na liberação de alguns
Empréstimos Pessoais.",
"orientacaoAtendimento": "Use somente quando o cliente disser que concluiu a
contratação do Empréstimo Pessoal, mas o valor ainda não foi creditado. Oriente a
acompanhar a atualização pelo aplicativo.",
"politicaChamado": "nao_abrir",
"criterioChamado": null,
"prioridade": "alta",
"telefonesOrigemLiberados": []
}
Efeito esperado: comunicar a instabilidade, orientar o acompanhamento pelo aplicativo e não abrir chamado
para a ocorrência coberta.
Efeito observado: a LetícIA informou a instabilidade temporária, orientou o acompanhamento pelo aplicativo e
não ofereceu nem abriu chamado.
20.3 Abertura imediata sem eliminar controles de segurança
Configuração usada:
Plain text
{
"titulo": "Instabilidade temporária no acesso ao aplicativo",
"areas": ["app_cadastro_seguranca"],
"tipo": "instabilidade",
"mensagemCliente": "Estamos com uma instabilidade temporária no acesso ao
aplicativo.",
"orientacaoAtendimento": "Use somente quando o cliente não conseguir entrar no
aplicativo por causa da instabilidade informada. Siga diretamente para o fluxo normal
de abertura do chamado.",
"politicaChamado": "abrir_imediatamente",
"criterioChamado": null,
"prioridade": "alta",
"telefonesOrigemLiberados": []
}
Efeito esperado: eliminar tentativas prévias específicas, mas preservar identidade, aceite, confirmação do
WhatsApp e confirmação real do registro.
Efeito observado: a LetícIA comunicou a instabilidade, concluiu a validação de identidade, coletou os dados
necessários, obteve aceite e confirmação do canal de retorno e somente então confirmou o chamado após o
registro bem-sucedido.
20.4 Homologação restrita por telefone
Configuração usada:
Plain text
{
"titulo": "Recado em homologação para conta",
"areas": ["conta_e_pix"],
"tipo": "aviso",
"mensagemCliente": "Este é um recado operacional em homologação controlada.",
"orientacaoAtendimento": "Use somente para validar o recado de homologação sobre a
área da conta.",
"politicaChamado": "fluxo_normal",
"criterioChamado": null,
"prioridade": "baixa",
"telefonesOrigemLiberados": ["+5511999999999", "+5548999999999"]
}
Efeito esperado: comunicar o aviso somente para chamadas originadas de um dos telefones autorizados.
Efeito observado: a chamada originada de +5511999999999 recebeu o aviso. Uma segunda chamada
originada de +5511988887777 seguiu o atendimento normal sem mencionar homologação, lista de telefones
ou conteúdo do recado.
20.5 Lista vazia
Configuração usada:
Plain text
{
"schemaVersion": "2.0",
"updatedAt": "2026-08-05T18:00:00Z",
"items": []
}
Efeito esperado: manter integralmente o atendimento normal e não inventar incidente temporário.
Efeito observado: a LetícIA respondeu às dúvidas normais dos produtos e serviços sem mencionar
instabilidade, indisponibilidade, manutenção ou recado.
21. Sequência recomendada de homologação
1. a Velotax implementa o envelope v2 no endpoint existente;
2. a interface gera automaticamente id e timestamps;
3. a interface oferece seleção das onze áreas;
4. tipo, política e prioridade são apresentados como listas fechadas;
5. criterioChamado aparece somente em abrir_se_persistir ;
6. a interface oferece uma lista opcional de telefones para homologação;
7. a Velotax publica um recado completo restrito a telefones de teste;
8. são realizadas chamadas de números autorizados e não autorizados;
9. após a validação, a lista de telefones é esvaziada para publicação geral;
10. a remoção do item e a resposta com items: [] também são validadas.
22. JSON Schema de referência
Plain text
{
"$schema": "https://json-schema.org/draft/2020-12/schema",
"$id": "https://contact-tel.contactpro.com.br/schemas/velotax-recados-v2.json",
"title": "VelotaxRecadosOperacionaisV2",
"type": "object",
"additionalProperties": false,
"required": ["schemaVersion", "updatedAt", "items"],
"properties": {
"schemaVersion": {"const": "2.0"},
"updatedAt": {"type": "string", "format": "date-time"},
"items": {
"type": "array",
"maxItems": 20,
"items": {"$ref": "#/$defs/recado"}
}
},
"$defs": {
"area": {
"type": "string",
"enum": [
"geral",
"app_cadastro_seguranca",
"conta_e_pix",
"emprestimo_pessoal",
"antecipacao_salario",
"antecipacao_irpf",
"credito_trabalhador",
"pagamentos_cobranca_documentos",
"seguros",
"beneficios",
"atendimento_e_chamados"
]
},
"recado": {
"type": "object",
"additionalProperties": false,
"required": [
"id",
"titulo",
"areas",
"tipo",
"mensagemCliente",
"orientacaoAtendimento",
"politicaChamado",
"criterioChamado",
"prioridade",
"telefonesOrigemLiberados",
"updatedAt"
],
"properties": {
"id": {
"type": "string",
"minLength": 1,
"maxLength": 128,
"pattern": "^[A-Za-z0-9._:-]+$"
},
"titulo": {
"type": "string",
"minLength": 1,
"maxLength": 120
},
"areas": {
"type": "array",
"minItems": 1,
"maxItems": 5,
"uniqueItems": true,
"items": {"$ref": "#/$defs/area"}
},
"tipo": {
"enum": ["indisponibilidade", "instabilidade", "aviso"]
},
"mensagemCliente": {
"type": "string",
"minLength": 1,
"maxLength": 500
},
"orientacaoAtendimento": {
"type": "string",
"minLength": 1,
"maxLength": 500
},
"politicaChamado": {
"enum": ["fluxo_normal", "nao_abrir", "abrir_se_persistir",
"abrir_imediatamente"]
},
"criterioChamado": {
"type": ["string", "null"],
"maxLength": 500
},
"prioridade": {
"enum": ["alta", "media", "baixa"]
},
"telefonesOrigemLiberados": {
"type": ["array", "null"],
"maxItems": 20,
"uniqueItems": true,
"items": {
"type": "string",
"minLength": 8,
"maxLength": 32
}
},
"updatedAt": {
"type": "string",
"format": "date-time"
}
},
"allOf": [
{
"if": {
"properties": {
"politicaChamado": {"const": "abrir_se_persistir"}
}
},
"then": {
"properties": {
"criterioChamado": {"type": "string", "minLength": 1}
}
},
"else": {
"properties": {
"criterioChamado": {"const": null}
}
}
}
]
}
}
}
23. Checklist de homologação
Contrato
O endpoint retorna schemaVersion: "2.0" .
Campos automáticos não precisam ser preenchidos pelo operador.
A interface oferece somente as onze áreas documentadas.
Tipo, política e prioridade são listas simples.
criterioChamado aparece somente quando necessário.
A interface permite restringir um recado a telefones de homologação.
Todos os campos obrigatórios estão presentes.
A remoção de item atualiza o updatedAt do envelope.
Respostas
Com recados ativos, retorna 200 e envelope válido.
Sem recados, retorna 200 com items: [] .
Credencial inválida retorna 401 .
Integração desabilitada retorna 503 .
Erro interno não retorna 200 .
Comportamento funcional
Cada recado chega somente às áreas selecionadas.
Recado com lista não vazia chega somente aos telefones autorizados.
Recado restrito não chega quando a origem está ausente ou não autorizada.
null ou lista vazia libera o recado para todas as origens.
Telefones de homologação não são comunicados ao cliente.
geral é usado apenas para ocorrências realmente globais.
nao_abrir não oferece chamado para a ocorrência coberta.
abrir_se_persistir exige confirmação do critério.
Mais de um recado independente pode coexistir na mesma área.
Remover o item faz o recado deixar de valer em novas ligações.
Falha na consulta não bloqueia o atendimento.
24. Critério para ativação do contrato v2
A ativação do endpoint v2 poderá ocorrer depois que a Velotax confirmar:
1. nomes e tipos dos campos;
2. as onze áreas;
3. os três tipos de ocorrência;
4. as quatro políticas de chamado;
5. publicação de resposta v2 homologável no endpoint existente;
6. existência de pelo menos um recado de teste completo;
7. possibilidade de restringir o recado de teste por telefone de origem;
8. possibilidade de retornar uma lista vazia para validar remoção.