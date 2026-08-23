# 05 — Especificação de calendário

Objetivo: organizar eventos e controlar visibilidade/criação por vínculo. Atores: usuário autenticado, ADMIN global e calendar ADMIN.

## CURRENT

Pré-condição para visualizar: ADMIN global ou membro. `GET /api/calendars` retorna `memberRole` e `canCreateEvents`. Só ADMIN global cria; o criador torna-se owner e membro ADMIN. Gestão de membros aceita usuário ativo, cria ou atualiza vínculo, bloqueia remoção do owner e rejeita seu downgrade tanto no PUT quanto no upsert por POST. Erros: 400 entrada/owner, 403 permissão, 404 calendário/membro/usuário.

## TARGET

Usuário acessa um ou mais calendários autorizados. Visibilidade não implica criação. Criação comum deve respeitar escopo próprio; interação dependente de terceiro usa SHARED. A definição persistente desse escopo é OPEN (Q-001).

Critérios: AC-CAL-001/002/003 e AC-PERM-001. Dependências: `SharedCalendar`, `CalendarMember`, autorização e APIs/UI de calendário e membros. Evidências: `CalendarService.ensureOwnerRemainsAdmin`, `CalendarController`, `CalendarResponse`, `CalendarMemberRole` e `ApiSecurityIntegrationTests`.
