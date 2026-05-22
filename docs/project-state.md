# Project State — Shared Planner

## General Overview

Current branch: `main`.
Git is clean, no pending files.

Main structure:
- `backend`: Java 17 + Spring Boot 4 REST API.
- `frontend`: Angular 21 with SSR.
- `docs`: seed SQL, Postman collection and manual business rule checklist.
- `docker`: initial infrastructure setup.

---

## Backend

The backend is organized by domain:

- `auth`: login, JWT, authenticated user profile.
- `config`: security and centralized authorization.
- `user`: global user creation, update and listing.
- `calendar`: shared calendars and per-calendar member roles.
- `event`: events, payments, approval and rejection workflow.
- `finance`: financial summary by period and client.
- `audit`: administrative logs with before/after snapshots.
- `health`: simple health check.

**Confirmed technologies:**
- Java 17.
- Spring Boot 4.0.6.
- Spring Security + JWT (HS256).
- JPA/Hibernate.
- Flyway.
- SQL Server active on `dev` profile.
- H2 configured for tests.

**Existing endpoints today:**

```
GET  /api/health

POST /api/auth/login
GET  /api/auth/me                                        → returns full object (id, fullName, email, role, active)

GET  /api/users                                          → restricted to ADMIN
POST /api/users
PUT  /api/users/{userId}

GET  /api/calendars
POST /api/calendars
POST /api/calendars/{calendarId}/members
GET  /api/calendars/{calendarId}/members
PUT  /api/calendars/{calendarId}/members/{memberId}
DELETE /api/calendars/{calendarId}/members/{memberId}

GET  /api/events
POST /api/events
GET  /api/events/pending-approvals                       → ADMIN sees all; others see only events directed at them
GET  /api/events/{eventId}
PUT  /api/events/{eventId}
DELETE /api/events/{eventId}
PUT  /api/events/{eventId}/payment
POST /api/events/{eventId}/approve
POST /api/events/{eventId}/reject
GET  /api/events/client-revenue

GET  /api/finance/summary

GET  /api/audit-logs
```

**Business rules covered:**
- Global ADMIN has broad access to all resources.
- Members have per-calendar roles: `ADMIN`, `FINANCE`, `EDITOR`, `VIEWER`.
- `CLIENT`, `PERSONAL` and `SHARED` event types have their own validations.
- Approval workflow: `PENDING_APPROVAL → APPROVED / REJECTED`.
- Calendar owner cannot be removed from a calendar.
- Financial summary ignores non-financial and cancelled events.
- Audit logs all critical operations with before/after value snapshots.

---

## Frontend

The frontend is Angular 21 with SSR enabled and lazy-loaded routes.

**Current routes:**
```
/login
/calendar
/pending
/finance
/members
/admin/users
/audit
/settings
```

The login screen has a custom visual layout and calls `POST /api/auth/login`. The token is stored in `localStorage` as `sharedPlanner.token`.

`auth.interceptor.ts` skips `/api/auth/login` and `/api/health`, and injects `Authorization: Bearer ...` on all protected routes.

The `AppShell` is functional with:
- side menu with module navigation;
- topbar with search field;
- avatar with initials computed from the user's real name (first + last name);
- subtitle displaying the user's role;
- "Users" link visible only for `ADMIN` role;
- logout button.

The calendar screen is the most advanced in the frontend. It uses FullCalendar and already has:
- calendar list loaded from API;
- active calendar selection;
- multiple calendars loaded via parallel requests;
- filters by event type;
- search by client, person, title and description;
- event creation modal;
- event edit modal;
- event detail modal;
- event deletion;
- side pending approvals panel;
- API event objects converted to FullCalendar visual events.

---

## Placeholder Pages

These pages exist with routes and a shell component, but have no functional implementation:

- `finance-page`
- `members-page`
- `users-page`
- `audit-page`
- `pending-page`
- `settings-page`

The shell exists, the routes exist, some API services exist, but the functional screens still need to be implemented.

---

## Frontend Services

- `CalendarService`: list/create calendar, add member.
- `EventService`: create/list/edit/delete events, approve/reject, update payment.
- `FinanceService`: consume financial summary.
- `UserService`: create and update users.
- `AuditService`: fetch audit logs.
- `AuthService`: login, logout, full user profile via signal (`currentUser: Signal<UserResponse | null>`).

