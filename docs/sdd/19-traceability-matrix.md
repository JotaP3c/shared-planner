# 19 — Matriz de rastreabilidade

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
| BR-PAY-001–003 | validatePayment; payment e update de evento | event payment cols | detalhe CLIENT com capacidade | AC-PAY-001–004 | integração de precisão, snapshots e update pós-pagamento PASS |
| BR-AUDIT-001–002 | AuditService; audit endpoint | audit_logs | Audit TARGET | AC-AUDIT-001/002 | negação 403 PASS; sucesso, filtros, contrato e trilha por operação ainda a ampliar |

## Infraestrutura

| Requirement | Specification | Implementation/Evidence | Acceptance | Status |
|---|---|---|---|---|
| INFRA-PG-001–006 | [22](22-postgresql-migration-spec.md), [28](28-postgresql-data-transfer-plan.md) | PostgreSQL 17.11; Flyway V1–V7; 6/4/10/11/11; 0 órfãos; persistência PASS | AC-INFRA-003–005 | PASS |
| INFRA-DOCKER-001–010 | [23](23-containerization-spec.md) | contexts standalone absolutos; builds individuais; três serviços healthy; health direto/proxy 200 | AC-INFRA-001–003; cenário Docker standalone | PASS |
| INFRA-REPO-001–012 | [24](24-repository-split-spec.md), [26](26-multi-repository-sync-spec.md) | três `.git`; paridade atual backend 84/84 e frontend 76/76 após exclusões | cenários backend/frontend sync | PASS |
| INFRA-ACCESS-001–009 | [27](27-local-access-and-test-credentials-spec.md) | login API 6/6; Edge headless; DBeaver 26.1.5/driver 42.7.13 | cenários login/DBeaver | PASS |
| INFRA-GIT-001–005 | [26](26-multi-repository-sync-spec.md) | commits backend/frontend verificados; integração é esta entrega, com SHA no handoff | cenário independent commits | PASS ON THIS DELIVERY |

Ao alterar uma regra, a linha correspondente identifica especificação, implementação, aceite e evidência mínima. Resultados finais pertencem ao relatório 29, não à spec.
