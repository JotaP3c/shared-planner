# 19 — Matriz de rastreabilidade

## Funcional

| Business Rule | Backend/API | DB | Frontend | Acceptance | Test atual/alvo |
|---|---|---|---|---|---|
| BR-AUTH-001 | SecurityConfig; auth/health | users | AuthService/guard/interceptor | AC-AUTH-001 | login API 6/6 e Edge headless PASS; E2E amplo a ampliar |
| BR-CAL-001–004 | CalendarService; `/api/calendars` | calendars, members | CalendarPage; MembersPage | AC-CAL-001/002, AC-PERM-001 | regressão API e carregamento do calendário PASS |
| BR-EVT-001–004 | EventService; `/api/events` | events | CalendarPage | AC-PERM-001, AC-PERSONAL-002 | manual → unit/integration/E2E |
| BR-EVT-005 | EventService.cancel; `DELETE /api/events/{id}` | events | ação cancelar | AC-EVT-001 | integração + componente |
| BR-CLIENT-001 | EventService.create | events | modal/detalhe | AC-CLIENT-001/002 | leitura/regressão API PASS; automação mutável a ampliar |
| BR-PERSONAL-001 | EventService.create | events | modal/detalhe | AC-PERSONAL-001 | leitura/regressão API PASS; automação mutável a ampliar |
| BR-SHARED-001–003 | approvalUser/ensureApprovalTarget; approve/reject/pending | event user FKs | CalendarPage/PendingPage | AC-SHARED-001–004 | pending/visibilidade na regressão API PASS; E2E amplo alvo |
| BR-FIN-001–003 | FinanceService/EventRepository; finance/client-revenue | events | Finance TARGET | AC-FIN-001–003 | resumo/receita e permissões na regressão API PASS |
| BR-PAY-001–002 | validatePayment; payment endpoint | event payment cols | detalhe CLIENT | AC-PAY-001–003 | manual → parametrizado/E2E |
| BR-AUDIT-001–002 | AuditService; audit endpoint | audit_logs | Audit TARGET | AC-AUDIT-001/002 | consulta e permissões na regressão API PASS |

## Infraestrutura

| Requirement | Specification | Implementation/Evidence | Acceptance | Status |
|---|---|---|---|---|
| INFRA-PG-001–006 | [22](22-postgresql-migration-spec.md), [28](28-postgresql-data-transfer-plan.md) | PostgreSQL 17.11; Flyway V1–V7; 6/4/10/11/11; 0 órfãos; persistência PASS | AC-INFRA-003–005 | PASS |
| INFRA-DOCKER-001–010 | [23](23-containerization-spec.md) | contexts standalone absolutos; builds individuais; três serviços healthy; health direto/proxy 200 | AC-INFRA-001–003; cenário Docker standalone | PASS |
| INFRA-REPO-001–012 | [24](24-repository-split-spec.md), [26](26-multi-repository-sync-spec.md) | três `.git`; backend 80/80; frontend 74/74 após exclusões | cenários backend/frontend sync | PASS |
| INFRA-ACCESS-001–009 | [27](27-local-access-and-test-credentials-spec.md) | login API 6/6; Edge headless; DBeaver 26.1.5/driver 42.7.13 | cenários login/DBeaver | PASS |
| INFRA-GIT-001–005 | [26](26-multi-repository-sync-spec.md) | commits backend/frontend verificados; integração é esta entrega, com SHA no handoff | cenário independent commits | PASS ON THIS DELIVERY |

Ao alterar uma regra, a linha correspondente identifica especificação, implementação, aceite e evidência mínima. Resultados finais pertencem ao relatório 29, não à spec.
