# Shared Planner

Shared Planner é uma aplicação de agenda compartilhada com autenticação, calendários multiusuário, eventos pessoais, atendimentos de clientes, aprovação de eventos compartilhados, pagamentos, financeiro e auditoria.

## Stack atual

- Backend: Java 17, Spring Boot 4, Security/JWT, JPA, Flyway e PostgreSQL 17.
- Frontend: Angular 21 com SSR e FullCalendar.
- Infraestrutura local: Docker Compose com PostgreSQL, backend e frontend.
- Especificação: Spec-Driven Development em [`docs/sdd`](docs/sdd/README.md).

## Arquitetura multi-repositório

Este diretório é o repositório de integração, documentação e SDD. Ele mantém cópias de `backend/` e `frontend/` para análise conjunta. Os artefatos implantáveis e os contextos reais do Docker ficam nos repositórios standalone:

```text
C:\git\shared-planner             Integration / SDD / Context
C:\git\shared-planner-backend     Backend deployable source
C:\git\shared-planner-frontend    Frontend deployable source
```

Cada diretório possui seu próprio `.git`. Metadados Git e artefatos gerados nunca são sincronizados.

## Executar localmente com Docker

```powershell
cd C:\git\shared-planner
if (-not (Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}
# Preserve o .env existente e substitua apenas placeholders quando necessário.
powershell -ExecutionPolicy Bypass -File .\scripts\check-repository-sync.ps1
docker compose config --quiet
docker compose up --build -d --wait
```

Com as portas padrão:

- Frontend: `http://localhost:4200`
- Backend/health: `http://localhost:8080/api/health`
- PostgreSQL/DBeaver: `localhost:5432`

As portas efetivas e os contextos podem ser alterados no `.env`. O Compose usa `../shared-planner-backend` e `../shared-planner-frontend` por padrão.

## Sincronização segura

```powershell
# Preview: não altera arquivos.
powershell -ExecutionPolicy Bypass -File .\scripts\sync-repositories.ps1

# Depois de revisar o preview:
powershell -ExecutionPolicy Bypass -File .\scripts\sync-repositories.ps1 -Apply
```

O script copia somente arquivos ausentes/alterados, não apaga arquivos e valida a paridade por SHA-256. Consulte o [fluxo dos repositórios](docker/repositories.md).

## Desenvolvimento e testes

```powershell
cd C:\git\shared-planner-backend
.\mvnw.cmd clean test

cd C:\git\shared-planner-frontend
npm.cmd ci
npm.cmd test -- --watch=false
npm.cmd run build
```

Mais detalhes estão na [documentação Docker](docker/README.md), no guia de [PostgreSQL](docker/postgres.md), em [DBeaver](docker/dbeaver.md) e na [SDD](docs/sdd/README.md).
