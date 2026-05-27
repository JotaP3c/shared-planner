# Project State - Shared Planner

## General Overview

Main structure:
- `backend`: Java 17 + Spring Boot 4 REST API.
- `frontend`: Angular 21 with SSR and lazy routes.
- `docs`: database seed scripts, Postman collection and project notes.
- `docker`: initial infrastructure setup.

The project is a full stack shared planning system. The backend already has the main business rules for authentication, calendars, members, events, approvals, payments, finance and auditing. The frontend has the authenticated shell, login flow and a functional calendar/event screen. Other product modules still exist mostly as route placeholders.

---

## Backend

The backend is organized by domain:

- `auth`: login, JWT and authenticated user profile.
- `config`: security and centralized authorization rules.
- `user`: global user creation, update and listing.
- `calendar`: shared calendars and per-calendar members.
- `event`: events, approval workflow, payments and client revenue.
- `finance`: financial summary by period.
- `audit`: administrative traceability with before/after snapshots.
- `health`: simple API health check.

**Confirmed technologies:**
- Java 17.
- Spring Boot 4.0.6.
- Spring Security + JWT.
- Spring Data JPA / Hibernate.
- Flyway.
- SQL Server on the `dev` profile.
- H2 configured for tests.

**Database migrations currently present:**
- `V1__create_users_table.sql`
- `V2__create_calendar_event_tables.sql`
- `V3__add_payment_fields_to_events.sql`
- `V4__rename_calendar_member_roles.sql`
- `V5__add_audit_fields.sql`
- `V6__create_audit_logs_table.sql`

**Existing endpoints today:**

```text
GET    /api/health

POST   /api/auth/login
GET    /api/auth/me

GET    /api/users
POST   /api/users
PUT    /api/users/{userId}

GET    /api/calendars
POST   /api/calendars
POST   /api/calendars/{calendarId}/members
GET    /api/calendars/{calendarId}/members
PUT    /api/calendars/{calendarId}/members/{memberId}
DELETE /api/calendars/{calendarId}/members/{memberId}

GET    /api/events
POST   /api/events
GET    /api/events/search
GET    /api/events/pending-approvals
GET    /api/events/{eventId}
PUT    /api/events/{eventId}
DELETE /api/events/{eventId}
PUT    /api/events/{eventId}/payment
POST   /api/events/{eventId}/approve
POST   /api/events/{eventId}/reject
GET    /api/events/client-revenue

GET    /api/finance/summary

GET    /api/audit-logs
```

**Important backend behavior confirmed:**
- `POST /api/auth/login` returns a bearer token.
- `GET /api/auth/me` returns the authenticated user object.
- Global roles are `ADMIN`, `FINANCE` and `USER`.
- Only global `ADMIN` can create/update/list users through `/api/users`.
- Calendar member roles are `ADMIN`, `FINANCE`, `EDITOR` and `VIEWER`.
- `GET /api/calendars` now returns permission metadata for the logged user:
  - `memberRole`
  - `canCreateEvents`
