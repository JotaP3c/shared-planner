# 09 — Financeiro

Objetivo: resumir receita de atendimentos por calendário/período. Acesso CURRENT: global ADMIN; global FINANCE quando membro; calendar ADMIN/FINANCE.

## Cobertura

| Período | Estado | Implementação |
|---|---|---|
| DAILY | IMPLEMENTED | a própria data civil, inclusiva |
| WEEKLY | IMPLEMENTED | segunda a domingo, inclusivo |
| BIWEEKLY | IMPLEMENTED | dias 1–15 ou 16–último dia, inclusivo |
| MONTHLY | IMPLEMENTED | primeiro ao último dia do mês, inclusivo |
| `startDate/endDate` | IMPLEMENTED | resumo inclusivo por datas |

`GET /api/events/client-revenue` retorna valor esperado total e quantidade. `GET /api/finance/summary` retorna esperado, recebido, pendente e contagens por status. Ambos filtram `CLIENT`, excluem `CANCELLED` e usam `startsAt`; `pendingAmount = expected-received`.

## Incremento implementado — página Finance

A primeira unidade funcional após os gates P0/S1 foi implementada como página de resumo de receitas. Seu contrato é:

- selecionar somente calendários para os quais o ator possui BR-FIN-003;
- oferecer `DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY` e intervalo `CUSTOM` inclusivo;
- calcular presets no cliente como datas civis e consultar `GET /api/finance/summary`;
- exibir `expectedAmount`, `receivedAmount`, `pendingAmount`, `appointmentCount`, `paidCount`, `pendingCount`, `partiallyPaidCount` e `refundedCount`;
- distinguir carregamento, ausência de calendário autorizado, resumo vazio, erro e sucesso, com retry;
- manter o backend como autoridade: ocultação/filtragem no frontend não substitui 403;
- não anunciar nem implementar despesas, comissões, exportação ou relatórios genéricos sem spec.

O menu anuncia somente “Resumo de receitas”; despesas e relatórios não foram inventados. A navegação é exibida apenas quando `AppShell` confirma a capacidade por `CalendarService.list`, enquanto a rota direta mantém estado de ausência de acesso e o backend permanece autoridade.

Não há regra explícita para eventos REJECTED (só SHARED, portanto não entram), nem timezone configurável. Critérios: AC-FIN-001–005. Evidência backend: `FinanceService`, `EventService.summarizeClientRevenue`, queries e `FinanceSummaryIntegrationTests`. Evidência frontend: `FinancePage`, `FinanceService`, `AppShell` e testes de autorização, períodos, requests, renderização, erro e vazio.
