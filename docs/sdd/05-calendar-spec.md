# 05 — Especificação de calendário

## Evolução vigente — 11/11/2026

`calendarType`: PERSONAL, SHARED ou LEGACY. Novo usuário recebe PERSONAL na mesma
transação; V9 cria um PERSONAL para cada usuário legado, com índice único parcial
por owner e vínculo ADMIN. Nenhum evento antigo é movido/reclassificado e nenhuma
permissão para terceiros é criada. Calendários antigos permanecem LEGACY.

Autenticados criam SHARED; outros administradores são incluídos pelo owner/ADMIN
contextual, sem acesso global de usuários. Membros podem combinar `roles`.
POST de membro não é upsert: 404 sem conta, 409 inativo/duplicado; PUT altera papéis.
O seletor exibe todos os calendários autorizados por padrão. Feriados são uma camada
de leitura separada, não um calendário com membros e atendimentos.

As seções CURRENT/TARGET abaixo são históricas e as afirmações incompatíveis são
substituídas por este bloco e pelo complemento project-audit-and-calendar-import.

Objetivo: organizar eventos e controlar visibilidade/criação por vínculo. Atores: usuário autenticado, ADMIN global e calendar ADMIN.

## CURRENT

Pré-condição para visualizar: ADMIN global ou membro. `GET /api/calendars` retorna `memberRole` e `canCreateEvents`. Só ADMIN global cria; o criador torna-se owner e membro ADMIN. Gestão de membros aceita usuário ativo, cria ou atualiza vínculo, bloqueia remoção do owner e rejeita seu downgrade tanto no PUT quanto no upsert por POST. Erros: 400 entrada/owner, 403 permissão, 404 calendário/membro/usuário.

## TARGET

Usuário acessa um ou mais calendários autorizados. Visibilidade não implica criação. Criação comum deve respeitar escopo próprio; interação dependente de terceiro usa SHARED. A definição persistente desse escopo é OPEN (Q-001).

Critérios: AC-CAL-001/002/003 e AC-PERM-001. Dependências: `SharedCalendar`, `CalendarMember`, autorização e APIs/UI de calendário e membros. Evidências: `CalendarService.ensureOwnerRemainsAdmin`, `CalendarController`, `CalendarResponse`, `CalendarMemberRole` e `ApiSecurityIntegrationTests`.
