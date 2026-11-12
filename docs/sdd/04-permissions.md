# 04 — Permissões

## Matriz vigente — evolução de calendários (11/11/2026)

Papéis globais continuam `ADMIN`, `FINANCE`, `USER`; os nomes SYSTEM_* do requisito
são conceitos, não uma troca incompatível de enums. `memberRoles`/`roles` permitem
combinar EDITOR+FINANCE. `memberRole`/`role` permanecem para clientes antigos.

| Capacidade | Regra vigente |
|---|---|
| Usuários globais | somente ADMIN global |
| Pessoal próprio | owner sempre ADMIN contextual, independente do papel global |
| Criar compartilhado | usuário autenticado, vira owner/ADMIN contextual |
| Ver calendário | membership ou bypass ADMIN global já existente |
| Criar evento | ADMIN/EDITOR contextual; bypass global preservado |
| Gerenciar membros | ADMIN contextual; bypass global preservado |
| Consultar financeiro | ADMIN/FINANCE contextual ou FINANCE global com membership |
| EDITOR+FINANCE | edição conforme autoria + consulta financeira, sem gestão de membros |
| Aprovar evento | designado ativo, membro atual, resposta pendente; nunca criador |

A tabela CURRENT abaixo documenta a baseline anterior; não usar seu papel singular
para remover capacidades da evolução. Q-003 (bypass) e Q-005 (alterar pagamento)
continuam sem política nova. Consultar o complemento e testes de evolução.

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

Global `FINANCE` não tem acesso universal: precisa ser membro do calendário. Papel global e papel contextual são avaliados em `AuthorizationService`. A resposta de evento só inclui campos financeiros para global ADMIN, global FINANCE membro, calendar ADMIN/FINANCE ou EDITOR autor conforme a capacidade CURRENT de pagamento; demais membros recebem esses campos omitidos. O frontend não renderiza valores nem controles de pagamento quando o contrato os omite.

O owner permanece obrigatoriamente membro `ADMIN`: DELETE, PUT e o upsert por POST rejeitam remoção ou downgrade. A remoção de qualquer outro alvo SHARED revoga imediatamente a fila e approve/reject. Essas correções não alteram a política de edição SHARED (Q-004) nem decidem quem deve alterar pagamento no modelo futuro (Q-005).

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