- Global `ADMIN` sees all calendars as calendar admin.
- Non-admin users see only calendars where they are members.
- Calendar owner cannot be removed from the calendar.
- Event types are `CLIENT`, `PERSONAL` and `SHARED`.
- Shared events are created as `PENDING_APPROVAL` and require `approvalRequestedFromEmail`.
- Only the requested approval user can approve/reject a shared event.
- Event status flow includes `SCHEDULED`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED` and `CANCELLED`.
- Payment status includes `PENDING`, `PARTIALLY_PAID`, `PAID` and `REFUNDED`.
- Only `CLIENT` events can receive financial/payment data.
- Finance summary ignores cancelled events and considers only client events.
- Audit logs are registered for relevant changes such as events, payments, approvals and members.

**Database helper scripts:**
- `docs/database/seed-malu-jotape.sql`
  - Recreates users `malu@gmail.com` and `jotape@gmail.com`.
  - Password for both users: `admin`.
  - Creates `Agenda - Malu`, `Agenda - Jotape` and `Agenda Joao/Malu`.
  - Sets personal calendars as owner `ADMIN` plus the other user as `VIEWER`.
  - Sets shared calendar owner `jotape` as `ADMIN` and `malu` as `EDITOR`.
- `docs/database/fix-malu-jotape-calendar-roles.sql`
  - Repairs roles without deleting users, calendars or events.

---

## Frontend

The frontend is Angular 21 with SSR enabled and lazy-loaded routes.

**Main frontend dependencies:**
- Angular 21.2.
- FullCalendar 6.1.
- RxJS 7.8.
- TypeScript 5.9.
- Vitest configured through the Angular tooling.

**Current routes:**

```text
/login
/calendar
/pending
/finance
/members
/admin/users
/audit
/settings
```

**Authentication/frontend session:**
- Login screen calls `POST /api/auth/login`.
- Token is stored in `localStorage` as `sharedPlanner.token`.
- `auth.interceptor.ts` skips public routes:
  - `/api/auth/login`
  - `/api/health`
- Protected API requests receive `Authorization: Bearer <token>`.
- `AuthService` keeps `currentUser` as a signal.
- `AuthService.loadCurrentUser()` is defensive and supports both:
  - current full user object response;
  - older string-only response, as a compatibility fallback.

**AppShell current state:**
- Authenticated layout exists.
- Sidebar navigation exists.
- Admin group and finance group can expand/collapse.
- `/admin/users` link is only shown for global `ADMIN`.
- Topbar global search is connected through `SearchService`.
- Profile menu exists with:
  - current user identity;
  - theme placeholder action;
  - settings link;
  - logout button.

**Calendar page current state:**
- This is the most complete frontend module today.
- Uses FullCalendar.
- Default view is month (`dayGridMonth`).
- Week and day views are available (`timeGridWeek`, `timeGridDay`).
- Calendars are loaded from `GET /api/calendars`.
- Multiple selected calendars are supported.
- Events are loaded per selected calendar and visible date range.
- Event requests are combined with `forkJoin`.
- Search filters events by title, client, person, description, service and creator email.
- Event type filter supports `CLIENT`, `PERSONAL` and `SHARED`.
- Calendar filter supports selected/all calendars.
- There are filter chips and popovers for calendar and event type.
- Visual colors are assigned per calendar.
- The legend currently displays visible calendars, not fixed event categories.
- Creating events respects `calendar.canCreateEvents`.
- Event modal supports:
  - client event fields;
  - personal event fields;
  - shared event approval email;
  - date/start/end;
  - validation before submit.
- Event detail modal supports:
  - type/status badges;
  - date/time;
  - creator;
  - client/person/amount/service fields when present;
  - edit action when allowed;
  - cancel/delete action when allowed;
  - approve/reject buttons when the logged user is the requested approver.
- Pending side panel consumes `GET /api/events/pending-approvals`, so it lists actionable approvals for the logged user.
- Pending read state is persisted locally per user with `sharedPlanner.readPendingIds.<email>`.
- The pending cards open the event detail modal.
- The "Ver todas as pendencias" button is still visual only.

---

## Placeholder Pages

These pages have routes and generated components, but are still not functionally implemented:

- `pending-page`
- `finance-page`
- `members-page`
- `users-page`
- `audit-page`
- `settings-page`

The backend supports most of these modules already, and some frontend API services exist, but the screens themselves still need implementation.

---

## Frontend Services

Current services:

- `AuthService`: login, logout, token handling and authenticated user signal.
- `SearchService`: global topbar search term signal.
- `CalendarService`: list/create calendars and add member.
- `EventService`: create/list/search/find/update/delete events, pending approvals, update payment, approve/reject and client revenue summary.
- `FinanceService`: consume `/api/finance/summary`.
- `AuditService`: consume `/api/audit-logs`.
- `UserService`: create and update users.

Important service gaps:
- `CalendarService` does not yet expose list/update/remove member methods, although the backend already has them.
- `UserService` does not yet expose the backend `GET /api/users`.

---

## Known Issues And Technical Debt

**Frontend product gaps:**
- Finance page still needs the real summary UI.
- Members page still needs calendar member listing, add, update and remove flows.
- Admin users page still needs user list/create/edit UI.
- Audit page still needs filterable log listing.
- Pending page still needs a dedicated approval queue.
- Settings page is still empty.
- Payment update UI is not implemented yet.
- "Ver todas as pendencias" is not wired to a real pending view.

**Calendar-specific gaps:**
- Approval/rejection exists in the event detail modal, but not inline inside the pending card.
- Pending panel uses the dedicated pending endpoint, but the full `/pending` page is still not implemented.
- Edit/delete visibility is better than before, but still should be reviewed against every backend authorization rule.
- Shared event editing can still be confusing because updating a shared event may require a valid approval email and can return backend validation errors.

**Visual/design debt:**
- Calendar visuals are closer to the desired operational layout, but still need polish against the reference images.
- Sidebar, calendar card, pending panel, spacing, typography and event chips should be normalized in one pass.
- Some global FullCalendar/modal styles live in `src/styles.scss`, which works but is harder to maintain than component-local styles.
- `login-page.scss`, `app-shell.scss` and `calendar-page.scss` exceed the Angular component style budget warning threshold.

**Tests/tooling:**
- Frontend build passes.
- Frontend specs are likely stale from the Angular scaffold and need review.
- Backend tests did not run in this environment because `JAVA_HOME` is misconfigured.
- Running Angular build inside the sandbox can fail with `spawn EPERM`; running `npm.cmd run build` outside the sandbox works.

---

## Validation

Frontend build command:

```text
npm.cmd run build
```

Result:
- Passed.
- Output: `frontend/dist/shared-planner-frontend`.
- Prerendered 9 static routes.

Warnings:
- `src/app/features/auth/login-page/login-page.scss` is `7.86 kB` with a `4.00 kB` warning budget.
- `src/app/core/layout/app-shell/app-shell.scss` is `7.77 kB` with a `4.00 kB` warning budget.
- `src/app/features/calendar/calendar-page/calendar-page.scss` is `7.96 kB` with a `4.00 kB` warning budget.

Backend test command:

```text
.\mvnw.cmd test
```

Result:
- Not executed successfully in this environment.
- Reason: `JAVA_HOME` is not defined correctly.

---

## Recommended Next Steps

1. Polish the calendar UI against the two reference screens.
2. Implement the full pending page.
3. Implement members page using backend member CRUD.
4. Implement finance page using `/api/finance/summary`.
5. Implement admin users page using `/api/users`.
6. Implement audit page using `/api/audit-logs`.
7. Review stale frontend specs and add tests for auth, calendar permissions and approval actions.

---------------- PT - BR --------------------------------------

# Estado Do Projeto - Shared Planner

Ultima revisao: `2026-05-26` (`America/Sao_Paulo`).
Branch analisada: `main`.
Estado do Git no momento da analise: limpo antes desta atualizacao de documentacao.

## Visao Geral

Estrutura principal:
- `backend`: API Java 17 + Spring Boot 4.
- `frontend`: Angular 21 com SSR e rotas lazy.
- `docs`: scripts de seed do banco, colecao Postman e notas do projeto.
- `docker`: configuracao inicial de infraestrutura.

O projeto e uma aplicacao full stack de agenda compartilhada. O backend ja possui as principais regras de autenticacao, calendarios, membros, eventos, aprovacoes, pagamentos, financeiro e auditoria. O frontend ja possui login, shell autenticado e tela funcional de calendario/eventos. Os demais modulos do produto ainda estao majoritariamente como placeholders de rota.

---

## Backend

O backend esta organizado por dominio:

- `auth`: login, JWT e perfil do usuario autenticado.
- `config`: seguranca e regras centralizadas de autorizacao.
- `user`: criacao, atualizacao e listagem de usuarios globais.
- `calendar`: calendarios compartilhados e membros por calendario.
- `event`: eventos, fluxo de aprovacao, pagamentos e receita por cliente.
- `finance`: resumo financeiro por periodo.
- `audit`: rastreabilidade administrativa com snapshots antes/depois.
- `health`: health check simples da API.

**Tecnologias confirmadas:**
- Java 17.
- Spring Boot 4.0.6.
- Spring Security + JWT.
- Spring Data JPA / Hibernate.
- Flyway.
- SQL Server no perfil `dev`.
- H2 configurado para testes.

**Migrations presentes:**
- `V1__create_users_table.sql`
- `V2__create_calendar_event_tables.sql`
- `V3__add_payment_fields_to_events.sql`
- `V4__rename_calendar_member_roles.sql`
- `V5__add_audit_fields.sql`
- `V6__create_audit_logs_table.sql`

**Endpoints existentes hoje:**

```text
GET    /api/health

