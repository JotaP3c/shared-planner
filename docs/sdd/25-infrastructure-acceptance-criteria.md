# 25 — Infrastructure Acceptance Criteria

## Containerização e PostgreSQL

```gherkin
AC-INFRA-001 Scenario: Build backend independently
  Given the backend source is at C:\git\shared-planner-backend
  When docker build -t shared-planner-backend . runs from that repository root
  Then the image builds without frontend or monorepo sources

AC-INFRA-002 Scenario: Build frontend independently
  Given the frontend source is at C:\git\shared-planner-frontend
  When docker build -t shared-planner-frontend . runs from that repository root
  Then the image builds without backend or monorepo sources

AC-INFRA-003 Scenario: Start complete stack
  Given Docker is running and .env is configured
  When docker compose up --build runs from C:\git\shared-planner
  Then PostgreSQL becomes healthy
  And backend migrates and connects to PostgreSQL
  And backend becomes healthy
  And frontend becomes healthy and proxies /api to backend

AC-INFRA-004 Scenario: Persist local data
  Given data exists in PostgreSQL
  When docker compose down and up are executed without -v
  Then the data remains in the named volume

AC-INFRA-005 Scenario: Preserve functional behavior
  Given the PostgreSQL stack is running from standalone build contexts
  When auth, calendars, members, events, approvals, payments, finance, search and audit regressions run
  Then behavior matches the specified business rules

AC-INFRA-006 Scenario: Document infrastructure
  Given containerization and repository split are implemented
  When a developer opens docker/ and docs/sdd/
  Then operational, repository, DBeaver, access and acceptance guidance is available
```

## Cenários obrigatórios da arquitetura multi-repositório

```gherkin
Scenario: Backend standalone repository matches monorepo backend
  Given the backend implementation exists in the monorepo
  When repository synchronization is executed
  Then the standalone backend source must contain equivalent tracked source and configuration files
  And generated files must not be copied
  And Git metadata must remain independent
```

```gherkin
Scenario: Frontend standalone repository matches monorepo frontend
  Given the frontend implementation exists in the monorepo
  When repository synchronization is executed
  Then the standalone frontend source must contain equivalent tracked source and configuration files
  And node_modules and generated build outputs must not be copied
  And Git metadata must remain independent
```

```gherkin
Scenario: Docker uses standalone repositories
  Given backend and frontend standalone repositories exist
  When docker compose build is executed from the integration repository
  Then backend must be built from shared-planner-backend
  And frontend must be built from shared-planner-frontend
  And the monorepo backend/frontend copies must not be the Docker build contexts
```

```gherkin
Scenario: Developer can authenticate after PostgreSQL migration
  Given PostgreSQL contains a valid active development user
  And the Docker stack is running
  When the developer submits valid development credentials
  Then POST /api/auth/login must return success
  And the frontend must allow access to the authenticated application
```

```gherkin
Scenario: Developer can connect to PostgreSQL using DBeaver
  Given the PostgreSQL Docker container is healthy
  And the PostgreSQL port is published to the host
  When the developer configures DBeaver using the documented host, port, database and credentials
  Then DBeaver must successfully establish a PostgreSQL connection
```

```gherkin
Scenario: Repositories receive independent commits
  Given backend and frontend have been validated independently
  When Git commits are created
  Then backend changes must be committed only in shared-planner-backend
  And frontend changes must be committed only in shared-planner-frontend
  And integration documentation changes must remain in shared-planner
```

## Definition of Done — Backend

- [x] standalone backend structure correct
- [x] Git remote correct
- [x] Dockerfile present
- [x] Docker build passes
- [x] backend starts
- [x] PostgreSQL connection works
- [x] backend tests pass
- [x] synchronization validated
- [x] commit created

## Definition of Done — Frontend

- [x] standalone frontend structure correct
- [x] Git remote correct
- [x] Dockerfile present
- [x] Docker build passes
- [x] frontend starts
- [x] backend communication works
- [x] frontend build/tests pass
- [x] synchronization validated
- [x] commit created

## Definition of Done — PostgreSQL

- [x] PostgreSQL container operational
- [x] Flyway V1–V7 works
- [x] required tables exist
- [x] migrated users exist
- [x] application API login works
- [x] DBeaver connection works
- [x] data remains after container restart

## Definition of Done — Access

- [x] at least one ADMIN development login confirmed
- [x] role-specific development users identified
- [x] frontend login tested in final standalone stack
- [x] API login tested
- [x] credentials source documented
- [x] no BCrypt hashes exposed in SDD
- [x] final secret scan before commits

## Definition of Done — Monorepo

- [x] monorepo remains available
- [x] SDD updated
- [x] Docker documentation updated and validated
- [x] Compose build from standalone repositories evidenced
- [x] synchronization workflow specified
- [x] monorepo remains usable as integrated context
- [x] integration repository commit included in this delivery

Todas as caixas estão concluídas por esta entrega. Os commits e SHAs backend/frontend foram verificados. O commit de integração é o commit que contém este relatório; seu SHA é reportado no handoff porque não pode ser autorreferenciado. Todos os gates possuem evidência em [29](29-infrastructure-validation-report.md).

Observações não bloqueantes: o build SSR mantém três warnings conhecidos de budget SCSS e `npm audit` reporta 28 vulnerabilidades. Esses itens continuam documentados como dívida técnica; não foram ocultados nem corrigidos automaticamente nesta execução.
