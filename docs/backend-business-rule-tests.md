# Backend Business Rule Tests

This document is a manual and automation-ready regression checklist for validating the main backend business rules.

Use it after running `docs/database/seed-dev-data.sql` and importing `docs/postman/shared-planner.postman_collection.json`.

Optional scenario seed: run `docs/database/seed-malu-jotape.sql` when validating shared-calendar behavior between `malu@gmail.com` and `jotape@gmail.com`.

## Seed Users

All seed users use password `admin`.

| Email | Global role | Calendar role | Main purpose |
| --- | --- | --- | --- |
| `jpcbnnu@gmail.com` | `ADMIN` | `ADMIN` | Full access and user creation |
| `esposa@example.com` | `USER` | `VIEWER` | Read-only calendar access and approval target |
| `editor@example.com` | `USER` | `EDITOR` | Create and edit own events |
| `finance@example.com` | `FINANCE` | `FINANCE` | Finance access without user management |

## Seed Ids

| Variable | Value | Purpose |
| --- | --- | --- |
| `calendarId` | `33333333-3333-3333-3333-333333333333` | Shared seed calendar |
| `paidClientEventId` | `44444444-4444-4444-4444-444444444444` | Client event already paid |
| `pendingClientEventId` | `55555555-5555-5555-5555-555555555555` | Client event pending payment |
| `partialClientEventId` | `66666666-6666-6666-6666-666666666666` | Client event partially paid |
| `personalEventId` | `77777777-7777-7777-7777-777777777777` | Personal event |
| `sharedEventId` | `88888888-8888-8888-8888-888888888888` | Shared event pending approval from `esposa@example.com` |

## Auth

1. `GET /api/health`
   Expected: `200 OK` without token.

2. `POST /api/auth/login`
   Use `email = jpcbnnu@gmail.com`, `password = admin`.
   Expected: `200 OK`, response contains `accessToken`, `tokenType = Bearer`.

3. `POST /api/auth/login`
   Use an invalid password.
   Expected: `401 Unauthorized`.

4. `GET /api/auth/me`
   Use a valid token.
   Expected: `200 OK`, response contains `id`, `fullName`, `email`, `role`, `active`, `createdAt`, `updatedAt`.

5. `GET /api/auth/me`
   Without token.
   Expected: `401 Unauthorized`.

Rule validated: public endpoints stay public; protected endpoints require a valid JWT.

## Users

1. Login as `jpcbnnu@gmail.com`.
2. `GET /api/users`
   Expected: `200 OK`, list sorted by `fullName`.

3. `POST /api/users`
   Use a new e-mail.
   Expected: `201 Created`; password is BCrypt encoded; audit log is created.

4. `POST /api/users`
   Use an existing e-mail.
   Expected: `409 Conflict`.

5. `PUT /api/users/{userId}`
   Update another user as admin.
   Expected: `200 OK`; role/active/fullName are updated; audit log is created.

6. `PUT /api/users/{adminUserId}`
   Try to deactivate the authenticated admin.
   Expected: `400 Bad Request`.

7. `PUT /api/users/{adminUserId}`
   Try to change the authenticated admin role from `ADMIN` to `USER` or `FINANCE`.
   Expected: `400 Bad Request`.

8. Login as `esposa@example.com`.
9. `GET /api/users`, `POST /api/users`, `PUT /api/users/{userId}`.
   Expected: `403 Forbidden`.

Rules validated:
- Only global `ADMIN` can list, create and update users.
- Admin cannot deactivate itself.
- Admin cannot remove its own `ADMIN` global role.

## Calendars

1. Login as `jpcbnnu@gmail.com`.
2. `GET /api/calendars`
   Expected: `200 OK`; global admin sees all calendars.
   Response item expected: `id`, `name`, `ownerEmail`, `memberRole = ADMIN`, `canCreateEvents = true`.

3. `POST /api/calendars`
   Expected: `201 Created`; creator becomes owner and calendar `ADMIN`; audit log is created.