POST   /api/auth/login
GET    /api/auth/me

GET    /api/users
POST   /api/users
PUT    /api/users/{userId}

GET    /api/calendars
POST   /api/calendars
POST   /api/calendars/{calendarId}/members
GET    /api/calendars/{calendarId}/members
PUT    /api/calendars/{calendarId}/members/{memberId}
DELETE /api/calendars/{calendarId}/members/{memberId}

GET    /api/events
POST   /api/events
GET    /api/events/search
GET    /api/events/pending-approvals
GET    /api/events/{eventId}
PUT    /api/events/{eventId}
DELETE /api/events/{eventId}
PUT    /api/events/{eventId}/payment
POST   /api/events/{eventId}/approve
POST   /api/events/{eventId}/reject
GET    /api/events/client-revenue

GET    /api/finance/summary

GET    /api/audit-logs
```

**Comportamentos importantes confirmados:**
- `POST /api/auth/login` retorna token bearer.
- `GET /api/auth/me` retorna o objeto do usuario autenticado.
- Os perfis globais sao `ADMIN`, `FINANCE` e `USER`.
- Apenas `ADMIN` global pode criar, atualizar e listar usuarios em `/api/users`.
- Os papeis de membro do calendario sao `ADMIN`, `FINANCE`, `EDITOR` e `VIEWER`.
- `GET /api/calendars` retorna metadados de permissao do usuario logado:
  - `memberRole`
  - `canCreateEvents`
- `ADMIN` global ve todos os calendarios como admin de calendario.
- Usuarios comuns veem apenas calendarios onde sao membros.
- O dono do calendario nao pode ser removido.
- Os tipos de evento sao `CLIENT`, `PERSONAL` e `SHARED`.
- Eventos compartilhados nascem como `PENDING_APPROVAL` e exigem `approvalRequestedFromEmail`.
- Apenas o usuario solicitado para aprovacao pode aprovar ou reprovar um evento compartilhado.
- Os status de evento incluem `SCHEDULED`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED` e `CANCELLED`.
- Os status de pagamento incluem `PENDING`, `PARTIALLY_PAID`, `PAID` e `REFUNDED`.
- Apenas eventos `CLIENT` podem receber dados financeiros/pagamento.
- O resumo financeiro ignora eventos cancelados e considera apenas eventos de cliente.
- A auditoria registra alteracoes relevantes como eventos, pagamentos, aprovacoes e membros.

