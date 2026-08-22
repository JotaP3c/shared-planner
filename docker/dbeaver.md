# Conectar o DBeaver ao PostgreSQL local

O DBeaver roda no Windows host. Por isso, use a porta publicada pelo Compose e **não** o hostname interno `postgres`.

## Perfil de conexão

```text
Database Type: PostgreSQL
Host: localhost
Port: valor de POSTGRES_PORT no .env (padrão: 5432)
Database: valor de POSTGRES_DB no .env
Username: valor de POSTGRES_USER no .env
Password: valor de POSTGRES_PASSWORD no .env local
Docker Service: postgres
Container Port: 5432
```

## Passo a passo

1. Inicie a stack e confirme que `postgres` está `healthy` com `docker compose ps`.
2. Abra o DBeaver.
3. Selecione **Database > New Database Connection**.
4. Escolha **PostgreSQL** e avance.
5. Em **Host**, informe `localhost`.
6. Em **Port**, informe o valor efetivo de `POSTGRES_PORT` do `.env`.
7. Em **Database**, informe o valor de `POSTGRES_DB`.
8. Em **Username**, informe o valor de `POSTGRES_USER`.
9. Em **Password**, informe localmente o valor de `POSTGRES_PASSWORD`. Não copie essa senha para o Git.
10. Clique em **Test Connection**. Na primeira vez, aceite o download do driver PostgreSQL se o DBeaver solicitar.
11. Com o teste aprovado, clique em **Finish** para salvar.

## Confirmar a porta real

```powershell
cd C:\git\shared-planner
docker compose ps postgres
Test-NetConnection localhost -Port 5432
```

Se `POSTGRES_PORT` não for `5432`, substitua a porta do segundo comando. Depois de conectar, abra um editor SQL no DBeaver e execute:

```sql
SELECT current_database();
SELECT current_user;
SELECT version();
```

O resultado esperado é o banco e o usuário definidos no `.env` e PostgreSQL 17.x.