4. Login as `esposa@example.com`.
5. `GET /api/calendars`
   Expected: `200 OK`; user sees only calendars where it is a member.
   Response item expected: `memberRole = VIEWER`, `canCreateEvents = false`.

6. `POST /api/calendars`
   Expected: `403 Forbidden`.

7. Login as `editor@example.com`.
8. `GET /api/calendars`
   Expected: `memberRole = EDITOR`, `canCreateEvents = true`.

9. Login as `finance@example.com`.
10. `GET /api/calendars`
    Expected: `memberRole = FINANCE`, `canCreateEvents = false`.

Rules validated:
- Only global `ADMIN` can create calendars.
- Calendar list respects membership visibility.
- Calendar response exposes frontend permission metadata.

## Calendar Members

1. Login as `jpcbnnu@gmail.com`.
2. `GET /api/calendars/{calendarId}/members`
   Expected: `200 OK`; returns all members ordered by `createdAt`.

3. `POST /api/calendars/{calendarId}/members`
   Set `memberEmail = esposa@example.com`, `memberRole = VIEWER`, `EDITOR`, `FINANCE` or `ADMIN`.
   Expected: `204 No Content`.

4. `POST /api/calendars/{calendarId}/members`
   Add an existing member with a different role.
   Expected: `204 No Content`; role is updated, not duplicated; audit log is created.

5. `PUT /api/calendars/{calendarId}/members/{memberId}`
   Change a member role.
   Expected: `200 OK`; response has the updated `role`; audit log is created.

6. `DELETE /api/calendars/{calendarId}/members/{memberId}`
   Remove a non-owner member.
   Expected: `204 No Content`; audit log is created.

7. `DELETE /api/calendars/{calendarId}/members/{ownerMemberId}`
   Try to remove the calendar owner.
   Expected: `400 Bad Request`.

8. Login as `editor@example.com`.
9. Try `POST`, `PUT`, `DELETE` member endpoints.
   Expected: `403 Forbidden`.

Rules validated:
- Global `ADMIN` or calendar `ADMIN` can manage members.
- Non-admin calendar roles cannot manage members.
- Calendar owner cannot be removed.
- Re-adding an existing member updates the role instead of creating duplicate membership.

## Events

1. Login as `esposa@example.com` calendar `VIEWER`.
2. `GET /api/events?calendarId={calendarId}&start=...&end=...`
   Expected: `200 OK`.

3. `POST /api/events` with `CLIENT`.
   Expected: `403 Forbidden`.

4. `PUT /api/events/{eventId}`.
   Expected: `403 Forbidden`.

Rule validated: `VIEWER` only reads.

5. Login as `editor@example.com` calendar `EDITOR`.
6. `POST /api/events` with valid `CLIENT`.
   Expected: `201 Created`; status `SCHEDULED`; payment status `PENDING`; audit log is created.

7. `PUT /api/events/{eventId}` using an event created by another user.
   Expected: `403 Forbidden`.

8. `PUT /api/events/{ownEventId}` using an event created by the editor.
   Expected: `200 OK`; audit log is created.

Rule validated: `EDITOR` creates events and edits only its own events.

9. Login as `jpcbnnu@gmail.com`.
10. `POST /api/events` with `CLIENT` missing `clientName`.
    Expected: `400 Bad Request`.

11. `POST /api/events` with `CLIENT` missing `workDescription`.
    Expected: `400 Bad Request`.

12. `POST /api/events` with `CLIENT` missing `amount`.
    Expected: `400 Bad Request`.

13. `POST /api/events` with `PERSONAL` missing `personName`.
    Expected: `400 Bad Request`.

14. `POST /api/events` with `endsAt <= startsAt`.
    Expected: `400 Bad Request`.

15. `GET /api/events/{eventId}`
    As a visible calendar member.
    Expected: `200 OK`.

16. `GET /api/events/{eventId}`
    As a non-member non-admin user.
    Expected: `404 Not Found` or `403 Forbidden`, depending on visibility path.

