# Backend standalone

O artefato implantável vive em `C:\git\shared-planner-backend`. O Dockerfile multi-stage usa Maven e Java 17; a imagem final contém JRE 17, `curl` para o healthcheck e um usuário sem privilégios.

## Teste e build independentes

```powershell
cd C:\git\shared-planner-backend
.\mvnw.cmd clean test
docker build -t shared-planner-backend .
```

O build não depende do frontend nem do conteúdo interno do monorepo.

## Runtime pelo Compose

O serviço recebe `SPRING_PROFILES_ACTIVE=prod`, datasource PostgreSQL e configuração JWT por variáveis de ambiente. O Flyway aplica V1–V7 antes de o Hibernate validar o schema. O healthcheck chama `GET /api/health` na porta interna `8080`.

```powershell
cd C:\git\shared-planner
docker compose logs -f backend
```

Os fallbacks versionados de `application-dev.properties` são defaults públicos exclusivos do ambiente local. Nunca coloque credenciais reais ou o segredo JWT de qualquer ambiente compartilhado no Dockerfile, no Git ou nesses fallbacks; forneça-os por variáveis de ambiente.
