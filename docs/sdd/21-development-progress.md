# 21 — Development Progress

## Completed

- Baseline backend 2/2, frontend 13/13 e build SSR.
- Cancelamento persistente `CANCELLED` alinhado a BR-EVT-005/AC-EVT-001.
- Gestão de membros frontend e contratos correspondentes.
- PostgreSQL 17.11 como runtime, Flyway V1–V7 e migração 6/4/10/11/11 validada.
- Docker engine operacional; NX Mode e SVM Mode habilitados.
- Três diretórios de repositório criados.
- Login API confirmado para os seis usuários de desenvolvimento ativos.
- Paridade oficial confirmada: backend 80/80 e frontend 74/74 após exclusões normativas.
- Contextos Docker absolutos confirmados em `C:\git\shared-planner-backend` e `C:\git\shared-planner-frontend`.
- Builds/testes standalone, stack integrada, regressão API, Edge headless, persistência e DBeaver concluídos com PASS.

## Multi-repository stabilization

| Etapa | Status |
|---|---|
| Repositórios standalone criados | PASS |
| Specs de topologia/sync/acesso | PASS |
| Contextos Compose standalone | PASS |
| Paridade backend/frontend | PASS — 80/80 e 74/74 |
| Builds Docker standalone | PASS |
| Stack, health e regressão | PASS |
| PostgreSQL e persistência | PASS |
| Login API e Edge headless | PASS |
| Conexão DBeaver | PASS |
| Commit backend | PASS — `c9d34f37f8fe292c6231ed056cdec1e8d3e3cd18` |
| Commit frontend | PASS — `ca3c01cafad8e3af2adf8938fb6ee3bb40161ed1` |
| Commit integração | THIS_DELIVERY — SHA reportado no handoff |
| Push | NO — FORBIDDEN_IN_THIS_EXECUTION |

## Remaining Product Features

- Finance page.
- Admin users page e listagem no UserService frontend.
- Audit page.
- Guards/menus por capacidade.
- Settings e decisões abertas.
- Automação ampla de regras e E2E.

## Blocked

Q-001–Q-006: decisões de autoria, responsável, ADMIN, SHARED, pagamento e retenção. Q-007 foi resolvida tecnicamente pela regra de cancelamento persistente.

## Known Technical Debt

- O build SSR passa com três warnings conhecidos de budget SCSS.
- `npm audit` reporta 28 vulnerabilidades; a correção automática ficou fora do escopo para evitar mudanças de dependências sem análise de regressão.

## Next Recommended Step

O commit de integração é esta própria entrega e seu SHA é reportado no handoff. Com `git push` mantido como `NO`, retomar a Finance Page como próxima unidade funcional.
