# 20 — Functional Validation Report — até 2026-08-22

## Validação vigente — 12/11/2026

Relatório completo, matriz e intercorrências em
[project-audit-and-calendar-import/validation-report.md](project-audit-and-calendar-import/validation-report.md).
Monorepo/standalones: backend 120/120 em 18 suítes; frontend 130/130 em 21 arquivos;
builds frontend PASS sem warnings e com 1 rota pré-renderizada; audit de produção: 0;
paridade: backend 130/130 e frontend 115/115. PostgreSQL real isolado V1–V10: PASS;
backup dev restaurado e conferido antes de V9/V10. Importação real: 365; repetição:
0 novas; 5 eventos anteriores preservados; 1 sem título bloqueado. Browser: 8 cenários
sintéticos e login/calendários/gráficos no runtime real.
Após autorização para commits/pushes, a nova regressão passou e os commits foram
separados por rotina. Ver [relatório de publicação](project-audit-and-calendar-import/publication-report.md).
Os resultados abaixo são evidências históricas.

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

## Consolidação + remodelagem — 2026-11-11

Execução real nesta máquina (Windows, Java 17.0.12, Node 22.12.0, npm 10.9.0). Os números
de agosto acima são snapshot histórico.

| Área | Monorepo | Standalone |
|---|---|---|
| Git antes | `main` 4082047 = origin | backend 1a94752 (−1), frontend e18c68f (−2) |
| Git ff | — | `merge --ff-only`: backend 8eed886, frontend 0de9f2b (= origin/main) |
| Paridade antes | — | FAIL: backend 2, frontend 34 diferenças |
| Paridade depois | `check-repository-sync.ps1` | **PASS** backend 86/86, frontend 92/92 |
| Backend `mvnw test` | **PASS 37/37** (19 + 18 BLG-TEST-001) | ver tabela "standalone" abaixo |
| Frontend `ng test --no-watch` | **PASS 86/86 em 15 arquivos** (antes 53/13) | idem |
| Frontend `ng build` (SSR) | **PASS**, 1 rota pré-renderizada, **0** avisos de budget | idem |
| `npm ci` | — | PASS (505 pacotes) no frontend standalone |
| Audit produção | **0** (antes 6: 1 crítico, 3 altos, 2 moderados) | idem |
| Audit completo | 27 (22 moderados, 5 altos), só dev/tooling (antes 38) | idem |

Limitações desta rodada: PostgreSQL real, Docker/Compose e E2E em navegador **não**
executados (Docker ausente do PATH; banco local não pode ser alterado). Não houve inspeção
visual renderizada comparando com `docs/reffs` — a fidelidade visual foi conduzida por
leitura das referências e dos tokens, não por captura de tela. Lint não está configurado.
Os audits "zero" observados dentro do sandbox do onboarding contradiziam a execução externa;
nesta rodada os audits rodaram com acesso ao registro e os números acima são os reais.

## Correção de incidentes — 2026-11-11 (noite)

| Verificação | Resultado real |
|---|---|
| Backend `mvnw.cmd -q -B test` (monorepo) | **PASS 60/60** em 11 suítes (novas: confirmação 10, membros 6, usuários 5; Finance 2→4; segurança ajustada para 409) |
| Frontend `ng test --no-watch` (monorepo) | **PASS 109/109** em 17 arquivos (antes 86/15) |
| Frontend `ng build` (SSR) | **PASS**, 1 rota pré-renderizada, 0 avisos |
| Migration V8 em PostgreSQL | **Não executada** (H2 cria schema por entidades; banco local não alterado) |
| Teste manual em navegador / comparação com `docs/reffs` | **Não executado** pelo agente; roteiro em `incident-corrections/tasks.md` |
| Standalones | Não sincronizados nesta rodada (sem commit/push autorizados); rodar `sync-repositories.ps1` antes de publicar |

Bugs comprovados e corrigidos: select com `[value]` + `@for` (Financeiro e Membros),
POST de membro como upsert, e-mail sem normalização, ausência de proteção explícita do
último ADMIN, corrida de e-mail duplicado (500 → 409).

## Escopo da validação em andamento

Este documento preserva a evidência funcional. A validação histórica de contexts standalone do Compose, DBeaver e infraestrutura está detalhada em [29](29-infrastructure-validation-report.md); a evidência atual de segurança está em [31](31-security-audit-report.md).