Rules validated:
- Event type-specific fields are required.
- Event period must be valid.
- Event visibility follows calendar visibility.

## Global Event Search

1. Login as `jpcbnnu@gmail.com`.
2. `GET /api/events/search?term=Maria&limit=20`
   Expected: `200 OK`; returns `Cliente Maria - Sobrancelha`; response includes `calendarName`.

3. `GET /api/events/search?term=Joao&limit=20`
   Expected: `200 OK`; matches title/person/description/creator/calendar fields when applicable.

4. `GET /api/events/search?term=M&limit=20`
   Expected: `200 OK` and empty list because terms shorter than 2 characters are ignored.

5. `GET /api/events/search?term=Cliente&limit=100`
   Expected: `200 OK`; result size is capped at 50.

6. Login as `esposa@example.com`.
7. `GET /api/events/search?term=Maria&limit=20`
   Expected: returns only events from calendars where this user is a member.

8. Search for a cancelled event after cancelling/deleting it.
   Expected: cancelled/deleted event does not appear.

Rules validated:
- Search is global across visible calendars, not limited to the current frontend period.
- Global `ADMIN` searches all calendars.
- Non-admin users search only their visible calendars.
- Cancelled events are excluded from search results.

## Shared Events And Pending Approvals

1. Login as `jpcbnnu@gmail.com`.
2. `POST /api/events` with `SHARED` and `approvalRequestedFromEmail = esposa@example.com`.
   Expected: `201 Created`, status `PENDING_APPROVAL`, approval target `esposa@example.com`.

3. `POST /api/events` with `SHARED` and `approvalRequestedFromEmail = jpcbnnu@gmail.com`.
   Expected: `400 Bad Request`.

4. `POST /api/events` with `SHARED` and a user that is not a calendar member.
   Expected: `404 Not Found`.

5. Login as `jpcbnnu@gmail.com`.
6. `GET /api/events/pending-approvals`
   Expected: global admin sees all pending approvals.

7. Login as `esposa@example.com`.
8. `GET /api/events/pending-approvals`
   Expected: only events where `approvalRequestedFromEmail = esposa@example.com`.

9. Login as `editor@example.com`.
10. `GET /api/events/pending-approvals`
    Expected: empty list unless there is an event pending approval from `editor@example.com`.

11. Login as `esposa@example.com`.
12. `POST /api/events/{sharedEventId}/approve`
    Expected: `200 OK`, status `APPROVED`, `approvedByEmail = esposa@example.com`, audit log is created.

13. Repeat with another pending shared event and `POST /api/events/{eventId}/reject`.
    Expected: `200 OK`, status `REJECTED`, audit log is created.

14. Login as a user that is not the requested approval target.
15. Try approve/reject.
    Expected: `403 Forbidden`.

16. Try approve/reject an event that is not `PENDING_APPROVAL`.
    Expected: `400 Bad Request`.

Rules validated:
- Shared events require another calendar member for approval.
- Pending approvals endpoint returns actionable pending approvals for the logged user.
- Only requested approval user can approve or reject.

## Finance

1. Login as `jpcbnnu@gmail.com`.
2. `GET /api/finance/summary?calendarId={calendarId}&startDate=2026-05-08&endDate=2026-05-10`
   Expected: `200 OK`.

Fresh seed expected values:

| Field | Expected |
| --- | --- |
| `expectedAmount` | `240` |
| `receivedAmount` | `110` |
| `pendingAmount` | `130` |
| `appointmentCount` | `3` |
| `paidCount` | `1` |
| `pendingCount` | `1` |
| `partiallyPaidCount` | `1` |
| `refundedCount` | `0` |

3. Login as `finance@example.com`.
4. `GET /api/finance/summary`
   Expected: `200 OK`.

5. Login as `esposa@example.com`.
6. `GET /api/finance/summary`
   Expected: `403 Forbidden`.

