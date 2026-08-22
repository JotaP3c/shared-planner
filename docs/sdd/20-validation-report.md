# 20 — Functional Validation Report — 2026-08-21

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

## Escopo da validação em andamento

Este documento preserva a evidência funcional. A validação de paridade multi-repositório, contexts standalone do Compose, DBeaver, stack final e commits não está implicitamente aprovada aqui; seu estado honesto está em [29](29-infrastructure-validation-report.md).
