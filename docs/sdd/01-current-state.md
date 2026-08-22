# 01 — Current State (AS-IS)

Atualizado em 2026-08-21 após a validação técnica da arquitetura multi-repositório. Todos os gates técnicos desta estabilização passaram; os commits backend e frontend foram criados e verificados. O commit de integração é o commit que contém esta atualização SDD; seu SHA é reportado no handoff, pois não pode ser autorreferenciado neste conteúdo.

## Arquitetura confirmada

- Backend: Java 17, Spring Boot 4.0.6, REST, Security/JWT HS256, JPA/Hibernate e Flyway.
- Banco de runtime: PostgreSQL 17.11 nos perfis de desenvolvimento/container; H2 permanece isolado para testes automatizados.
- Schema: migrations Flyway V1–V7; tabelas `users`, `calendars`, `calendar_members`, `events`, `audit_logs` e `flyway_schema_history`.
- Frontend: Angular 21.2, SSR, lazy routes, FullCalendar 6.1, RxJS 7.8 e TypeScript 5.9.
- Runtime local: Docker Desktop com engine Linux operacional; NX Mode e SVM Mode habilitados.

## Topologia de repositórios

Os três diretórios existem e possuem responsabilidades independentes:

```text
C:\git\shared-planner             Integration / SDD / Context Repository
C:\git\shared-planner-backend     Backend Deployable Source
C:\git\shared-planner-frontend    Frontend Deployable Source
```

O monorepo continua contendo `backend/`, `frontend/`, `docs/` e `docker/`. Os repositórios standalone devem conter os módulos diretamente na raiz, sem uma pasta `backend/` ou `frontend/` intermediária e sem `.git` aninhado.

O Compose do monorepo usa os contextos configuráveis:

```text
${BACKEND_BUILD_CONTEXT:-../shared-planner-backend}
${FRONTEND_BUILD_CONTEXT:-../shared-planner-frontend}
```

Os contextos efetivamente resolvidos e usados nos builds foram:

```text
C:\git\shared-planner-backend
C:\git\shared-planner-frontend
```

A verificação oficial por caminho relativo e SHA-256 terminou com paridade backend `80/80` e frontend `74/74`, após as exclusões normativas — inclusive `.vscode`. Cada standalone possui seu próprio `.git`, sem repositório aninhado. Estrutura, sincronização, builds e execução Docker estão validados; os commits backend/frontend já foram criados e verificados.

## Backend

Módulos: `auth`, `user`, `calendar`, `event`, `finance`, `audit`, `config`, `health`. JWT é obrigatório exceto em `GET /api/health` e `POST /api/auth/login`. Papéis globais: `ADMIN`, `FINANCE`, `USER`; papéis de calendário: `ADMIN`, `FINANCE`, `EDITOR`, `VIEWER`.

## Frontend

Rotas: `/login`, `/calendar`, `/pending`, `/finance`, `/members`, `/admin/users`, `/audit`, `/settings`. Login, shell, busca global, calendário, CRUD/cancelamento de eventos, detalhe, pagamento, aprovação e gestão de membros estão funcionais. Financeiro, usuários, auditoria e configurações ainda possuem lacunas descritas em [17](17-gap-analysis.md).

## PostgreSQL e dados migrados

O banco `shared_planner` está operacional no container PostgreSQL 17.11. Flyway V1–V7 está aplicado. A baseline validada contém:

| Tabela | Linhas |
|---|---:|
| `users` | 6 |
| `calendars` | 4 |
| `calendar_members` | 10 |
| `events` | 11 |
| `audit_logs` | 11 |

As verificações anteriores confirmaram UUIDs equivalentes, nenhuma FK órfã e totais monetários preservados. O SQL Server legado permanece fonte histórica intacta, não banco de runtime.

## Acesso de desenvolvimento

Os seis usuários migrados estão ativos e o login API com a credencial pública do seed de desenvolvimento foi confirmado. Papéis e regras de manuseio seguro estão em [27](27-local-access-and-test-credentials-spec.md). Hashes BCrypt, tokens, segredo JWT e senha real do PostgreSQL não fazem parte desta documentação.

## Testes e validação final

- Backend standalone: Maven `clean test` com 2/2 testes e package sem testes, ambos PASS.
- Frontend standalone: Vitest com 10 arquivos/13 testes e build SSR, ambos PASS.
- Build frontend: três warnings conhecidos de budget SCSS; não bloquearam o build.
- Dependências frontend: `npm audit` ainda reporta 28 vulnerabilidades; nenhuma correção automática foi aplicada nesta estabilização.
- Docker: builds individuais PASS e stack integrada com PostgreSQL, backend e frontend `healthy`.
- HTTP: health direto no backend e pelo proxy frontend retornou 200.
- PostgreSQL: 17.11, Flyway V1–V7, integridade sem FKs órfãs e persistência confirmada após `down`/`up` sem `-v`.
- Acesso: login API 6/6, regressão de API PASS, login e calendário pelo Edge headless PASS.
- DBeaver 26.1.5: conexão PostgreSQL real PASS com driver 42.7.13, comprovada por sessões TCP e `pg_stat_activity`, sem salvar a senha.

O resultado autoritativo e as limitações conhecidas estão em [29](29-infrastructure-validation-report.md). Os SHAs standalone estão registrados no relatório e o SHA da própria entrega de integração é reportado no handoff.
