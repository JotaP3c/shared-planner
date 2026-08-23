# 21 — Development Progress

## Completed

- Baseline integrada atual: backend 16/16, frontend 31/31 em 12 arquivos e build SSR com 9 rotas.
- Cancelamento persistente `CANCELLED` alinhado a BR-EVT-005/AC-EVT-001.
- Gestão de membros frontend e contratos correspondentes.
- PostgreSQL 17.11 como runtime, Flyway V1–V7 e migração 6/4/10/11/11 validada.
- Docker engine operacional; NX Mode e SVM Mode habilitados.
- Três diretórios de repositório criados.
- Login API confirmado para os seis usuários de desenvolvimento ativos.
- Paridade oficial histórica confirmada em 80/80 e 74/74; após o incremento atual, revalidada em backend 84/84 e frontend 76/76.
- Contextos Docker absolutos confirmados em `C:\git\shared-planner-backend` e `C:\git\shared-planner-frontend`.
- Builds/testes standalone, stack integrada, regressão API, Edge headless, persistência e DBeaver concluídos com PASS.
- SEC-FIND-001/002 encerrados e revalidados nos três repositórios: redação financeira por capacidade, sem consulta N+1 por evento, e revogação imediata de alvo SHARED removido.
- Owner preservado como ADMIN em DELETE/PUT/POST; precisão e integridade de pagamento endurecidas.
- JWT sem fallback dev versionado, configuração validada, issuer e usuário ativo verificados.
- Portas Compose em loopback por padrão; interceptor Bearer restrito a `/api` same-origin e sessão diferenciada em 401/403/500.
- Finance implementado com cinco opções de período e oito métricas (três valores e cinco contagens), estados completos, refresh, responsividade, acessibilidade e navegação honesta por capacidade.

## Multi-repository stabilization

| Etapa | Status |
|---|---|
| Repositórios standalone criados | PASS |
| Specs de topologia/sync/acesso | PASS |
| Contextos Compose standalone | PASS |
| Paridade backend/frontend | PASS — 84/84 e 76/76 |
| Builds Docker standalone | PASS |
| Stack, health e regressão | PASS |
| PostgreSQL e persistência | PASS |
| Login API e Edge headless | PASS |
| Conexão DBeaver | PASS |
| Commit backend atual | PASS — `1a9475283e93dafc188ecf903c45ed4f5690a924` |
| Commit frontend atual | PASS — `e18c68fcd22aa3d83e6f5df5bb5a7c291af8b3f1` |
| Commit integração — implementação | PASS — `28289250189302882644a27ea3e91ed8eb15b0fe` |
| Commit integração — documentação/SDD | THIS_DELIVERY — SHA reportado no handoff |
| Push | NO — FORBIDDEN_IN_THIS_EXECUTION |

## Remaining Product Features

- Admin users page e listagem no UserService frontend.
- Audit page.
- Guards/menus por capacidade fora do fluxo Finance.
- Settings e decisões abertas.
- Automação ampla de regras e E2E.

## Blocked

Q-001–Q-006: decisões de autoria, responsável, ADMIN, SHARED, pagamento e retenção. Q-007 foi resolvida tecnicamente pela regra de cancelamento persistente.

## Known Technical Debt

- O build SSR passa com quatro warnings conhecidos de budget SCSS.
- Dependências integradas foram atualizadas de forma deliberada para Angular 21.2.21, sem `npm audit fix`/major; `npm ci` PASS com 505 pacotes e audits runtime/completo retornam 0 vulnerabilidades.

## Next Recommended Step

Implementar a página administrativa de Users como próxima unidade vertical. Em seguida, manter S0/S1 zerados enquanto Audit, os S2/S3 e estados assíncronos restantes são tratados; Q-004/Q-005 continuam exigindo decisão explícita.
