# Shared Planner em containers

A stack local usa PostgreSQL (`postgres`), Spring Boot (`backend`) e Angular SSR (`frontend`). O `compose.yaml` fica no repositório de integração, mas as imagens das aplicações são construídas pelos repositórios standalone irmãos.

## Pré-requisitos

Os diretórios devem existir lado a lado:

```text
C:\git\shared-planner
C:\git\shared-planner-backend
C:\git\shared-planner-frontend
```

Docker Desktop deve estar ativo em modo Linux containers.

## Início rápido

```powershell
cd C:\git\shared-planner
if (-not (Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}
# Preserve o .env existente e substitua somente placeholders quando necessário.
powershell -ExecutionPolicy Bypass -File .\scripts\check-repository-sync.ps1
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
```

Com os valores padrão, o frontend fica em `http://localhost:4200`, o backend em `http://localhost:8080` e o PostgreSQL é publicado em `localhost:5432`. As portas efetivas sempre vêm do `.env`.

Para parar preservando dados, use `docker compose down`. Não use `docker compose down -v` sem um backup e autorização para apagar o banco local.

## Guias

- [Topologia e sincronização](repositories.md)
- [Docker Compose](compose.md)
- [Backend](backend.md)
- [Frontend](frontend.md)
- [PostgreSQL](postgres.md)
- [DBeaver](dbeaver.md)
- [Solução de problemas](troubleshooting.md)
