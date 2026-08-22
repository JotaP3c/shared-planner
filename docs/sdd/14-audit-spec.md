# 14 — Auditoria

Objetivo: rastrear mudanças relevantes com entidade, ID, calendário opcional, ação, resumo, valor anterior/posterior, ator e instante.

| Entidade | Operações CURRENT |
|---|---|
| USER | CREATED, UPDATED |
| CALENDAR | CREATED |
| CALENDAR_MEMBER | MEMBER_ADDED, MEMBER_ROLE_UPDATED, DELETED |
| EVENT | CREATED, UPDATED, CANCELLED, APPROVED, REJECTED, PAYMENT_UPDATED |

Leitura: ADMIN global consulta tudo; calendar ADMIN deve informar `calendarId` e consulta aquele calendário. Filtros: calendário, tipo, entidade e limite (default 50, max 100). Logs ordenados descendentemente. `summary` é truncado a 500; snapshots são strings sem esquema e podem conter dados pessoais/financeiros.

Lacunas: login/logout não são auditados; calendário não tem update endpoint; retenção, mascaramento e imutabilidade em nível DB não estão definidos (Q-006).

Critérios: AC-AUDIT-001/002. Evidência: `AuditService`, `AuditLog`, chamadas `auditService.log`, V6.
