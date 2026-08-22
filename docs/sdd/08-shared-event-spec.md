# 08 — Evento SHARED

Objetivo: obter consentimento de outro membro para compromisso conjunto.

Pré-condições: criador pode criar no calendário; alvo informado, ativo, membro e diferente do solicitante. Criação produz `PENDING_APPROVAL`. Só `approvalRequestedFrom` pode aprovar/rejeitar; status deve estar pendente.

```mermaid
stateDiagram-v2
  [*] --> SCHEDULED: cria CLIENT/PERSONAL
  [*] --> PENDING_APPROVAL: cria/edita SHARED
  PENDING_APPROVAL --> APPROVED: alvo aprova
  PENDING_APPROVAL --> REJECTED: alvo rejeita
  SCHEDULED --> SCHEDULED: edita não-SHARED
  APPROVED --> PENDING_APPROVAL: edita como SHARED
  REJECTED --> PENDING_APPROVAL: edita como SHARED
  SCHEDULED --> CANCELLED: cancela
  PENDING_APPROVAL --> CANCELLED: cancela
  APPROVED --> CANCELLED: cancela
  REJECTED --> CANCELLED: cancela
```

`CANCELLED` é terminal para edição, pagamento e novo cancelamento. Alvo SHARED com papel ADMIN/EDITOR ainda pode editar o evento inteiro antes do cancelamento. TARGET exige decidir se edição reinicia aprovação e quem pode editar (Q-004).

UI CURRENT: fila `/pending`, painel no calendário e detalhe permitem aprovar/rejeitar. Critérios: AC-SHARED-001–004. Evidência: `EventService.approvalUser`, `ensureApprovalTarget`, `update`, `PendingPage`.