**Scripts auxiliares de banco:**
- `docs/database/seed-malu-jotape.sql`
  - Recria os usuarios `malu@gmail.com` e `jotape@gmail.com`.
  - Senha dos dois usuarios: `admin`.
  - Cria `Agenda - Malu`, `Agenda - Jotape` e `Agenda Joao/Malu`.
  - Define calendarios pessoais com dono `ADMIN` e outro usuario `VIEWER`.
  - Define calendario compartilhado com `jotape` como `ADMIN` e `malu` como `EDITOR`.
- `docs/database/fix-malu-jotape-calendar-roles.sql`
  - Corrige papeis sem apagar usuarios, calendarios ou eventos.

---

## Frontend

O frontend esta em Angular 21 com SSR habilitado e rotas lazy.

**Principais dependencias do frontend:**
- Angular 21.2.
- FullCalendar 6.1.
- RxJS 7.8.
- TypeScript 5.9.
- Vitest configurado pela toolchain do Angular.

**Rotas atuais:**

```text
/login
/calendar
/pending
/finance
/members
/admin/users
/audit
/settings
```

**Autenticacao e sessao no frontend:**
- A tela de login chama `POST /api/auth/login`.
- O token e salvo no `localStorage` como `sharedPlanner.token`.
- `auth.interceptor.ts` ignora rotas publicas:
  - `/api/auth/login`
  - `/api/health`
