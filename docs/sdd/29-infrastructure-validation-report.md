# 29 — Infrastructure Validation Report

Data: 2026-08-21. Estado: **COMPLETE ON THIS DELIVERY**.

Todos os gates técnicos da estabilização multi-repositório passaram. Os commits standalone existem e foram verificados. O commit de integração é o commit que contém este relatório; seu SHA é reportado no handoff, pois não pode ser autorreferenciado. Nenhum push foi realizado.

## Evidências preservadas da baseline PostgreSQL/container

| Critério | Resultado | Evidência |
|---|---|---|
| SDD PostgreSQL/containers | PASS | specs 22–25 criadas antes da implementação inicial |
| Backend regression | PASS | Maven: 2 testes, 0 falhas |
| Frontend regression | PASS | Vitest: 10 arquivos, 13 testes, 0 falhas |
| Frontend SSR build | PASS | `ng build`, 9 rotas prerenderizadas; apenas warnings de budget preexistentes |
| Compose parse/interpolation inicial | PASS | serviços, rede, volume e variáveis validados na topologia inicial |
| SQL Server SOURCE | PASS/read-only | autenticação e contagens executadas somente com SELECT |
| Builds independentes standalone | PASS | backend e frontend construídos a partir das raízes standalone |
| Flyway em PostgreSQL real | PASS | PostgreSQL 17.11; V1–V7 aplicadas e Hibernate validou o schema |
| Transferência e contagens TARGET | PASS | 6/4/10/11/11; UUIDs e hashes sem diferenças; somas 340.00/110.00; 0 órfãos |
| Smoke test e persistência final | PASS | health direto/proxy, login, regressão e Edge headless; `down`/`up` manteve dados |

## Resultado final de build e runtime

Os três containers terminaram `healthy`: frontend em `http://localhost:4200`, backend em `http://localhost:8080` e PostgreSQL em `localhost:5432`. Health direto e pelo proxy retornaram HTTP 200. Maven concluiu 2/2 testes e package PASS; Vitest concluiu 10 arquivos/13 testes; o build SSR passou com 9 rotas prerenderizadas e três warnings conhecidos de budget SCSS.

O login pelo proxy SSR passou inclusive com email em caixa diferente; o índice `uk_users_email_ci` preservou a unicidade case-insensitive da origem. O Edge headless autenticou, carregou a aplicação e acessou o calendário. A allowlist SSR foi ajustada para `localhost` e `127.0.0.1`, e o frontend reiniciou sem erros recentes. Os JSONs temporários usados na transferência, que continham dados, foram removidos depois da validação. Os builds foram repetidos e aprovados a partir dos standalones.

## Baseline de transferência

| Tabela | PostgreSQL |
|---|---:|
| `users` | 6 |
| `calendars` | 4 |
| `calendar_members` | 10 |
| `events` | 11 |
| `audit_logs` | 11 |

O SQL Server não foi alterado nem removido. A precisão `datetime2(7)` foi convertida para microssegundos conforme detalhado no plano 28.

## Ambiente corrigido

Docker Desktop 4.87.0 foi instalado e o token do usuário possui acesso ao contexto Docker. Os componentes Windows necessários estão habilitados, o bootloader usa `hypervisorlaunchtype Auto` e `nx AlwaysOn`, e o processador reporta DEP/SLAT/SVM.

Historicamente, o evento 44 de 2026-08-21 20:44:28 indicou NX/Execute Disable desabilitado no firmware da PICHAU PCH-B550M-CR V2.0. Depois dessa evidência, o usuário habilitou **NX Mode** e **SVM Mode** no firmware. O Docker Engine Linux está operacional após a alteração. A pendência de firmware está encerrada e a stack multi-repositório foi validada com três serviços `healthy`.

`JAVA_HOME` do usuário foi definido como `C:\Program Files\Java\jdk-17`. A exceção Git do monorepo permanece restrita a `safe.directory=C:/git/shared-planner`; cada standalone deve ser validado com seu próprio status e ownership.

## Autenticação confirmada

Todos os usuários abaixo estão ativos e responderam `LOGIN SUCCESS` em `POST /api/auth/login` com a credencial pública oficial do seed local. Nenhum hash, token ou segredo foi registrado.

| Email | Full name | Papel | Active | Resultado |
|---|---|---|---|---|
| `jpcbnnu@gmail.com` | Joao Correa | ADMIN | true | PASS |
| `esposa@example.com` | Esposa Teste | USER + VIEWER | true | PASS |
| `editor@example.com` | Editor Teste | USER + EDITOR | true | PASS |
| `finance@example.com` | Finance Teste | FINANCE | true | PASS |
| `jotape@gmail.com` | Jotape | USER | true | PASS |
| `malu@gmail.com` | Malu | USER | true | PASS |

## Multi-repository validation — resultado

| Gate | Estado | Evidência |
|---|---|---|
| Estrutura backend standalone | PASS | raiz direta, único `.git`, remote e branch `main` |
| Estrutura frontend standalone | PASS | raiz direta, único `.git`, remote e branch `main` |
| Backend parity | PASS | monorepo 80, standalone 80, zero diferenças |
| Frontend parity | PASS | monorepo 74, standalone 74, zero diferenças após excluir `.vscode` |
| Compose backend context | PASS | `C:\git\shared-planner-backend` |
| Compose frontend context | PASS | `C:\git\shared-planner-frontend` |
| Backend standalone tests/build | PASS | Maven 2/2, package e Docker build |
| Frontend standalone tests/build | PASS | Vitest 13/13, SSR e Docker build |
| Compose rebuild from committed HEADs | PASS | imagens backend/frontend usadas pelos containers igualaram as tags |
| Full stack standalone | PASS | PostgreSQL, backend e frontend healthy |
| Regressão mínima | PASS | calendar/events/tipos/pending/finance/members/audit |
| Login frontend | PASS | Edge headless autenticou e carregou o calendário |
| DBeaver Windows | PASS | conexão real comprovada por TCP e `pg_stat_activity` |
| Commit backend | PASS | `c9d34f37f8fe292c6231ed056cdec1e8d3e3cd18` |
| Commit frontend | PASS | `ca3c01cafad8e3af2adf8938fb6ee3bb40161ed1` |
| Commit integration | THIS_DELIVERY | SHA reportado no handoff; não autorreferenciado |
| Push | NOT_PERFORMED | deve permanecer NO |