7. `GET /api/events/client-revenue?calendarId={calendarId}&period=DAILY&date=2026-05-08`
   Expected: counts only client events for the selected period.

Rules validated:
- Finance summary counts only `CLIENT` events.
- Cancelled events are ignored.
- Finance requires global `ADMIN`, global `FINANCE` with calendar membership, or calendar role `FINANCE`/`ADMIN`.

## Payments

1. Login as `jpcbnnu@gmail.com`.
2. `PUT /api/events/{pendingClientEventId}/payment`
   Use `paymentStatus = PAID`, `receivedAmount = 70.00`, valid payment method.
   Expected: `200 OK`, payment status changes to `PAID`, audit log is created.

3. `PUT /api/events/{pendingClientEventId}/payment`
   Use `paymentStatus = PENDING`, `receivedAmount > 0`.
   Expected: `400 Bad Request`.

4. `PUT /api/events/{pendingClientEventId}/payment`
   Use `paymentStatus = PARTIALLY_PAID`, `receivedAmount = 0`.
   Expected: `400 Bad Request`.

5. `PUT /api/events/{pendingClientEventId}/payment`
   Use `receivedAmount > amount`.
   Expected: `400 Bad Request`.

6. `PUT /api/events/{personalEventId}/payment`
   Expected: `400 Bad Request`.

Rules validated:
- Only `CLIENT` events can receive payment data.
- Payment values and statuses must be internally consistent.

## Audit Logs

1. Login as `jpcbnnu@gmail.com`.
2. Create/update/delete an event.
3. `GET /api/audit-logs?calendarId={calendarId}&entityType=EVENT&limit=20`
   Expected: `200 OK`; logs contain `entityType`, `action`, `summary`, `oldValue`, `newValue`, `performedByEmail`, `performedAt`.

4. Update payment.
   Expected: audit action `PAYMENT_UPDATED`.

5. Approve/reject shared event.
   Expected: audit actions `APPROVED` or `REJECTED`.

6. Add/update/remove calendar member.
   Expected: audit actions `MEMBER_ADDED`, `MEMBER_ROLE_UPDATED` or `DELETED`.

7. Login as `editor@example.com`.
8. `GET /api/audit-logs?calendarId={calendarId}`
   Expected: `403 Forbidden`.

Rules validated:
- Audit records relevant administrative/business changes.
- Calendar audit visibility requires global `ADMIN` or calendar `ADMIN`.

## Automation Targets

These cases should be written as integration tests:

- Auth public/protected endpoint behavior.
- User admin-only access and self-protection.
- Calendar visibility and `memberRole` / `canCreateEvents`.
- Calendar member add/update/delete and owner removal protection.
- Event type validation and permission matrix (`VIEWER`, `EDITOR`, `ADMIN`).
- Shared event approval target validation.
- Pending approvals endpoint per user.
- Global event search visibility and result limit.
- Finance totals and finance permission matrix.
- Payment validation matrix.
- Audit log generation for each important action.

---------------- PT-BR -----------------------

# Testes de Regras de Negocio do Backend

Este documento e um checklist manual e pronto para automacao para validar as principais regras de negocio do backend.

Use este checklist depois de executar `docs/database/seed-dev-data.sql` e importar `docs/postman/shared-planner.postman_collection.json`.

Cenario opcional: execute `docs/database/seed-malu-jotape.sql` para validar comportamento de calendarios compartilhados entre `malu@gmail.com` e `jotape@gmail.com`.

## Usuarios do Seed

Todos os usuarios do seed usam senha `admin`.

| Email | Perfil global | Perfil no calendario | Objetivo principal |
| --- | --- | --- | --- |
| `jpcbnnu@gmail.com` | `ADMIN` | `ADMIN` | Acesso total e criacao de usuarios |
| `esposa@example.com` | `USER` | `VIEWER` | Acesso somente leitura e alvo de aprovacao |
| `editor@example.com` | `USER` | `EDITOR` | Criar e editar os proprios eventos |
| `finance@example.com` | `FINANCE` | `FINANCE` | Acesso financeiro sem gestao de usuarios |

