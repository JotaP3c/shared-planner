# 20 — Functional Validation Report — até 2026-08-22

## Baseline

| Área | Resultado inicial | Classificação |
|---|---|---|
| Backend compile/test | PASSED, inicialmente 1/1 | cobertura insuficiente |
| Frontend build | PASSED com 3 warnings de budget SCSS | TECHNICAL_DEBT P4 |
| Frontend tests | FAILED inicialmente, 8/11 | TEST_BUG P2 |
| Lint/E2E | sem scripts/configuração | MISSING_FEATURE P3 |

## Bugs corrigidos

- **BUG-001 — P0:** cancelamento removia fisicamente o evento. Foi substituído por estado persistente `CANCELLED`, auditoria e guarda terminal; integração passou.
- **BUG-002 — P3:** expectativa scaffold obsoleta no frontend; corrigida para o router outlet real.
- **BUG-003 — P2:** specs sem providers de rota/HTTP; TestBed corrigido.
- **BUG-004 — P2:** UI oferecia edição para evento cancelado; ação bloqueada e coberta.

## Validação funcional final da baseline

| Área | Resultado |
|---|---|
| Backend | `mvnw.cmd clean test`: PASSED, 2/2 |
| Frontend tests | PASSED, 13/13 |
| Frontend SSR build | PASSED; 3 warnings de budget SCSS |
| Regressões conhecidas nessa rodada | 0 |

## Complemento PostgreSQL e autenticação

- PostgreSQL 17.11: operacional.
- Flyway V1–V7: aplicado.
- Contagens: users 6, calendars 4, calendar_members 10, events 11, audit_logs 11.
- Integridade: zero FKs órfãs; UUIDs, hashes e valores migrados foram validados sem expor dados sensíveis.
- Login API: confirmado para os seis usuários ativos definidos em [27](27-local-access-and-test-credentials-spec.md).

## Conflitos e bloqueios funcionais não corrigidos

GAP-001/002/003, GAP-005 e GAP-009 continuam dependentes de decisões de produto. A cobertura automatizada ampla de AUTH/USER/CALENDAR/SHARED/FIN/PAY/AUDIT permanece incompleta.

## Incremento de segurança e Finance — 2026-08-22

| Área | Resultado integrado e standalone |
|---|---|
| Backend | `mvnw.cmd clean test`: PASS, 16/16 nos dois repositórios |
| Frontend | `npm.cmd test -- --watch=false`: PASS, 31/31 em 12 arquivos nos dois repositórios |
| Frontend SSR | PASS, 9 rotas prerenderizadas; 4 warnings de budget SCSS |
| S0/S1 | 0/0 abertos no integrado; SEC-FIND-001/002 cobertos por regressão |
| Finance | BR-FIN-001–003 e AC-FIN-001–005 implementados no escopo de receitas |
| Dependências frontend | `npm ci` PASS; audit runtime e completo = 0 |
| Paridade | backend 84/84 e frontend 76/76 |
| Docker/runtime | três serviços `healthy`, bind em loopback, health direto/proxy e matriz HTTP mínima PASS |

Foram validados JWT ausente/adulterado/expirado/issuer incorreto/usuário inativo, BOLA e papéis, ausência de senha/hash, owner, revogação SHARED, redação financeira por contexto resolvido uma vez por request/calendar, precisão e integridade pós-pagamento, resumo Finance, períodos civis, estados de UI e interceptor 401/403/same-origin. A regressão HTTP na stack confirmou health, login, autorização 401/403, resumo financeiro e redação para VIEWER. A rota protegida `/finance` sem sessão retorna o redirecionamento SSR esperado para `/login`. Q-004/Q-005 continuam abertas; não houve uma suíte E2E completa em navegador.

## Escopo da validação em andamento

Este documento preserva a evidência funcional. A validação histórica de contexts standalone do Compose, DBeaver e infraestrutura está detalhada em [29](29-infrastructure-validation-report.md); a evidência atual de segurança está em [31](31-security-audit-report.md).