TypeScript models in `shared-planner.models.ts` are aligned with the backend contracts.

---

## Known Issues

**Visual bugs** identified in the frontend — to be fixed before manual testing.

**Incomplete calendar MVP on the frontend:**
- Approve/reject has no UI in the pending panel yet (backend already supports it).
- Payment update has no UI yet (backend already supports it).
- Calendar action buttons are not filtered by the user's actual role in the calendar.

**CSS:**
- Modal and calendar detail styles are in `src/styles.scss` instead of their respective components. Works, but makes maintenance harder.
- `login-page.scss`, `app-shell.scss` and `calendar-page.scss` exceed the 4 kB budget (still below the 8 kB error threshold — build does not break).

**Broken specs:**
- `app.spec.ts` still expects an `h1` from the original scaffolding (`Hello, shared-planner-frontend`).
- `app-shell.spec.ts` needs a router provider configured because the shell uses `RouterLink`.

**Technical:**
- Maven fails copying `application-test.properties` due to a permission issue in `target/test-classes` on this machine.
- Angular/esbuild fails with `spawn EPERM` on this environment (workaround: use `npm.cmd`).

---

## Validation

`npm run build` (frontend): passed.
- `login-page.scss`, `app-shell.scss` and `calendar-page.scss` above the 4 kB budget, below the 8 kB error limit.

`npm test` (frontend): failed on 2 specs (described above under Broken specs).

Backend tests: could not run on this environment (`JAVA_HOME` misconfigured).

---------------- PT - BR --------------------------------------

## Estado Geral
 
Branch atual: `main`.
Git está limpo, sem arquivos pendentes.
 
Estrutura principal:
- `backend`: API Java 17 + Spring Boot 4.
- `frontend`: Angular 21 com SSR.
- `docs`: seed SQL, coleção Postman e checklist manual de regras.
- `docker`: infraestrutura inicial.
 
---
 
## Backend
 
O backend está organizado por domínio:
 
- `auth`: login, JWT, perfil completo do usuário autenticado.
- `config`: segurança e autorização centralizada.
- `user`: criação, edição e listagem de usuários globais.
- `calendar`: calendários, membros e papéis por calendário.
- `event`: eventos, pagamentos, aprovação e reprovação.
- `finance`: resumo financeiro por período e cliente.
- `audit`: logs administrativos com snapshot antes/depois.
- `health`: health check simples.
 
**Tecnologias confirmadas:**
- Java 17.
- Spring Boot 4.0.6.
- Spring Security + JWT (HS256).
- JPA/Hibernate.
- Flyway.
- SQL Server ativo no perfil `dev`.
- H2 configurado para testes.
 
**Endpoints existentes hoje:**
 
```
GET  /api/health
 
POST /api/auth/login
GET  /api/auth/me                                        → retorna objeto completo (id, fullName, email, role, active)
 
GET  /api/users                                          → restrito a ADMIN
POST /api/users
PUT  /api/users/{userId}
 
GET  /api/calendars
POST /api/calendars
POST /api/calendars/{calendarId}/members
GET  /api/calendars/{calendarId}/members
PUT  /api/calendars/{calendarId}/members/{memberId}
DELETE /api/calendars/{calendarId}/members/{memberId}
 
GET  /api/events
POST /api/events
GET  /api/events/pending-approvals                       → ADMIN vê todos; outros veem só os direcionados a eles
GET  /api/events/{eventId}
PUT  /api/events/{eventId}
DELETE /api/events/{eventId}
PUT  /api/events/{eventId}/payment
POST /api/events/{eventId}/approve
POST /api/events/{eventId}/reject
GET  /api/events/client-revenue
 
GET  /api/finance/summary
 
GET  /api/audit-logs
```
 
**Regras de negócio cobertas:**
- ADMIN global tem acesso amplo a todos os recursos.
- Membros têm papéis por calendário: `ADMIN`, `FINANCE`, `EDITOR`, `VIEWER`.
- Eventos `CLIENT`, `PERSONAL` e `SHARED` têm validações próprias.
- Fluxo de aprovação: `PENDING_APPROVAL → APPROVED / REJECTED`.
- Owner de calendário não pode ser removido.
- Financeiro ignora eventos não financeiros e cancelados.
- Auditoria registra todas as operações críticas com snapshot antes/depois.
 
