# Tarefas — correção de incidentes e confirmação de agendamento

Estados: PENDING · IN_PROGRESS · COMPLETED · BLOCKED. Execução de 11/11/2026; publicada em commits separados nos três repositórios (monorepo `3132e50`, backend `1e27685`, frontend `68ed59b`).

| ID | Tarefa | Critério de conclusão verificável | Estado |
|---|---|---|---|
| T01 | Investigação e causas raiz | Causas comprovadas registradas em `design.md` (select/@for, membros, usuários) | COMPLETED |
| T02 | SDD requirements/design/tasks | Três arquivos neste diretório | COMPLETED |
| T03 | INC-03 backend membros | `CalendarMemberIntegrationTests` (6): existente/normalizado, 404, inativo 409, duplicado 409 sem trocar papel, 403, calendário 404 | COMPLETED |
| T04 | INC-03 frontend membros | `[selected]` nas opções; mensagens 404/409/403/400 PT-BR; recarga após 204; specs de papel enviado e erros | COMPLETED |
| T05 | INC-04 backend usuários | `UserAdministrationIntegrationTests` (5): normalização, 409 duplicado, edição, desativação lógica/reativação, autoproteção, último ADMIN, 403 | COMPLETED |
| T06 | INC-04 frontend usuários | Lápis/lixeira/reativar com `aria-label` e `title`, confirmação, mensagem de último ADMIN; specs | COMPLETED |
| T07 | NF-01 modelo e migration | `V8__add_appointment_confirmation.sql` não destrutiva; legado CLIENT → PENDING_CONFIRMATION | COMPLETED (execução da V8 em PostgreSQL real: ver T16) |
| T08 | NF-01 endpoints e regras | `/confirm`, `/unschedule`, `/confirmation-history`; `AppointmentConfirmationIntegrationTests` (10) | COMPLETED |
| T09 | Integração financeira | Desmarcado fora da prevista/pendente, recebido preservado, contagens exclusivas; testes de confirmação + `FinanceSummaryIntegrationTests` (4) | COMPLETED |
| T10 | Remodelagem financeira | KPIs, cards secundários, evolução (barras), donut de pagamento, donut de confirmação, recentes com link; specs | COMPLETED |
| T11 | INC-05a select de período | Select exibe o período real; spec "keeps the visible period select in sync" | COMPLETED |
| T12 | INC-02 modal de detalhes | Seções Agendamento/Financeiro/Confirmação, rodapé com hierarquia, scroll interno; spec do calendário | COMPLETED |
| T13 | INC-06 layout recolhível | `LayoutPreferencesService` persistido; sidebar 76 px com tooltips; painel direito com trilho; `updateSize()` do FullCalendar; specs | COMPLETED |
| T14 | INC-01 login | Nota removida; spec garante ausência | COMPLETED |
| T15 | INC-07 auditoria | Lista real com filtros, escopo por papel, sem snapshots; specs | COMPLETED |
| T16 | Validação em PostgreSQL real e navegador | Aplicar V8 em banco isolado e revisar telas nos três temas | BLOCKED — o agente não pode alterar o banco local nem renderizar o navegador; roteiro manual abaixo |
| T17 | Comparação visual com `docs/reffs` | Captura de tela lado a lado | BLOCKED — mesma limitação de T16 |

## Roteiro manual (T16/T17)

1. Parar o backend, fazer backup do banco local e iniciar com perfil `dev`: Flyway aplica a V8.
   Conferir `select confirmation_status, count(*) from events group by 1;` (CLIENT antigos =
   PENDING_CONFIRMATION).
2. Login nos três temas: a nota "Acesso protegido por autenticação com token" não aparece.
3. Membros: escolher "Editor", adicionar `jpcbnu@gmail.com` sem conta → mensagem orienta o
   cadastro; cadastrar em Usuários; adicionar de novo → 204 e lista atualizada; repetir → 409.
4. Usuários: lápis abre edição; lixeira pede confirmação e desativa; botão reativar volta.
5. Calendário: abrir "joao teste" → Confirmar (pagamento continua Pago/Pendente);
   Desmarcar → Outros sem justificativa bloqueia; Remarcação para outro dia move o evento.
6. Financeiro: "Diário" mostra só o dia; donuts e evolução coerentes; desmarcado sai da prevista.
7. Recolher sidebar e painel direito, navegar e dar F5: estado preservado; calendário ocupa a largura.
8. Auditoria: registros reais, filtros e sem valores antigos/novos.
