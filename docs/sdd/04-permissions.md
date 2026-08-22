# 04 — Permissões

## CURRENT — matriz efetiva do backend

`✓` permitido; `próprio` depende de autoria; `—` negado. Global ADMIN é bypass nas regras de calendário.

| Ação | Global ADMIN | Calendar ADMIN | EDITOR | FINANCE | VIEWER |
|---|---:|---:|---:|---:|---:|
| Visualizar calendário/eventos | ✓ todos | ✓ | ✓ | ✓ | ✓ |
| Criar calendário | ✓ | — | — | — | — |
| Criar evento | ✓ | ✓ | ✓ | — | — |
| Editar/cancelar próprio | ✓ | ✓ | próprio | — | — |
| Editar/cancelar de outro | ✓ | ✓ | somente SHARED se alvo¹ | — | — |
| Visualizar financeiro | ✓ | ✓ | — | ✓ | — |
| Alterar pagamento | ✓ | ✓ | próprio | — | — |
| Gerenciar membros | ✓ | ✓ | — | — | — |
| Auditoria | ✓ todos | ✓ do calendário | — | — | — |
| Aprovar/rejeitar SHARED | somente se alvo | somente se alvo | somente se alvo | somente se alvo | somente se alvo |

¹ `ensureCanEditEvent` permite ao alvo SHARED com papel que cria (`ADMIN`/`EDITOR`) alterar o evento inteiro, além dos endpoints específicos de aprovação.

Global `FINANCE` não tem acesso universal: precisa ser membro do calendário. Papel global e papel contextual são avaliados em `AuthorizationService`.

## TARGET

| Ação | Global ADMIN | Calendar ADMIN | EDITOR | FINANCE | VIEWER |
|---|---:|---:|---:|---:|---:|
| Visualizar autorizado | política admin² | ✓ | ✓ | ✓ | ✓ |
| Criar evento próprio | política admin² | somente escopo próprio² | somente escopo próprio² | — | — |
| Criar em nome de terceiro | —² | —² | — | — | — |
| Solicitar participação SHARED | política admin² | ✓ | ✓ | — | — |
| Aprovar/rejeitar | somente alvo | somente alvo | somente alvo | somente alvo | somente alvo |
| Financeiro/pagamento/membros/auditoria | manter CURRENT até decisão | manter CURRENT | manter CURRENT | manter CURRENT | manter CURRENT |

² Necessita definir “agenda própria” e alcance do bypass ADMIN (Q-001/Q-003). Evidência principal: `AuthorizationService.java`, `CalendarMemberRole.java`.
