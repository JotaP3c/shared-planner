# 08 — Evento SHARED

## Evolução de consentimento — 11/11/2026

Em calendários `SHARED` novos, CLIENT/PERSONAL/SHARED exigem participantes
designados (padrão: demais membros ativos). O criador não vota. `approvals` contém
resposta por usuário e rodada; todas APPROVED → evento APPROVED; uma REJECTED →
REJECTED. Cada nova edição reabre rodada e conserva as respostas antigas no histórico
`GET /events/{id}/approval-history`. Somente designados ainda ativos/membros podem
responder, e a decisão é serializada por lock do evento.

O tipo de evento continua independente do tipo do calendário: CLIENT conserva
campos financeiros e confirmação de atendimento; SHARED não gera receita. Calendários
PERSONAL podem receber convites SHARED explícitos. LEGACY conserva o caminho singular
anterior, incluindo sua validação de aprovador herdado. Nenhuma aprovação é automática.
O restante deste documento descreve a baseline singular por compatibilidade.

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

`CANCELLED` é terminal para edição, pagamento e novo cancelamento. O alvo só permanece apto a listar, aprovar ou rejeitar enquanto for usuário ativo e membro atual do calendário; remover o vínculo revoga imediatamente essas ações sem apagar o evento pendente. Alvo SHARED com papel ADMIN/EDITOR ainda pode editar o evento inteiro antes do cancelamento. TARGET exige decidir se edição reinicia aprovação e quem pode editar (Q-004).

UI CURRENT: fila `/pending`, painel no calendário e detalhe permitem aprovar/rejeitar. Critérios: AC-SHARED-001–005. Evidência: `EventRepository.findPendingApprovalsForCurrentMember`, `EventService.ensureApprovalTarget`, `update`, `PendingPage` e regressão de alvo removido em `ApiSecurityIntegrationTests`.
