# Shared Planner Backend

API do Shared Planner em Java 17, Spring Boot, PostgreSQL, Flyway e autenticação JWT.

## Desenvolvimento local

```powershell
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
```

O profile `dev` usa variáveis `SPRING_DATASOURCE_*` quando definidas. Não versione credenciais locais.

## Docker

Na raiz deste repositório standalone:

```powershell
docker build -t shared-planner-backend .
```

A execução integrada, incluindo PostgreSQL e frontend, é orquestrada pelo `compose.yaml` do repositório `C:\git\shared-planner`.