- Requisicoes protegidas recebem `Authorization: Bearer <token>`.
- `AuthService` mantem `currentUser` como signal.
- `AuthService.loadCurrentUser()` e defensivo e aceita:
  - resposta atual com objeto completo de usuario;
  - resposta antiga apenas em string, como fallback de compatibilidade.

**Estado atual do AppShell:**
- Layout autenticado existe.
- Menu lateral existe.
- Grupos administrativo e financeiro abrem/fecham.
- Link `/admin/users` aparece apenas para `ADMIN` global.
- Busca global do topo chama `GET /api/events/search` e abre um dropdown de resultados.
- Menu de perfil existe com:
  - identidade do usuario atual;
  - acao visual de tema;
  - link de configuracoes;
  - botao de logout.

**Estado atual da tela de calendario:**
- E o modulo mais completo do frontend hoje.
- Usa FullCalendar.
- A visualizacao padrao e mensal (`dayGridMonth`).
- Visualizacoes semanal e diaria existem (`timeGridWeek`, `timeGridDay`).
- Calendarios sao carregados por `GET /api/calendars`.
- Selecionar multiplos calendarios e suportado.
- Eventos sao carregados por calendario selecionado e intervalo visivel.
- As chamadas de eventos sao combinadas com `forkJoin`.
- A busca global encontra eventos fora do periodo visivel e, ao clicar em um resultado, navega ate a data e abre o detalhe do evento.
- Filtro por tipo suporta `CLIENT`, `PERSONAL` e `SHARED`.
- Filtro de calendario suporta calendarios selecionados/todos.
- Existem chips de filtro e popovers para calendario e tipo de evento.
- Cores visuais sao atribuidas por calendario.
- A legenda atual mostra os calendarios visiveis, nao categorias fixas de evento.
- Criacao de eventos respeita `calendar.canCreateEvents`.
- O modal de evento suporta:
  - campos de evento de cliente;
  - campos de evento pessoal;
  - e-mail de aprovacao para evento compartilhado;
  - data/inicio/fim;
  - validacao antes do submit.
- O modal de detalhe do evento suporta:
  - badges de tipo/status;
  - data/hora;
  - criador;
  - cliente/pessoa/valor/servico quando existem;
  - editar quando permitido;
  - cancelar/excluir quando permitido;
  - aprovar/reprovar quando o usuario logado e o responsavel pela aprovacao.
- O painel lateral de pendencias lista eventos pendentes ja carregados no periodo/filtro ativo.
- Os cards de pendencia abrem o modal de detalhe do evento.
- O botao "Ver todas as pendencias" ainda e apenas visual.

---

## Paginas Ainda Placeholder

Estas paginas possuem rotas e componentes gerados, mas ainda nao possuem implementacao funcional:

- `pending-page`
- `finance-page`
- `members-page`
- `users-page`
- `audit-page`
- `settings-page`

O backend ja suporta grande parte desses modulos e alguns servicos de API do frontend existem, mas as telas ainda precisam ser implementadas.

---

## Servicos Frontend

Servicos atuais:

- `AuthService`: login, logout, token e signal do usuario autenticado.
- `SearchService`: signal do termo de busca global do topo.
- `CalendarService`: listar/criar calendarios e adicionar membro.
- `EventService`: criar/listar/buscar/editar/excluir eventos, pendencias de aprovacao, atualizar pagamento, aprovar/reprovar e resumo de receita por cliente.
- `FinanceService`: consome `/api/finance/summary`.
- `AuditService`: consome `/api/audit-logs`.
- `UserService`: cria e atualiza usuarios.

