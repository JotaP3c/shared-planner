# 03 — Regras de negócio

| ID | Regra | Estado | Fonte/evidência |
|---|---|---|---|
| BR-AUTH-001 | Apenas health e login são públicos; demais APIs exigem JWT válido. | CONFIRMED | `SecurityConfig.securityFilterChain` |
| BR-AUTH-002 | Usuário inativo não autentica/não é resolvido. | CONFIRMED | `ApplicationUserDetailsService`, `findByEmailIgnoreCaseAndActiveTrue` |
| BR-USER-001 | Somente ADMIN global lista/cria/edita usuários. | CONFIRMED | `AuthorizationService.ensureSystemAdmin` |
| BR-USER-002 | ADMIN não desativa nem remove o próprio papel ADMIN. | CONFIRMED | `UserService.update` |
| BR-CAL-001 | Não-admin vê somente calendários de que é membro; ADMIN global vê todos. | CONFIRMED | `CalendarService.list` |
| BR-CAL-002 | CURRENT: apenas ADMIN global cria calendário e vira owner/ADMIN. | CONFIRMED | `CalendarService.create` |
| BR-CAL-003 | ADMIN global ou ADMIN do calendário gerencia membros; owner não é removível. | CONFIRMED | `ensureCanManageCalendar`, `removeMember` |
| BR-CAL-004 | TARGET: visualizar calendário não concede criação. | CONFIRMED | requisito-alvo + `canCreateEvents` |
| BR-EVT-001 | Tipos são CLIENT, PERSONAL, SHARED; fim deve ser posterior ao início. | CONFIRMED | enums, `EventService.validatePeriod` |
| BR-EVT-002 | ADMIN/EDITOR de calendário criam; VIEWER/FINANCE não criam; ADMIN global ignora vínculo. | CONFIRMED | `CalendarMemberRole`, `ensureCanCreateEvent` |
| BR-EVT-003 | EDITOR edita/cancela próprios; calendar ADMIN e global ADMIN editam todos. | CONFIRMED | `ensureCanEditEvent` |
| BR-EVT-004 | TARGET: evento comum não deve ser criado em nome de terceiro; participação dependente usa SHARED. | CONFIRMED | requisito-alvo; conflito com BR-EVT-002 |
| BR-EVT-005 | Cancelamento preserva o evento como CANCELLED, bloqueia novas alterações e o retira de busca/faturamento. | CONFIRMED | `EventService.delete/ensureNotCancelled`, teste de integração |
| BR-CLIENT-001 | CLIENT exige `clientName`, `workDescription`, `amount`; nasce SCHEDULED/PENDING. | CONFIRMED | `validateEventFields`, `Event.fill` |
| BR-PERSONAL-001 | PERSONAL exige `personName` e nasce SCHEDULED. | CONFIRMED | `validateEventFields`, `create` |
| BR-SHARED-001 | SHARED exige outro usuário ativo, membro do calendário, como alvo e nasce PENDING_APPROVAL. | CONFIRMED | `approvalUser`, `create` |
| BR-SHARED-002 | Só o alvo pode aprovar/rejeitar evento pendente. | CONFIRMED | `ensureApprovalTarget` |
| BR-SHARED-003 | ADMIN global lista todas as pendências, mas não pode aprová-las se não for alvo. | CONFIRMED | `listPendingApprovals`, `ensureApprovalTarget` |
| BR-FIN-001 | Financeiro soma somente CLIENT não CANCELLED no intervalo. | CONFIRMED | `EventRepository.summarizeFinance` |
| BR-FIN-002 | DAILY, WEEKLY, BIWEEKLY e MONTHLY existem; resumo aceita intervalo inclusivo customizado. | CONFIRMED | `RevenuePeriod`, `periodRange`, `FinanceService.summarize` |
| BR-FIN-003 | Acesso: ADMIN global; FINANCE global se membro; calendar ADMIN/FINANCE. | CONFIRMED | `ensureCanUseFinance` |
| BR-PAY-001 | Pagamento só se aplica a CLIENT e deve manter status/valor/método coerentes. | CONFIRMED | `validatePayment` |
| BR-PAY-002 | Atualizar pagamento usa a mesma permissão de editar evento. | CONFIRMED | `updatePayment` → `ensureCanEditEvent` |
| BR-AUDIT-001 | Criação/alteração/cancelamento, pagamento, aprovação, membros e usuários geram log. | CONFIRMED | chamadas `auditService.log` |
| BR-AUDIT-002 | Todos logs: ADMIN global; por calendário: calendar ADMIN. | CONFIRMED | `ensureCanViewAuditLogs` |
