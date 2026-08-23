# 16 — Estratégia de testes

Fonte principal: `docs/backend-business-rule-tests.md`, comparada ao código e à stack PostgreSQL migrada. Os seeds SQL Server não foram reaplicados ao TARGET; a regressão usa os dados transferidos. Em 2026-08-22, integrado e standalones passaram com 16 testes backend e 31 testes frontend em 12 arquivos; o build SSR prerenderizou 9 rotas. PostgreSQL real, Flyway V1–V7, endpoints de leitura e a stack reconstruída a partir dos standalones foram validados separadamente.

| Área/regra | Existente | Manual | Automação necessária |
|---|---|---|---|
| AUTH/USER | JWT ausente/adulterado/expirado/issuer incorreto/inativo; contratos sem senha/hash; interceptor 401/403/500 | login real por papel na baseline | ampliar login inválido, matriz de algoritmos, logout/revogação e rate limit |
| Calendário/membros | BOLA de calendário/membro e owner protegido em update/upsert | checklist restante | ampliar matriz completa, remoção do owner e concorrência |
| Evento por tipo | cancelamento e BOLA integrados; redação financeira backend/frontend | checklist | ampliar CRUD/permissões por tipo e validações de limites |
| SHARED | revogação após remoção cobre fila/approve/reject | checklist | alvo/self/member por estado, transições, concorrência e Q-004 após decisão |
| Busca | nenhum | checklist | integração visibilidade, cancelados e limites |
| Financeiro | resumo/intervalo/autorização backend; períodos, estados e renderização frontend | valores de seed | ampliar PostgreSQL real e eventual E2E CLIENT→Finance |
| Pagamento | precisão e integridade de update comum cobertas | matriz | exercitar `updatePayment` em PENDING/PARTIALLY_PAID/PAID/REFUNDED, rollback, auditoria e concorrência |
| Auditoria | nenhum | checklist | integração por operação e autorização |
| Frontend calendário/pending | specs de componente e redação financeira | manual implícito | corrigir latest-wins/loading/erro parcial e ampliar E2E |
| Frontend features | Finance funcional/testada; Users/Audit/Settings ainda incompletos | nenhum | implementar somente conforme spec; Q-004/Q-005 permanecem abertas |

Pirâmide: unitários para funções de domínio; `@DataJpaTest` para queries; integração API com H2 e fixtures transacionais; componente Angular para estados/erros/permissões; E2E para login→evento→aprovação e CLIENT→pagamento→financeiro. Testes críticos: BR-EVT-004 após decisão, BR-SHARED-002, BR-FIN-001 e BR-PAY-001.

Os testes automatizados usam H2 em `MODE=PostgreSQL` com Flyway desabilitado, portanto não substituem o gate executado em PostgreSQL real. Migrations devem continuar sendo validadas em um banco PostgreSQL limpo e na stack Compose antes de release.
