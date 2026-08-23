# PostgreSQL

PostgreSQL 17 é o único banco de runtime. O serviço Compose se chama `postgres`, usa a porta interna `5432` e publica `${POSTGRES_PORT:-5432}` no endereço `${BIND_ADDRESS:-127.0.0.1}` do host. Banco, usuário, senha, bind e porta publicada vêm do `.env`; a senha nunca deve ser copiada para documentação versionada. Produção não deve publicar o banco diretamente.

## Validar pelo container

```powershell
cd C:\git\shared-planner
docker compose exec postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

No `psql`:

```sql
SELECT current_database();
SELECT current_user;
\dt
SELECT installed_rank, version, description, success
FROM flyway_schema_history
ORDER BY installed_rank;
```

O healthcheck usa `pg_isready`; Flyway V1–V7 cria e valida o schema. O volume nomeado `postgres_data` persiste os dados: `docker compose down` preserva o volume, enquanto `docker compose down -v` o apaga definitivamente.

## Acesso pelo Windows

Clientes no Windows, como DBeaver, devem usar `localhost` e a porta `POSTGRES_PORT` do `.env`. O hostname `postgres` só existe dentro da rede privada do Compose. Veja [dbeaver.md](dbeaver.md).

O SQL Server legado permaneceu intacto como fonte somente leitura. O snapshot foi importado atomicamente por `docker/import-sqlserver-snapshot.sql`; o script exige um target vazio, não contém credenciais nem dados exportados e não deve ser reaplicado sobre um banco preenchido.
