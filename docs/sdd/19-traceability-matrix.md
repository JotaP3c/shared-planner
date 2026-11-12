# 19 — Matriz de rastreabilidade

## Complemento de rastreabilidade — 12/11/2026

| Requisito | Implementação | Evidência |
|---|---|---|
| CAL-01..03 / Q-001 | CalendarService/UserService/roles/V9 | CalendarEvolutionIntegrationTests + PG migration test |
| APP-01 | EventApproval/EventService/locks/batch | evolução, aprovações anteriores e frontend/calendar/shell/pending |
| CLI-01 | clientPhone/descrição consolidada | evolução, formulário e máscara BR |
| REC-01 | recurrence package + editor/scope | engine, integração e componentes |
| IMP-01 / complemento real | calendarimport + import-page + operador privado | parser/integração: 31 testes; carga: 365; repetição: 0 novas |
| HOL-01 | holiday package/resource + overlay | HolidayServiceTests: 3 testes e navegador |
| FIN-01 | FinancePage/serviço existente + QuarterFinanceIntegrationTests | prevista: 990/1980/2970 por mês; autorização e consolidação |
| UI-01 | filtros/Escape/badge/wrap/intervalo importado | frontend: 130 testes; browser: 8 cenários e runtime real |

IDs CAL/APP/CLI/REC/IMP/HOL/FIN pertencem ao complemento
project-audit-and-calendar-import, não são renumeração dos IDs históricos.

## Funcional

| Business Rule | Backend/API | DB | Frontend | Acceptance | Test atual/alvo |
|---|---|---|---|---|---|
| BR-AUTH-001 | SecurityConfig; auth/health; issuer/active-user validators | users | AuthService/guard/interceptor | AC-AUTH-001 | integração missing/malformed/expired/wrong issuer/inactive + interceptor 401/403 PASS; E2E amplo a ampliar |
| BR-CAL-001–005 | CalendarService; `/api/calendars` | calendars, members | CalendarPage; MembersPage | AC-CAL-001–003, AC-PERM-001 | regressão API, carregamento e proteção de owner |
| BR-EVT-001–004 | EventService; `/api/events` | events | CalendarPage | AC-PERM-001, AC-PERSONAL-002 | manual → unit/integration/E2E |
| BR-EVT-005 | EventService.cancel; `DELETE /api/events/{id}` | events | ação cancelar | AC-EVT-001 | integração + componente |
| BR-CLIENT-001 | EventService.create | events | modal/detalhe | AC-CLIENT-001/002 | leitura/regressão API PASS; automação mutável a ampliar |
| BR-PERSONAL-001 | EventService.create | events | modal/detalhe | AC-PERSONAL-001 | leitura/regressão API PASS; automação mutável a ampliar |
| BR-SHARED-001–004 | approvalUser/ensureApprovalTarget; approve/reject/pending | event user FKs + membership | CalendarPage/PendingPage | AC-SHARED-001–005 | integração de alvo revogado + E2E amplo alvo |
| BR-FIN-001–003 | FinanceService/EventRepository; `EventFinancialAccess` resolvido por request/calendar | events | FinancePage/AppShell | AC-FIN-001–005 | resumo/permissão/contrato, ausência de N+1, períodos/estados/nav PASS |
| BR-PAY-001–003 | validatePayment; payment e update de evento | event payment cols | detalhe CLIENT com capacidade | AC-PAY-001–004 | integração de precisão, snapshots e update pós-pagamento PASS; 2026-11-11 `PaymentUpdateMatrixIntegrationTests` (18): 4 status, inválidos, método, datas, tipo, cancelado, autorização, sem efeito/auditoria em falha — H2 |
| BR-AUDIT-001–002 | AuditService; audit endpoint | audit_logs | Audit TARGET | AC-AUDIT-001/002 | negação 403 PASS; sucesso, filtros, contrato e trilha por operação ainda a ampliar (Q-006) |
| BR-USER-001/002 | UserService; `/api/users` GET/POST/PUT | users | UsersPage + UserService.list (2026-11-11) | BLG-FE-004 | `users-page.spec.ts` (13): estados, busca, 409, 403, autoproteção |
| Tema (R-02) | — | — | ThemeService/index.html/LoginPage/SettingsPage | requirements R-02 | `theme.service.spec.ts`, `login-page.spec.ts`, `settings-page.spec.ts` |
| Consistência (R-03/R-04) | — | — | DataChangeService, CalendarPage, PendingPage, AppShell | requirements R-03/R-04 | regressões de reabertura, sino, resumo e duração |
| Acessibilidade de modais (R-07) | — | — | DialogFocusDirective | BLG-TD-006 | `dialog-focus.directive.spec.ts` |
| NF-01 confirmação de atendimento | `POST /events/{id}/confirm`, `/unschedule`, `GET /confirmation-history` | V8: `events.confirmation_*`, `appointment_confirmation_history` | AppointmentConfirmation, modal de detalhes | incident-corrections RF-03/RF-04 | `AppointmentConfirmationIntegrationTests` (10), `appointment-confirmation.spec.ts` |
| INC-03 membros | `CalendarService.addMember` 404/409 | `calendar_members` (UK) | MembersPage | RF-06 | `CalendarMemberIntegrationTests` (6), `members-page.spec.ts` |
| INC-04 usuários | `UserService.update` (último ADMIN) | `users` | UsersPage | RF-07 | `UserAdministrationIntegrationTests` (5), `users-page.spec.ts` |
| INC-05 financeiro | `/finance/summary`, `/timeline`, `/appointments` | `events` | FinancePage, DonutChart, BarChart | RF-04/RF-05 | `FinanceSummaryIntegrationTests` (4), `finance-page.spec.ts` |
| INC-06 layout | — | — | LayoutPreferencesService, AppShell, CalendarPage | RF-08 | `layout-preferences.service.spec.ts`, shell/calendar specs |
| INC-07 auditoria | `GET /api/audit-logs` | `audit_logs` | AuditPage | RF-09 | `audit-page.spec.ts` |

## Infraestrutura

| Requirement | Specification | Implementation/Evidence | Acceptance | Status |
|---|---|---|---|---|
| INFRA-PG-001–006 | [22](22-postgresql-migration-spec.md), [28](28-postgresql-data-transfer-plan.md) | PostgreSQL 17.11; Flyway V1–V7; 6/4/10/11/11; 0 órfãos; persistência PASS | AC-INFRA-003–005 | PASS |
| INFRA-DOCKER-001–010 | [23](23-containerization-spec.md) | contexts standalone absolutos; builds individuais; três serviços healthy; health direto/proxy 200 | AC-INFRA-001–003; cenário Docker standalone | PASS |
| INFRA-REPO-001–012 | [24](24-repository-split-spec.md), [26](26-multi-repository-sync-spec.md) | três `.git`; paridade atual backend 84/84 e frontend 76/76 após exclusões | cenários backend/frontend sync | PASS |
| INFRA-ACCESS-001–009 | [27](27-local-access-and-test-credentials-spec.md) | login API 6/6; Edge headless; DBeaver 26.1.5/driver 42.7.13 | cenários login/DBeaver | PASS |
| INFRA-GIT-001–005 | [26](26-multi-repository-sync-spec.md) | commits backend/frontend verificados; integração é esta entrega, com SHA no handoff | cenário independent commits | PASS ON THIS DELIVERY |

Ao alterar uma regra, a linha correspondente identifica especificação, implementação, aceite e evidência mínima. Resultados finais pertencem ao relatório 29, não à spec.
