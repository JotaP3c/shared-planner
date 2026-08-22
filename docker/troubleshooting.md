# Troubleshooting

- `docker` não reconhecido: instale Docker Desktop, habilite WSL 2/Linux containers, abra-o e teste `docker version`.
- Contexto de build não encontrado: confirme que `shared-planner-backend` e `shared-planner-frontend` são diretórios irmãos do monorepo e revise `BACKEND_BUILD_CONTEXT`/`FRONTEND_BUILD_CONTEXT` no `.env`.
- Divergência de código: execute `scripts/check-repository-sync.ps1`; depois revise o preview de `scripts/sync-repositories.ps1` antes de usar `-Apply`. O script nunca apaga arquivos do destino.
- Porta ocupada: altere `POSTGRES_PORT`, `BACKEND_PORT` ou `FRONTEND_PORT` no `.env`.
- PostgreSQL unhealthy: veja `docker compose logs postgres` e confirme as três variáveis `POSTGRES_*`.
- Backend unhealthy: veja `docker compose logs backend`; causas comuns são credenciais divergentes ou migration Flyway inválida.
- Frontend sem API: confirme `BACKEND_URL=http://backend:8080` e teste `http://localhost:4200/api/health`.
- DBeaver não conecta: use `localhost`, não `postgres`; confira a porta publicada em `docker compose ps`, teste `Test-NetConnection localhost -Port <porta>` e leia a senha em `POSTGRES_PASSWORD` no `.env` local.
- Credenciais PostgreSQL alteradas depois da primeira subida: o volume conserva as antigas. Faça backup; somente se puder perder dados, use `docker compose down -v` e suba novamente.
- Git “dubious ownership”: prefira corrigir o proprietário da pasta para o usuário atual. Como exceção restrita, adicione somente o caminho afetado, por exemplo `git config --global --add safe.directory C:/git/shared-planner`; nunca use curinga global.
