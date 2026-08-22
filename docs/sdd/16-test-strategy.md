# 16 — Estratégia de testes

Fonte principal: `docs/backend-business-rule-tests.md`, comparada ao código e à stack PostgreSQL migrada. Os seeds SQL Server não foram reaplicados ao TARGET; a regressão usa os dados transferidos. Backend possui context load e integração de cancelamento; frontend possui 13 testes de componente/regressão. PostgreSQL real, Flyway V1–V7 e endpoints de leitura foram validados separadamente.

| Área/regra | Existente | Manual | Automação necessária |
|---|---|---|---|
| AUTH/USER | context load + login real por papel | checklist completo | integração MockMvc para 200/401/403/409 e autoproteção |
| Calendário/membros | componente de listagem | checklist | integração de visibilidade, matriz e owner |
| Evento por tipo | cancelamento integrado + regressão GET real | checklist | ampliar unitários de validação + integração CRUD/permissões |
| SHARED | nenhum | checklist | integração alvo/self/member/transições/concurrency |
| Busca | nenhum | checklist | integração visibilidade, cancelados e limites |
| Financeiro | nenhum | valores de seed | repository slice + integração de totais/permissão |
| Pagamento | nenhum | matriz | testes parametrizados de status/valor/método |
| Auditoria | nenhum | checklist | integração por operação e autorização |
| Frontend calendário/pending | specs de componente/regressão | manual implícito | ampliar estados/permissões e E2E |
| Frontend placeholders | criação apenas | nenhum | após implementação |

Pirâmide: unitários para funções de domínio; `@DataJpaTest` para queries; integração API com H2 e fixtures transacionais; componente Angular para estados/erros/permissões; E2E para login→evento→aprovação e CLIENT→pagamento→financeiro. Testes críticos: BR-EVT-004 após decisão, BR-SHARED-002, BR-FIN-001 e BR-PAY-001.

Os testes automatizados usam H2 em `MODE=PostgreSQL` com Flyway desabilitado, portanto não substituem o gate executado em PostgreSQL real. Migrations devem continuar sendo validadas em um banco PostgreSQL limpo e na stack Compose antes de release.
