# Backend Business Rule Tests

This document is a manual regression checklist for validating the main backend business rules.

Use it after running `docs/database/seed-dev-data.sql` and importing `docs/postman/shared-planner.postman_collection.json`.

## Seed Users

All seed users use password `admin`.

| Email | Global role | Calendar role | Main purpose |
| --- | --- | --- | --- |
| `jpcbnnu@gmail.com` | `ADMIN` | `ADMIN` | Full access and user creation |
| `esposa@example.com` | `USER` | `VIEWER` | Read-only calendar access |
| `editor@example.com` | `USER` | `EDITOR` | Create and edit own events |
| `finance@example.com` | `FINANCE` | `FINANCE` | Finance access without user management |

## Auth

1. `GET Health`
   Expected: `200 OK` without token.

2. `POST Login`
   Use `email = jpcbnnu@gmail.com`, `password = admin`.
   Expected: `200 OK` and collection variable `token` is filled.

3. `GET Authenticated User`
   Expected: `200 OK` and authenticated user data.

## Users

1. Login as `jpcbnnu@gmail.com`.
2. Run `POST Create User`.
   Expected: `201 Created`.

3. Login as `esposa@example.com`.
4. Run `POST Create User`.
   Expected: `403 Forbidden`.

Rule validated: only global `ADMIN` can create users.

## Calendars

1. Login as `jpcbnnu@gmail.com`.
2. Run `GET List Calendars`.
   Expected: `200 OK`; global admin can see calendars.

3. Run `POST Create Calendar`.
   Expected: `201 Created`.

4. Login as `esposa@example.com`.
5. Run `GET List Calendars`.
   Expected: `200 OK`; user sees calendars where they are a member.

6. Run `POST Create Calendar`.
   Expected: `403 Forbidden`.

7. Login as `finance@example.com`.
8. Run `POST Create Calendar`.
   Expected: `403 Forbidden`.

Rule validated: only global `ADMIN` can create calendars.

## Calendar Members

1. Login as `jpcbnnu@gmail.com`.
2. Set `memberEmail = esposa@example.com`.
3. Set `memberRole = VIEWER`, `EDITOR`, `FINANCE`, or `ADMIN`.
4. Run `POST Add Calendar Member`.
   Expected: `204 No Content`.

5. Login as `editor@example.com`.
6. Run `POST Add Calendar Member`.
   Expected: `403 Forbidden`.

Rule validated: only global `ADMIN` or calendar `ADMIN` manages members.

## Events

1. Login as `esposa@example.com` calendar `VIEWER`.
2. Run `GET List Events By Period`.
   Expected: `200 OK`.

3. Run `POST Create Client Event`.
   Expected: `403 Forbidden`.

4. Run `PUT Update Event`.
   Expected: `403 Forbidden`.

Rule validated: `VIEWER` only reads.

5. Login as `editor@example.com` calendar `EDITOR`.
6. Run `POST Create Client Event`.
   Expected: `201 Created`.

7. Run `PUT Update Event` using an event created by another user.
   Expected: `403 Forbidden`.

Rule validated: `EDITOR` creates events and edits only their own events.

## Shared Events

1. Login as `jpcbnnu@gmail.com`.
2. Run `POST Create Shared Event` with `approvalRequestedFromEmail = esposa@example.com`.
   Expected: `201 Created` and status `PENDING_APPROVAL`.

3. Login as `esposa@example.com`.
4. Run `POST Approve Event` using the shared event id.
   Expected: `200 OK` and status `APPROVED`.

5. Repeat with `POST Reject Event`.
   Expected: `200 OK` and status `REJECTED`.

Rule validated: only the requested approval user can approve or reject.

## Finance

1. Login as `jpcbnnu@gmail.com`.
2. Run `GET Finance Summary`.
   Expected: `200 OK`.

Fresh seed expected values for `2026-05-08` to `2026-05-09`:

| Field | Expected |
| --- | --- |
| `expectedAmount` | `240` |
| `receivedAmount` | `110` |
| `pendingAmount` | `130` |
| `appointmentCount` | `3` |
| `paidCount` | `1` |
| `pendingCount` | `1` |
| `partiallyPaidCount` | `1` |

Rule validated: finance summary counts only `CLIENT` events and ignores personal/shared events.

3. Login as `finance@example.com`.
4. Run `GET Finance Summary`.
   Expected: `200 OK`.

5. Login as `esposa@example.com`.
6. Run `GET Finance Summary`.
   Expected: `403 Forbidden`.

Rule validated: finance requires global `ADMIN`, global `FINANCE` as calendar member, or calendar role `FINANCE`/`ADMIN`.

## Payments

1. Login as `jpcbnnu@gmail.com`.
2. Run `PUT Update Event Payment` for `pendingClientEventId`.
   Expected: `200 OK` and payment status changes to `PAID`.

3. Run `PUT Update Event Payment` for `personalEventId`.
   Expected: `400 Bad Request`.

Rule validated: only `CLIENT` events can receive payment data.

---------------- PT-BR -----------------------

# Testes de Regras de Negocio do Backend

Este documento e um checklist manual de regressao para validar as principais regras de negocio do backend.

Use este checklist depois de executar `docs/database/seed-dev-data.sql` e importar `docs/postman/shared-planner.postman_collection.json`.

## Usuarios do Seed

Todos os usuarios do seed usam a senha `admin`.

