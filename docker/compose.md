# Docker Compose

`C:\git\shared-planner\compose.yaml` é o orquestrador local. Ele cria a rede privada `shared_planner`, o volume PostgreSQL e os serviços `postgres`, `backend` e `frontend`. A ordem saudável é PostgreSQL → backend → frontend, controlada por healthchecks.

## Contextos de build

O Docker não constrói `shared-planner\backend` nem `shared-planner\frontend`. Os defaults são:

```text
BACKEND_BUILD_CONTEXT=../shared-planner-backend
FRONTEND_BUILD_CONTEXT=../shared-planner-frontend
```

Os caminhos são relativos ao diretório do `compose.yaml` e podem ser substituídos no `.env`. Valide a sintaxe sem imprimir segredos e mostre somente os dois contextos:

```powershell
docker compose config --quiet
$cfg = docker compose config --format json | ConvertFrom-Json
[pscustomobject]@{
    BackendBuildContext = $cfg.services.backend.build.context
    FrontendBuildContext = $cfg.services.frontend.build.context
}
Remove-Variable cfg
```

Não imprima o resultado bruto de `docker compose config`: ele contém variáveis sensíveis já interpoladas. Os dois campos selecionados acima devem apontar para os repositórios standalone.

## Operação

```powershell
docker compose build backend frontend
docker compose up --build -d --wait
docker compose ps
docker compose logs -f
docker compose down
```

As portas `POSTGRES_PORT`, `BACKEND_PORT` e `FRONTEND_PORT` também podem ser alteradas no `.env`. `BIND_ADDRESS` usa `127.0.0.1` por padrão para impedir exposição acidental à rede; alterá-lo amplia a superfície e exige revisão de segurança.
