# 09 — Financeiro

Objetivo: resumir receita de atendimentos por calendário/período. Acesso CURRENT: global ADMIN; global FINANCE quando membro; calendar ADMIN/FINANCE.

## Cobertura

| Período | Estado | Implementação |
|---|---|---|
| DAILY | IMPLEMENTED | dia civil `[00:00, próximo dia)` |
| WEEKLY | IMPLEMENTED | segunda a segunda |
| BIWEEKLY | IMPLEMENTED | dias 1–15 ou 16–fim |
| MONTHLY | IMPLEMENTED | primeiro dia ao mês seguinte |
| `startDate/endDate` | IMPLEMENTED | resumo inclusivo por datas |

`GET /api/events/client-revenue` retorna valor esperado total e quantidade. `GET /api/finance/summary` retorna esperado, recebido, pendente e contagens por status. Ambos filtram `CLIENT`, excluem `CANCELLED` e usam `startsAt`; `pendingAmount = expected-received`.

CURRENT não possui UI financeira, despesas ou relatórios apesar dos links. Não há regra explícita para eventos REJECTED (só SHARED, portanto não entram), nem timezone configurável. Critérios: AC-FIN-001–003. Evidência: `FinanceService`, `EventService.summarizeClientRevenue`, queries de `EventRepository`.