## IDs do Seed

| Variavel | Valor | Objetivo |
| --- | --- | --- |
| `calendarId` | `33333333-3333-3333-3333-333333333333` | Calendario compartilhado do seed |
| `paidClientEventId` | `44444444-4444-4444-4444-444444444444` | Evento de cliente ja pago |
| `pendingClientEventId` | `55555555-5555-5555-5555-555555555555` | Evento de cliente pendente |
| `partialClientEventId` | `66666666-6666-6666-6666-666666666666` | Evento de cliente parcialmente pago |
| `personalEventId` | `77777777-7777-7777-7777-777777777777` | Evento pessoal |
| `sharedEventId` | `88888888-8888-8888-8888-888888888888` | Evento compartilhado pendente para `esposa@example.com` |

## Autenticacao

1. `GET /api/health`
   Esperado: `200 OK` sem token.

2. `POST /api/auth/login`
   Use `email = jpcbnnu@gmail.com`, `password = admin`.
   Esperado: `200 OK`, resposta contem `accessToken`, `tokenType = Bearer`.

3. `POST /api/auth/login`
   Use senha invalida.
   Esperado: `401 Unauthorized`.

4. `GET /api/auth/me`
   Use token valido.
   Esperado: `200 OK`, resposta contem `id`, `fullName`, `email`, `role`, `active`, `createdAt`, `updatedAt`.

5. `GET /api/auth/me`
   Sem token.
   Esperado: `401 Unauthorized`.

Regra validada: endpoints publicos continuam publicos; endpoints protegidos exigem JWT valido.

## Usuarios

1. Faca login como `jpcbnnu@gmail.com`.
2. `GET /api/users`
   Esperado: `200 OK`, lista ordenada por `fullName`.

3. `POST /api/users`
   Use um e-mail novo.
   Esperado: `201 Created`; senha e codificada com BCrypt; log de auditoria e criado.

4. `POST /api/users`
   Use e-mail existente.
   Esperado: `409 Conflict`.

5. `PUT /api/users/{userId}`
   Atualize outro usuario como admin.
   Esperado: `200 OK`; `role`, `active` e `fullName` sao atualizados; log de auditoria e criado.

6. `PUT /api/users/{adminUserId}`
   Tente desativar o proprio admin autenticado.
   Esperado: `400 Bad Request`.

7. `PUT /api/users/{adminUserId}`
   Tente trocar o proprio admin de `ADMIN` para `USER` ou `FINANCE`.
   Esperado: `400 Bad Request`.

8. Faca login como `esposa@example.com`.
9. `GET /api/users`, `POST /api/users`, `PUT /api/users/{userId}`.
   Esperado: `403 Forbidden`.

Regras validadas:
- Somente `ADMIN` global pode listar, criar e atualizar usuarios.
- Admin nao pode desativar a si mesmo.
- Admin nao pode remover o proprio perfil global `ADMIN`.

## Calendarios

1. Faca login como `jpcbnnu@gmail.com`.
2. `GET /api/calendars`
   Esperado: `200 OK`; admin global ve todos os calendarios.
   Item esperado: `id`, `name`, `ownerEmail`, `memberRole = ADMIN`, `canCreateEvents = true`.

3. `POST /api/calendars`
   Esperado: `201 Created`; criador vira dono e `ADMIN` do calendario; log de auditoria e criado.

4. Faca login como `esposa@example.com`.
5. `GET /api/calendars`
   Esperado: `200 OK`; usuario ve apenas calendarios onde e membro.
   Item esperado: `memberRole = VIEWER`, `canCreateEvents = false`.

6. `POST /api/calendars`
   Esperado: `403 Forbidden`.

7. Faca login como `editor@example.com`.
8. `GET /api/calendars`
   Esperado: `memberRole = EDITOR`, `canCreateEvents = true`.