| Email | Perfil global | Perfil no calendario | Objetivo principal |
| --- | --- | --- | --- |
| `jpcbnnu@gmail.com` | `ADMIN` | `ADMIN` | Acesso total e criacao de usuarios |
| `esposa@example.com` | `USER` | `VIEWER` | Acesso somente leitura ao calendario |
| `editor@example.com` | `USER` | `EDITOR` | Criar e editar os proprios eventos |
| `finance@example.com` | `FINANCE` | `FINANCE` | Acesso financeiro sem gestao de usuarios |

## Autenticacao

1. `GET Health`
   Esperado: `200 OK` sem token.

2. `POST Login`
   Use `email = jpcbnnu@gmail.com`, `password = admin`.
   Esperado: `200 OK` e variavel de collection `token` preenchida.

3. `GET Authenticated User`
   Esperado: `200 OK` e dados do usuario autenticado.

## Usuarios

1. Faca login como `jpcbnnu@gmail.com`.
2. Execute `POST Create User`.
   Esperado: `201 Created`.

3. Faca login como `esposa@example.com`.
4. Execute `POST Create User`.
   Esperado: `403 Forbidden`.

Regra validada: somente `ADMIN` global pode criar usuarios.

## Calendarios

1. Faca login como `jpcbnnu@gmail.com`.
2. Execute `GET List Calendars`.
   Esperado: `200 OK`; admin global consegue ver os calendarios.

3. Execute `POST Create Calendar`.
   Esperado: `201 Created`.

4. Faca login como `esposa@example.com`.
5. Execute `GET List Calendars`.
   Esperado: `200 OK`; usuario ve os calendarios em que e membro.

6. Execute `POST Create Calendar`.
   Esperado: `403 Forbidden`.

7. Faca login como `finance@example.com`.
8. Execute `POST Create Calendar`.
   Esperado: `403 Forbidden`.

Regra validada: somente `ADMIN` global pode criar calendarios.

## Membros do Calendario

1. Faca login como `jpcbnnu@gmail.com`.
2. Defina `memberEmail = esposa@example.com`.
3. Defina `memberRole = VIEWER`, `EDITOR`, `FINANCE` ou `ADMIN`.
4. Execute `POST Add Calendar Member`.
   Esperado: `204 No Content`.

5. Faca login como `editor@example.com`.
6. Execute `POST Add Calendar Member`.
   Esperado: `403 Forbidden`.

Regra validada: somente `ADMIN` global ou `ADMIN` do calendario gerencia membros.

## Eventos

1. Faca login como `esposa@example.com`, que e `VIEWER` no calendario.
2. Execute `GET List Events By Period`.
   Esperado: `200 OK`.

3. Execute `POST Create Client Event`.
   Esperado: `403 Forbidden`.

4. Execute `PUT Update Event`.
   Esperado: `403 Forbidden`.

Regra validada: `VIEWER` somente visualiza.

5. Faca login como `editor@example.com`, que e `EDITOR` no calendario.
6. Execute `POST Create Client Event`.
   Esperado: `201 Created`.

7. Execute `PUT Update Event` usando um evento criado por outro usuario.
   Esperado: `403 Forbidden`.

Regra validada: `EDITOR` cria eventos e edita somente os proprios eventos.

## Eventos Compartilhados

1. Faca login como `jpcbnnu@gmail.com`.
2. Execute `POST Create Shared Event` com `approvalRequestedFromEmail = esposa@example.com`.
   Esperado: `201 Created` e status `PENDING_APPROVAL`.

3. Faca login como `esposa@example.com`.
4. Execute `POST Approve Event` usando o id do evento compartilhado.
   Esperado: `200 OK` e status `APPROVED`.

5. Repita com `POST Reject Event`.
   Esperado: `200 OK` e status `REJECTED`.

Regra validada: somente o usuario solicitado para aprovacao pode aprovar ou rejeitar.

## Financeiro

1. Faca login como `jpcbnnu@gmail.com`.
2. Execute `GET Finance Summary`.
   Esperado: `200 OK`.

Valores esperados com seed novo para `2026-05-08` ate `2026-05-09`:

| Campo | Esperado |
| --- | --- |
| `expectedAmount` | `240` |
| `receivedAmount` | `110` |
| `pendingAmount` | `130` |
| `appointmentCount` | `3` |
| `paidCount` | `1` |
| `pendingCount` | `1` |
| `partiallyPaidCount` | `1` |

Regra validada: resumo financeiro contabiliza somente eventos `CLIENT` e ignora eventos pessoais/compartilhados.

3. Faca login como `finance@example.com`.
4. Execute `GET Finance Summary`.
   Esperado: `200 OK`.

5. Faca login como `esposa@example.com`.
6. Execute `GET Finance Summary`.
   Esperado: `403 Forbidden`.

Regra validada: financeiro exige `ADMIN` global, `FINANCE` global membro do calendario, ou perfil `FINANCE`/`ADMIN` no calendario.

## Pagamentos

1. Faca login como `jpcbnnu@gmail.com`.
2. Execute `PUT Update Event Payment` para `pendingClientEventId`.
   Esperado: `200 OK` e status de pagamento alterado para `PAID`.

3. Execute `PUT Update Event Payment` para `personalEventId`.
   Esperado: `400 Bad Request`.

Regra validada: somente eventos `CLIENT` podem receber dados de pagamento.