---
 
## Frontend
 
O frontend está em Angular 21 com SSR habilitado e lazy loading por rota.
 
**Rotas atuais:**
```
/login
/calendar
/pending
/finance
/members
/admin/users
/audit
/settings
```
 
O login tem layout visual customizado e chama `POST /api/auth/login`. O token é salvo em `localStorage` como `sharedPlanner.token`.
 
O `auth.interceptor.ts` pula `/api/auth/login` e `/api/health`, e injeta `Authorization: Bearer ...` nas demais rotas.
 
O `AppShell` já existe com:
- menu lateral com navegação para módulos;
- topbar com campo de busca;
- avatar com iniciais calculadas a partir do nome real (primeiro + último nome);
- subtítulo exibindo o role do usuário;
- link "Usuários" visível apenas para role `ADMIN`;
- botão de logout.
 
O calendário é a tela mais avançada do frontend. Já usa FullCalendar e tem:
- carregamento de calendários via API;
- seleção de calendário ativo;
- múltiplos calendários carregados via chamadas paralelas;
- filtros por tipo de evento;
- busca por cliente, pessoa, título e descrição;
- modal de criação de evento;
- modal de edição de evento;
- modal de detalhes de evento;
- exclusão de evento;
- painel lateral de pendências;
- conversão dos eventos da API para eventos visuais no FullCalendar.
 
---
 
## O Que Ainda Está Placeholder
 
Estas páginas existem com rota e casca, mas sem implementação funcional:
 
- `finance-page`
- `members-page`
- `users-page`
- `audit-page`
- `pending-page`
- `settings-page`
 
A casca existe, as rotas existem, alguns serviços de API existem, mas as telas funcionais ainda precisam ser implementadas.
 
---
 
## Serviços Frontend Já Criados
 
- `CalendarService`: listar/criar calendário, adicionar membro.
- `EventService`: criar/listar/editar/excluir eventos, aprovar/reprovar, atualizar pagamento.
- `FinanceService`: consumir resumo financeiro.
- `UserService`: criar e atualizar usuários.
- `AuditService`: buscar logs de auditoria.
- `AuthService`: login, logout, perfil completo do usuário via signal (`currentUser: Signal<UserResponse | null>`).
 
Os models TypeScript em `shared-planner.models.ts` estão alinhados com o backend.
 
---
 
## Pontos de Atenção
 
**Bugs visuais** identificados no frontend — a corrigir antes dos testes manuais.
 
**MVP do calendário incompleto no frontend:**
- Approve/reject ainda não tem UI no painel de pendências (backend já suporta).
- Atualização de pagamento ainda não tem UI (backend já suporta).
- Ações no calendário não são filtradas pelo papel real do usuário no calendário.
 
**CSS:**
- Existe CSS de modal e detalhe de calendário em `src/styles.scss` que deveria estar nos componentes correspondentes. Funciona, mas dificulta manutenção.
- `login-page.scss`, `app-shell.scss` e `calendar-page.scss` ultrapassam o budget de 4 kB (estão abaixo do limite de erro de 8 kB — build não quebra).
 
**Specs quebrados:**
- `app.spec.ts` ainda espera um `h1` do scaffolding inicial (`Hello, shared-planner-frontend`).
- `app-shell.spec.ts` precisa de provider de rota configurado, pois o shell usa `RouterLink`.
 
**Técnicos:**
- Maven com problema de permissão em `target/test-classes` no ambiente local.
- Angular/esbuild com erro `spawn EPERM` nesse ambiente (contornável com `npm.cmd`).
 
---
 
## Validação
 
`npm run build` no frontend: passou.
- `login-page.scss`, `app-shell.scss` e `calendar-page.scss` acima do budget de 4 kB, abaixo do limite de erro de 8 kB.
 
`npm test` no frontend: falhou em 2 specs (descritos acima em Pontos de Atenção).
 
Testes do backend: não foi possível rodar no ambiente atual (JAVA_HOME incorreto).
 
---