9. Faca login como `finance@example.com`.
10. `GET /api/calendars`
    Esperado: `memberRole = FINANCE`, `canCreateEvents = false`.

Regras validadas:
- Somente `ADMIN` global pode criar calendarios.
- Listagem de calendarios respeita visibilidade por membro.
- Resposta de calendario expoe metadados de permissao para o frontend.

## Membros do Calendario

1. Faca login como `jpcbnnu@gmail.com`.
2. `GET /api/calendars/{calendarId}/members`
   Esperado: `200 OK`; retorna membros ordenados por `createdAt`.

3. `POST /api/calendars/{calendarId}/members`
   Defina `memberEmail = esposa@example.com`, `memberRole = VIEWER`, `EDITOR`, `FINANCE` ou `ADMIN`.
   Esperado: `204 No Content`.

4. `POST /api/calendars/{calendarId}/members`
   Adicione membro existente com perfil diferente.
   Esperado: `204 No Content`; papel e atualizado, sem duplicar membro; log de auditoria e criado.

5. `PUT /api/calendars/{calendarId}/members/{memberId}`
   Troque o papel de um membro.
   Esperado: `200 OK`; resposta contem `role` atualizado; log de auditoria e criado.

6. `DELETE /api/calendars/{calendarId}/members/{memberId}`
   Remova membro que nao e dono.
   Esperado: `204 No Content`; log de auditoria e criado.

7. `DELETE /api/calendars/{calendarId}/members/{ownerMemberId}`
   Tente remover o dono do calendario.
   Esperado: `400 Bad Request`.

8. Faca login como `editor@example.com`.
9. Tente `POST`, `PUT`, `DELETE` nos endpoints de membros.
   Esperado: `403 Forbidden`.

Regras validadas:
- `ADMIN` global ou `ADMIN` do calendario pode gerenciar membros.
- Outros papeis do calendario nao gerenciam membros.
- Dono do calendario nao pode ser removido.
- Adicionar membro existente atualiza papel sem duplicar membro.

## Eventos

1. Faca login como `esposa@example.com`, que e `VIEWER`.
2. `GET /api/events?calendarId={calendarId}&start=...&end=...`
   Esperado: `200 OK`.

3. `POST /api/events` com `CLIENT`.
   Esperado: `403 Forbidden`.

4. `PUT /api/events/{eventId}`.
   Esperado: `403 Forbidden`.

Regra validada: `VIEWER` somente visualiza.

5. Faca login como `editor@example.com`, que e `EDITOR`.
6. `POST /api/events` com `CLIENT` valido.
   Esperado: `201 Created`; status `SCHEDULED`; status de pagamento `PENDING`; log de auditoria e criado.

7. `PUT /api/events/{eventId}` usando evento criado por outro usuario.
   Esperado: `403 Forbidden`.

8. `PUT /api/events/{ownEventId}` usando evento criado pelo editor.
   Esperado: `200 OK`; log de auditoria e criado.

Regra validada: `EDITOR` cria eventos e edita somente os proprios eventos.

9. Faca login como `jpcbnnu@gmail.com`.
10. `POST /api/events` com `CLIENT` sem `clientName`.
    Esperado: `400 Bad Request`.

11. `POST /api/events` com `CLIENT` sem `workDescription`.
    Esperado: `400 Bad Request`.

12. `POST /api/events` com `CLIENT` sem `amount`.
    Esperado: `400 Bad Request`.

13. `POST /api/events` com `PERSONAL` sem `personName`.
    Esperado: `400 Bad Request`.

14. `POST /api/events` com `endsAt <= startsAt`.
    Esperado: `400 Bad Request`.

15. `GET /api/events/{eventId}`
    Como membro visivel do calendario.
    Esperado: `200 OK`.

16. `GET /api/events/{eventId}`
    Como usuario que nao e membro e nao e admin.
    Esperado: `404 Not Found` ou `403 Forbidden`, conforme caminho de visibilidade.

