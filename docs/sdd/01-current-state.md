# 01 — Current State (AS-IS)

Atualizado em 2026-08-22 após o incremento de segurança e Finance e sua validação multi-repositório. A baseline anterior permanece registrada como evidência histórica; o código atual está sincronizado, testado e commitado localmente nos três repositórios. Nenhum push foi realizado.

## Arquitetura confirmada

- Backend: Java 17, Spring Boot 4.0.6, REST, Security/JWT HS256, JPA/Hibernate e Flyway.
- Banco de runtime: PostgreSQL 17.11 nos perfis de desenvolvimento/container; H2 permanece isolado para testes automatizados.
- Schema: migrations Flyway V1–V7; tabelas `users`, `calendars`, `calendar_members`, `events`, `audit_logs` e `flyway_schema_history`.
- Frontend: Angular 21.2.21, SSR, lazy routes, FullCalendar 6.1, RxJS 7.8 e TypeScript 5.9.
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

A verificação oficial por caminho relativo e SHA-256 terminou com paridade backend `84/84` e frontend `76/76`, após as exclusões normativas — inclusive `.vscode`. Cada standalone possui seu próprio `.git`, sem repositório aninhado. Estrutura, sincronização, builds, testes e execução Docker estão validados; os commits backend/frontend já foram criados e verificados.

## Backend

Módulos: `auth`, `user`, `calendar`, `event`, `finance`, `audit`, `config`, `health`. JWT é obrigatório exceto em `GET /api/health` e `POST /api/auth/login`. Papéis globais: `ADMIN`, `FINANCE`, `USER`; papéis de calendário: `ADMIN`, `FINANCE`, `EDITOR`, `VIEWER`.

## Frontend

Rotas: `/login`, `/calendar`, `/pending`, `/finance`, `/members`, `/admin/users`, `/audit`, `/settings`. Login, shell, busca global, calendário, CRUD/cancelamento de eventos, detalhe, pagamento, aprovação, gestão de membros e resumo financeiro estão funcionais. `/finance` seleciona apenas calendários com capacidade, oferece períodos civis e intervalo customizado, exibe todos os totais/contagens e trata loading, vazio, erro, retry e ausência de acesso. Usuários, auditoria e configurações ainda possuem lacunas descritas em [17](17-gap-analysis.md).

O hardening sincronizado encerrou os dois S1: respostas de evento omitem campos financeiros quando o ator não possui capacidade, e a remoção do alvo SHARED revoga listagem e decisão. Owner não pode ser removido nem rebaixado; snapshots pagos não permitem mudança incompatível de tipo/valor; JWT valida issuer e usuário ativo; segredos de desenvolvimento são externos; o Compose usa loopback por padrão; e o interceptor envia Bearer apenas para `/api` same-origin, encerra sessão em 401 e a preserva em 403/500. Q-004 e Q-005 continuam abertas.

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

- Backend integrado e standalone: Maven `clean test` com 16/16 testes PASS, incluindo JWT, BOLA, redação financeira sem N+1, revogação SHARED, owner, precisão/integridade de pagamento e Finance.
- Frontend integrado e standalone: Vitest com 12 arquivos/31 testes PASS.
- Build frontend nos dois contextos: SSR PASS, 9 rotas prerenderizadas; quatro warnings de budget SCSS não bloquearam o build.
- Paridade final: backend 84/84 e frontend 76/76 arquivos comparáveis.
- Dependências frontend: Angular/runtime/SSR/build/CLI/compiler-cli em 21.2.21; `npm ci` PASS; `npm audit --omit=dev` e audit completo retornam 0 vulnerabilidades. A atualização foi deliberada, sem `npm audit fix` e sem major.
- Docker: builds individuais PASS e stack com PostgreSQL, backend e frontend `healthy`, todos publicados apenas em `127.0.0.1` por padrão.
- HTTP: frontend, health direto e health pelo proxy retornaram 200; endpoint protegido sem token retornou 401; regressão autenticada validou ADMIN e negações VIEWER, inclusive redação financeira.
- PostgreSQL: 17.11, Flyway V1–V7, integridade sem FKs órfãs e persistência confirmada após `down`/`up` sem `-v`.
- Acesso: login API 6/6, regressão de API PASS, login e calendário pelo Edge headless PASS.
- DBeaver 26.1.5: conexão PostgreSQL real PASS com driver 42.7.13, comprovada por sessões TCP e `pg_stat_activity`, sem salvar a senha.

O resultado funcional atual está em [20](20-validation-report.md), a auditoria de segurança em [31](31-security-audit-report.md) e os commits desta entrega em [21](21-development-progress.md). O relatório [29 de infraestrutura](29-infrastructure-validation-report.md) preserva a evidência da estabilização anterior; o SHA do commit documental é reportado no handoff porque não pode autorreferenciar-se.