Lacunas importantes nos servicos:
- `CalendarService` ainda nao expoe listar/atualizar/remover membros, embora o backend ja tenha esses endpoints.
- `UserService` ainda nao expoe `GET /api/users`.

---

## Pontos De Atencao E Dividas Tecnicas

**Lacunas de produto no frontend:**
- Tela financeira ainda precisa de UI real de resumo.
- Tela de membros ainda precisa listar, adicionar, atualizar e remover membros.
- Tela administrativa de usuarios ainda precisa listar, criar e editar usuarios.
- Tela de auditoria ainda precisa listar logs com filtros.
- Tela de pendencias ainda precisa virar uma fila dedicada de aprovacao.
- Tela de configuracoes ainda esta vazia.
- UI de atualizacao de pagamento ainda nao foi implementada.
- "Ver todas as pendencias" ainda nao navega para uma tela real.

**Lacunas especificas do calendario:**
- Aprovacao/reprovacao existe no modal de detalhe, mas nao inline no card de pendencia.
- O painel de pendencias usa o endpoint dedicado de pendencias, mas a pagina completa `/pending` ainda nao foi implementada.
- Visibilidade de editar/excluir melhorou, mas ainda deve ser revisada contra todas as regras de autorizacao do backend.
- Edicao de evento compartilhado ainda pode ser confusa porque o backend pode exigir e-mail de aprovacao valido e retornar validacoes.

**Divida visual/design:**
- A tela de calendario esta mais proxima do layout operacional desejado, mas ainda precisa de refinamento contra as imagens de referencia.
- Sidebar, card do calendario, painel de pendencias, espacamentos, tipografia e chips de evento devem ser normalizados em uma passada visual.
- Alguns estilos globais do FullCalendar/modal estao em `src/styles.scss`, o que funciona, mas dificulta manutencao.
- `login-page.scss`, `app-shell.scss` e `calendar-page.scss` ultrapassam o budget de warning de estilo do Angular.

**Testes/ferramentas:**
- Build do frontend passa.
- Specs do frontend provavelmente estao defasadas do scaffold inicial e precisam de revisao.
- Testes do backend nao rodaram neste ambiente porque o `JAVA_HOME` esta incorreto.
- Rodar build Angular dentro do sandbox pode falhar com `spawn EPERM`; rodar `npm.cmd run build` fora do sandbox funciona.

---

## Validacao

Comando de build do frontend:

```text
npm.cmd run build
```

Resultado:
- Passou.
- Output: `frontend/dist/shared-planner-frontend`.
- 9 rotas estaticas prerenderizadas.

Warnings:
- `src/app/features/auth/login-page/login-page.scss` esta com `7.86 kB` para budget de warning de `4.00 kB`.
- `src/app/core/layout/app-shell/app-shell.scss` esta com `7.77 kB` para budget de warning de `4.00 kB`.
- `src/app/features/calendar/calendar-page/calendar-page.scss` esta com `7.96 kB` para budget de warning de `4.00 kB`.

Comando de teste do backend:

```text
.\mvnw.cmd test
```

Resultado:
- Nao executou com sucesso neste ambiente.
- Motivo: `JAVA_HOME` nao esta definido corretamente.

---

## Proximos Passos Recomendados

1. Refinar visualmente a tela de calendario com base nas duas telas de referencia.
2. Implementar a tela completa de pendencias.
3. Implementar a tela de membros usando o CRUD de membros do backend.
4. Implementar a tela financeira usando `/api/finance/summary`.
5. Implementar a tela administrativa de usuarios usando `/api/users`.
6. Implementar a tela de auditoria usando `/api/audit-logs`.
7. Revisar specs antigas do frontend e adicionar testes para auth, permissoes do calendario e aprovacao de eventos.