Regras validadas:
- Campos especificos por tipo de evento sao obrigatorios.
- Periodo do evento deve ser valido.
- Visibilidade do evento segue visibilidade do calendario.

## Busca Global de Eventos

1. Faca login como `jpcbnnu@gmail.com`.
2. `GET /api/events/search?term=Maria&limit=20`
   Esperado: `200 OK`; retorna `Cliente Maria - Sobrancelha`; resposta inclui `calendarName`.

3. `GET /api/events/search?term=Joao&limit=20`
   Esperado: `200 OK`; busca em titulo/pessoa/descricao/criador/calendario quando aplicavel.

4. `GET /api/events/search?term=M&limit=20`
   Esperado: `200 OK` e lista vazia porque termos menores que 2 caracteres sao ignorados.

5. `GET /api/events/search?term=Cliente&limit=100`
   Esperado: `200 OK`; tamanho da lista limitado a 50.

6. Faca login como `esposa@example.com`.
7. `GET /api/events/search?term=Maria&limit=20`
   Esperado: retorna apenas eventos dos calendarios onde este usuario e membro.

8. Busque um evento cancelado depois de cancelar/excluir.
   Esperado: evento cancelado/excluido nao aparece.

Regras validadas:
- Busca e global nos calendarios visiveis, nao limitada ao periodo atual do frontend.
- `ADMIN` global busca em todos os calendarios.
- Usuarios comuns buscam apenas calendarios visiveis.
- Eventos cancelados sao excluidos da busca.

## Eventos Compartilhados e Pendencias de Aprovacao

1. Faca login como `jpcbnnu@gmail.com`.
2. `POST /api/events` com `SHARED` e `approvalRequestedFromEmail = esposa@example.com`.
   Esperado: `201 Created`, status `PENDING_APPROVAL`, alvo de aprovacao `esposa@example.com`.

3. `POST /api/events` com `SHARED` e `approvalRequestedFromEmail = jpcbnnu@gmail.com`.
   Esperado: `400 Bad Request`.

4. `POST /api/events` com `SHARED` e usuario que nao e membro do calendario.
   Esperado: `404 Not Found`.

5. Faca login como `jpcbnnu@gmail.com`.
6. `GET /api/events/pending-approvals`
   Esperado: admin global ve todas as pendencias.

7. Faca login como `esposa@example.com`.
8. `GET /api/events/pending-approvals`
   Esperado: somente eventos onde `approvalRequestedFromEmail = esposa@example.com`.

9. Faca login como `editor@example.com`.
10. `GET /api/events/pending-approvals`
    Esperado: lista vazia, exceto se existir evento pendente para `editor@example.com`.

11. Faca login como `esposa@example.com`.
12. `POST /api/events/{sharedEventId}/approve`
    Esperado: `200 OK`, status `APPROVED`, `approvedByEmail = esposa@example.com`, log de auditoria e criado.

13. Repita com outro evento compartilhado pendente e `POST /api/events/{eventId}/reject`.
    Esperado: `200 OK`, status `REJECTED`, log de auditoria e criado.

14. Faca login como usuario que nao e o alvo da aprovacao.
15. Tente aprovar/reprovar.
    Esperado: `403 Forbidden`.

16. Tente aprovar/reprovar evento que nao esta `PENDING_APPROVAL`.
    Esperado: `400 Bad Request`.

Regras validadas:
- Evento compartilhado exige outro membro do calendario para aprovacao.
- Endpoint de pendencias retorna aprovacoes acionaveis para o usuario logado.
- Somente usuario solicitado pode aprovar ou reprovar.

## Financeiro

1. Faca login como `jpcbnnu@gmail.com`.
2. `GET /api/finance/summary?calendarId={calendarId}&startDate=2026-05-08&endDate=2026-05-10`
   Esperado: `200 OK`.

Valores esperados com seed novo:

