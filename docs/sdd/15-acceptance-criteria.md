# 15 — Critérios de aceite

Cada cenário referencia regras de [03](03-business-rules.md).

```gherkin
AC-AUTH-001 [BR-AUTH-001]
Scenario: API protegida sem token
  Given uma requisição sem JWT
  When acessar qualquer endpoint exceto health ou login
  Then responder 401

AC-CAL-001 [BR-CAL-001]
Scenario: Listar somente calendários visíveis
  Given um USER membro de dois calendários
  When listar calendários
  Then retornar exatamente os dois com memberRole e canCreateEvents efetivos

AC-CAL-002 [BR-CAL-003]
Scenario: Proteger o proprietário
  Given um calendar ADMIN
  When tentar remover o membro que é owner
  Then responder 400 e preservar o vínculo

AC-PERM-001 [BR-EVT-002]
Scenario: Viewer não cria evento
  Given um VIEWER autenticado
  When criar qualquer evento no calendário
  Then responder 403

AC-CLIENT-001 [BR-CLIENT-001]
Scenario: Criar atendimento válido
  Given permissão de criação
  When criar CLIENT com cliente, descrição do trabalho, valor e período válido
  Then criar SCHEDULED com pagamento PENDING e recebido zero

AC-CLIENT-002 [BR-CLIENT-001]
Scenario Outline: Rejeitar atendimento incompleto
  Given permissão de criação
  When criar CLIENT sem <campo>
  Then responder 400
  Examples: | campo | clientName | workDescription | amount |

AC-PERSONAL-001 [BR-PERSONAL-001]
Scenario: Criar pessoal válido
  Given permissão de criação
  When criar PERSONAL com personName e período válido
  Then criar evento SCHEDULED

AC-PERSONAL-002 [BR-EVT-004]
Scenario: Não criar evento comum em nome de terceiro
  Given um usuário em calendário de terceiro
  When tentar criar PERSONAL atribuído ao terceiro
  Then rejeitar a operação e orientar o fluxo SHARED
  # TARGET; bloqueado por Q-001/Q-002

AC-EVT-001 [BR-EVT-005]
Scenario: Cancelar preservando histórico
  Given evento existente e usuário autorizado
  When cancelar o evento
  Then manter o registro com status CANCELLED
  And excluí-lo das buscas e dos cálculos financeiros
  And registrar auditoria
  # TARGET; bloqueado por Q-007

AC-SHARED-001 [BR-SHARED-001]
Scenario: Solicitar compromisso compartilhado
  Given criador autorizado e outro usuário ativo membro do calendário
  When criar SHARED destinado a esse usuário
  Then criar PENDING_APPROVAL e registrar o alvo

AC-SHARED-002 [BR-SHARED-001]
Scenario: Impedir autoaprovação
  When criar SHARED destinado ao próprio criador
  Then responder 400

AC-SHARED-003 [BR-SHARED-002]
Scenario: Aprovar como alvo
  Given SHARED PENDING_APPROVAL destinado ao usuário autenticado
  When aprovar
  Then mudar para APPROVED, preencher approvedBy e auditar

AC-SHARED-004 [BR-SHARED-002]
Scenario: Impedir resposta por terceiro ou status inválido
  Given usuário não alvo ou evento não pendente
  When aprovar ou rejeitar
  Then responder 403 para ator incorreto ou 400 para status incorreto

AC-FIN-001 [BR-FIN-001]
Scenario: Calcular resumo
  Given CLIENT pagos, parciais, pendentes e cancelados, além de PERSONAL/SHARED
  When resumir um intervalo
  Then somar apenas CLIENT não cancelados e calcular esperado, recebido, pendente e contagens

AC-FIN-002 [BR-FIN-002]
Scenario Outline: Agrupar receita
  When consultar período <periodo>
  Then usar os limites civis definidos na spec
  Examples: | periodo | DAILY | WEEKLY | BIWEEKLY | MONTHLY |

AC-FIN-003 [BR-FIN-003]
Scenario: Negar financeiro a viewer
  Given USER com papel VIEWER
  When consultar resumo financeiro
  Then responder 403

AC-PAY-001 [BR-PAY-001]
Scenario: Registrar pagamento integral
  Given CLIENT de valor 70 e ator autorizado
  When informar PAID, recebido 70 e método
  Then persistir PAID, preencher paidAt se ausente e auditar

AC-PAY-002 [BR-PAY-001]
Scenario Outline: Rejeitar pagamento inconsistente
  When informar <caso>
  Then responder 400
  Examples: | caso | PENDING com recebido positivo | PARTIALLY_PAID com zero ou total | PAID sem método ou valor divergente | REFUNDED com recebido positivo | evento não CLIENT |

AC-PAY-003 [BR-PAY-002]
Scenario: Impedir atualização sem permissão de edição
  Given usuário não autorizado a editar o evento
  When atualizar pagamento
  Then responder 403

AC-AUDIT-001 [BR-AUDIT-001]
Scenario: Auditar mudança
  When uma operação auditável for concluída
  Then criar log com entidade, ação, ator, instante, resumo e snapshots aplicáveis

AC-AUDIT-002 [BR-AUDIT-002]
Scenario: Restringir auditoria
  Given usuário que não é ADMIN global nem ADMIN do calendário
  When consultar logs
  Then responder 403
```