## Contextos efetivamente validados

```text
Backend context:
C:\git\shared-planner-backend

Frontend context:
C:\git\shared-planner-frontend
```

A sintaxe foi validada com `docker compose config --quiet`. A configuração bruta não foi impressa; somente os campos de contexto foram projetados do JSON convertido em memória, evitando expor variáveis sensíveis interpoladas. Os builds efetivos usaram os paths acima.

## DBEAVER CONNECTION

```text
Database Type: PostgreSQL
Host: localhost
Port: 5432 (POSTGRES_PORT atual)
Database: shared_planner (POSTGRES_DB)
Username: shared_planner (POSTGRES_USER)
Password: Defined in .env / POSTGRES_PASSWORD
Docker Service: postgres
Container Port: 5432
Client: DBeaver Community 26.1.5
Driver: PostgreSQL JDBC 42.7.13
Connection tested: PASS
```

A aplicação DBeaver estabeleceu uma conexão real: o processo abriu sessões TCP para `127.0.0.1:5432` e o PostgreSQL registrou sessões DBeaver em `pg_stat_activity` para o banco e usuário esperados. A senha foi informada interativamente e não foi salva. Esta evidência não afirma que o botão **Test Connection** foi clicado; ela comprova uma conexão funcional pelo próprio cliente.

## Evidências finais e commits

```text
Repository synchronization check:
Backend 80/80 PASS; Frontend 74/74 PASS; zero missing/extra/changed após exclusões normativas

Rendered backend context:
C:\git\shared-planner-backend

Rendered frontend context:
C:\git\shared-planner-frontend

Standalone backend tests/build:
Maven 2/2 PASS; package PASS; Docker build PASS; digest prefix sha256:285f…

Standalone frontend tests/build:
Vitest 10 files/13 tests PASS; SSR PASS; Docker build PASS; digest prefix sha256:d813…

Compose rebuild from committed HEADs:
Backend container/tag image sha256:414baffe…; Frontend container/tag image sha256:836af4b7…; PASS

Full stack and regression:
Three services healthy; health direct/proxy 200; API regression and Edge headless PASS

DBeaver real connection:
DBeaver 26.1.5 / driver 42.7.13 PASS via TCP sessions and pg_stat_activity

Backend commit SHA:
c9d34f37f8fe292c6231ed056cdec1e8d3e3cd18

Frontend commit SHA:
ca3c01cafad8e3af2adf8938fb6ee3bb40161ed1

Integration commit SHA:
reportado no handoff do commit que contém este relatório
```

Commits verificados:

```text
Backend
Remote: https://github.com/JotaP3c/shared-planner-backend.git
Branch: main
Commit: feat: establish PostgreSQL Docker backend

Frontend
Remote: https://github.com/JotaP3c/shared-planner-frontend.git
Branch: main
Commit: feat: establish standalone Angular Docker frontend

Integration
Remote: https://github.com/JotaP3c/shared-planner.git
Branch: main
Commit: esta entrega de integração/SDD
SHA: reportado no handoff; não pode ser autorreferenciado
```

## Regressão e dívida técnica conhecida

A regressão passou para health/proteção, identidade/papéis, calendários, eventos `CLIENT`, `PERSONAL` e `SHARED`, pendências, busca, financeiro/receita, membros e auditoria, incluindo acessos permitidos e negados. O volume `shared-planner_postgres_data` preservou as contagens 6/4/10/11/11 após `down`/`up` sem `-v`.

Depois dos commits standalone e da sincronização final, `docker compose up --build -d --wait` foi repetido. Backend e frontend foram reconstruídos a partir dos HEADs commitados; as imagens usadas pelos containers igualaram as respectivas tags (`sha256:414baffe…` e `sha256:836af4b7…`), os três serviços ficaram `healthy` e os healthchecks direto/proxy retornaram HTTP 200.

O build SSR mantém três warnings conhecidos de budget SCSS. `npm audit` reporta 28 vulnerabilidades: 3 low, 4 moderate, 20 high e 1 critical. Nenhuma correção automática foi aplicada, pois isso poderia introduzir mudanças incompatíveis sem uma rodada específica de análise e regressão. Esses itens são dívida técnica explícita, não falhas ocultas dos gates executados.

## Estado final atual

| Área | Estado |
|---|---|
| PostgreSQL | SUCCESS |
| Migração de dados | SUCCESS |
| Docker engine / NX / SVM | SUCCESS |
| Application API login | SUCCESS |
| DBeaver | SUCCESS |
| Backend standalone | SUCCESS |
| Frontend standalone | SUCCESS |
| Repository synchronization | SUCCESS |
| Docker stack from standalone contexts | SUCCESS |
| Backend commit | SUCCESS |
| Frontend commit | SUCCESS |
| Integration commit | SUCCESS ON THIS DELIVERY — SHA no handoff |
| Push | NOT_PERFORMED |
| Ready for normal development | YES — todos os gates técnicos passaram |

O SHA do commit de integração que contém este relatório é apresentado no handoff. A documentação não tenta autorreferenciar um SHA que só existe depois de seu próprio commit.