| Campo | Esperado |
| --- | --- |
| `expectedAmount` | `240` |
| `receivedAmount` | `110` |
| `pendingAmount` | `130` |
| `appointmentCount` | `3` |
| `paidCount` | `1` |
| `pendingCount` | `1` |
| `partiallyPaidCount` | `1` |
| `refundedCount` | `0` |

3. Faca login como `finance@example.com`.
4. `GET /api/finance/summary`
   Esperado: `200 OK`.

5. Faca login como `esposa@example.com`.
6. `GET /api/finance/summary`
   Esperado: `403 Forbidden`.

7. `GET /api/events/client-revenue?calendarId={calendarId}&period=DAILY&date=2026-05-08`
   Esperado: contabiliza apenas eventos de cliente no periodo selecionado.

Regras validadas:
- Resumo financeiro contabiliza somente eventos `CLIENT`.
- Eventos cancelados sao ignorados.
- Financeiro exige `ADMIN` global, `FINANCE` global com membro no calendario, ou papel `FINANCE`/`ADMIN` no calendario.

## Pagamentos

1. Faca login como `jpcbnnu@gmail.com`.
2. `PUT /api/events/{pendingClientEventId}/payment`
   Use `paymentStatus = PAID`, `receivedAmount = 70.00`, metodo de pagamento valido.
   Esperado: `200 OK`, status de pagamento muda para `PAID`, log de auditoria e criado.

3. `PUT /api/events/{pendingClientEventId}/payment`
   Use `paymentStatus = PENDING`, `receivedAmount > 0`.
   Esperado: `400 Bad Request`.

4. `PUT /api/events/{pendingClientEventId}/payment`
   Use `paymentStatus = PARTIALLY_PAID`, `receivedAmount = 0`.
   Esperado: `400 Bad Request`.

5. `PUT /api/events/{pendingClientEventId}/payment`
   Use `receivedAmount > amount`.
   Esperado: `400 Bad Request`.

6. `PUT /api/events/{personalEventId}/payment`
   Esperado: `400 Bad Request`.

Regras validadas:
- Somente eventos `CLIENT` podem receber dados de pagamento.
- Valores e status de pagamento precisam ser consistentes.

## Auditoria

1. Faca login como `jpcbnnu@gmail.com`.
2. Crie/edite/exclua um evento.
3. `GET /api/audit-logs?calendarId={calendarId}&entityType=EVENT&limit=20`
   Esperado: `200 OK`; logs contem `entityType`, `action`, `summary`, `oldValue`, `newValue`, `performedByEmail`, `performedAt`.

4. Atualize pagamento.
   Esperado: acao de auditoria `PAYMENT_UPDATED`.

5. Aprove/reprove evento compartilhado.
   Esperado: acoes de auditoria `APPROVED` ou `REJECTED`.

6. Adicione/atualize/remova membro de calendario.
   Esperado: acoes de auditoria `MEMBER_ADDED`, `MEMBER_ROLE_UPDATED` ou `DELETED`.

7. Faca login como `editor@example.com`.
8. `GET /api/audit-logs?calendarId={calendarId}`
   Esperado: `403 Forbidden`.

Regras validadas:
- Auditoria registra mudancas administrativas/de negocio relevantes.
- Visibilidade de auditoria do calendario exige `ADMIN` global ou `ADMIN` do calendario.

## Alvos de Automacao

Estes cenarios devem virar testes de integracao:

- Comportamento de endpoints publicos/protegidos de autenticacao.
- Acesso administrativo de usuarios e protecao do proprio admin.
- Visibilidade de calendario e `memberRole` / `canCreateEvents`.
- Adicao/atualizacao/remocao de membros e protecao contra remover dono.
- Validacao de tipo de evento e matriz de permissao (`VIEWER`, `EDITOR`, `ADMIN`).
- Validacao de alvo de aprovacao para evento compartilhado.
- Endpoint de pendencias por usuario.
- Busca global de eventos com visibilidade e limite de resultados.
- Totais financeiros e matriz de permissao financeira.
- Matriz de validacao de pagamento.
- Geracao de auditoria para cada acao importante.
