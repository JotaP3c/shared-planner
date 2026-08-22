# 27 — Local Access and Test Credentials Specification

## Objetivo e classificação

Definir autenticação de desenvolvimento, usuários oficiais de seed, acesso PostgreSQL/DBeaver e tratamento de segredos. A senha `admin` abaixo é uma credencial **intencionalmente pública e exclusiva de seed local**, já documentada pelo projeto; não é uma senha de ambiente ou produção.

## Development authentication

Endpoint público:

```text
POST /api/auth/login
```

O backend valida a senha com BCrypt e retorna autenticação JWT. Testes e relatórios registram somente `LOGIN SUCCESS`, `LOGIN FAILED`, `USER NOT FOUND` ou `USER INACTIVE`; nunca registram hash, token ou segredo de assinatura.

## Seed users e resultado de login

Todos os usuários abaixo estão ativos. A senha pública do seed local é `admin`. O login API foi confirmado para cada conta em 2026-08-21.

| Email | Nome/identificação | Papel global | Papel de calendário conhecido | Active | Login API |
|---|---|---|---|---|---|
| `jpcbnnu@gmail.com` | Joao Correa | `ADMIN` | `ADMIN` no calendário compartilhado validado | true | LOGIN SUCCESS |
| `esposa@example.com` | Esposa Teste | `USER` | `VIEWER` | true | LOGIN SUCCESS |
| `editor@example.com` | Editor Teste | `USER` | `EDITOR` | true | LOGIN SUCCESS |
| `finance@example.com` | Finance Teste | `FINANCE` | `FINANCE` no calendário compartilhado validado | true | LOGIN SUCCESS |
| `jotape@gmail.com` | Jotape | `USER` | conforme memberships migrados | true | LOGIN SUCCESS |
| `malu@gmail.com` | Malu | `USER` | conforme memberships migrados | true | LOGIN SUCCESS |

Fontes oficiais: `docs/database/seed-dev-data.sql`, `docs/database/seed-malu-jotape.sql` e `docs/backend-business-rule-tests.md`. Os scripts legados são evidência da estratégia de desenvolvimento; não devem ser reaplicados cegamente ao PostgreSQL migrado.

## Roles and expected access

| Papel | Acesso esperado |
|---|---|
| `ADMIN` global | administrar usuários e calendários, criar eventos e consultar auditoria |
| `USER` + `VIEWER` | consultar calendário/eventos autorizados sem edição administrativa |
| `USER` + `EDITOR` | editar conteúdo permitido no calendário, respeitando regras de autoria/estado |
| `FINANCE` | consultar recursos financeiros permitidos e memberships autorizados |
| `USER` | acesso determinado por memberships de calendário |

O login confirma identidade e papel global; a regressão de endpoints confirma a matriz de autorização. Não se deduz acesso apenas de um token emitido.

## Login validation

Para cada credencial oficial:

1. Enviar email e senha do seed a `POST /api/auth/login`.
2. Verificar status HTTP sem imprimir o corpo sensível.
3. Registrar apenas o resultado categórico.
4. Para ADMIN, validar também recursos de usuários, calendários, eventos e auditoria.
5. Para papéis específicos, validar apenas endpoints permitidos.

Não tentar reverter ou quebrar hashes BCrypt. Uma nova conta de desenvolvimento só pode ser preparada se usuários não existirem ou nenhuma credencial oficial funcionar, sem apagar ou trocar senhas de usuários migrados.

## PostgreSQL access

Perfil local atual, sem segredo:

```text
Database Type: PostgreSQL
Windows Host: localhost
Host Port: 5432 (valor atual de POSTGRES_PORT)
Database: shared_planner (POSTGRES_DB)
Username: shared_planner (POSTGRES_USER)
Password: definida localmente em .env / POSTGRES_PASSWORD
Docker Service: postgres
Container Host: postgres
Container Port: 5432
```

O backend usa `postgres:5432` dentro da rede Docker. DBeaver roda no Windows e deve usar `localhost` com a porta publicada; nunca deve usar `postgres` como host externo.

Antes do DBeaver, validar pelo container:

```powershell
docker compose exec postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT current_database(), current_user;"'
```

Também listar `flyway_schema_history` e todas as tabelas do schema `public` sem exibir dados sensíveis.

## DBeaver access

1. Abrir DBeaver no Windows.
2. Selecionar **Nova conexão de banco de dados**.
3. Selecionar **PostgreSQL**.
4. Informar Host `localhost`.
5. Informar a porta publicada em `.env` (`POSTGRES_PORT`, atualmente `5432`).
6. Informar Database pelo valor `POSTGRES_DB` (`shared_planner`).
7. Informar Username pelo valor `POSTGRES_USER` (`shared_planner`).
8. Informar a senha pelo valor local `POSTGRES_PASSWORD` em `.env`, sem copiá-la para documentação.
9. Clicar em **Test Connection** e instalar o driver PostgreSQL se solicitado.
10. Salvar a conexão somente após o teste aprovado.

Depois de conectar, confirmar o banco/usuário atuais, schema `public`, `flyway_schema_history` V1–V7 e as tabelas funcionais.

Na validação de 2026-08-21, o DBeaver Community 26.1.5 estabeleceu uma conexão PostgreSQL real com o driver 42.7.13. A evidência foi composta por sessões TCP ativas do processo DBeaver e sessões identificadas como DBeaver em `pg_stat_activity`, conectadas ao banco/usuário documentados. A senha foi informada interativamente e não foi salva. Essa evidência comprova a conexão; não se declara que o botão **Test Connection** foi clicado durante a automação.

## Security and secrets handling

- `.env` deve permanecer ignorado pelo Git.
- `.env.example` contém placeholders, nunca valores locais reais.
- Não documentar senha real do PostgreSQL, segredo JWT ou tokens.
- Não imprimir ou copiar `password_hash` para relatórios.
- Não usar credenciais do seed fora do ambiente local descartável.
- Não incluir tokens em comandos persistidos, screenshots ou histórico.
- Alterações de senha de usuário migrado exigem decisão explícita e evidência.

## Estado de validação

- Seis usuários ativos consultados: PASS.
- Login API das seis credenciais oficiais: PASS.
- Conta ADMIN de desenvolvimento: CONFIRMED.
- PostgreSQL/Docker: PASS — PostgreSQL 17.11, Flyway V1–V7 e persistência confirmada.
- Conexão real DBeaver 26.1.5/driver 42.7.13: PASS.
- Login API das seis contas: PASS.
- Login pela UI no Edge headless e carregamento do calendário: PASS.
- Regressão de permissões e recursos principais: PASS.
