# 99 — Questões em aberto

Atualização de 2026-08-22: o hardening de redaction financeira, revogação de membro SHARED, owner, integridade de pagamento, JWT, interceptor e loopback não decidiu implicitamente nenhuma questão abaixo. Em especial, Q-004 e Q-005 permanecem `OPEN`; a implementação preserva a política CURRENT enquanto fecha falhas independentes de confidencialidade/integridade.

## Q-001

Contexto: calendário pode ter owner, ADMIN e EDITOR, mas TARGET diz que evento comum deve estar na agenda própria. Pergunta: “própria” significa calendário cujo usuário é owner, um calendário pessoal tipado, ou evento com responsável igual ao ator? Impacto: autorização, dados, UI e migração. Opções: A) owner; B) tipo de calendário; C) responsibleUser. Recomendação técnica: C combinado com tipo explícito de calendário se houver agendas coletivas. Status: OPEN.

## Q-002

Contexto: `personName` é texto e CLIENT usa `createdBy` como aproximação de profissional. Pergunta: responsável deve ser FK para User e obrigatório em quais tipos? Impacto: modelo, API, exibição, permissões. Opções: A) criador sempre; B) `responsibleUserId`; C) texto. Recomendação: B, com default explícito no ator. Status: OPEN.

## Q-003

Contexto: ADMIN global possui bypass total. Pergunta: pode criar/editar comuns em nome de terceiros ou apenas administrar/diagnosticar? Impacto: princípio de consentimento e matriz. Opções: A) bypass atual; B) leitura/admin sem autoria; C) impersonação auditada. Recomendação: B. Status: OPEN.

## Q-004

Contexto: editar SHARED redefine PENDING_APPROVAL e alvo ADMIN/EDITOR pode editar o evento completo. Pergunta: quais campos/atores podem editar antes/depois da decisão e uma edição aprovada exige nova aprovação? Impacto: máquina de estados e auditoria. Recomendação: criador edita; alteração material reabre aprovação; alvo apenas decide. Status: OPEN.

## Q-005

Contexto: FINANCE consulta mas não altera pagamento; EDITOR altera pagamento do próprio CLIENT. Pergunta: pagamento depende de capacidade financeira, autoria ou ambas? Impacto: segurança financeira e UI. Recomendação: capacidade financeira explícita; definir exceção do profissional. Status: OPEN.

## Q-006

Contexto: auditoria guarda snapshots com dados pessoais/financeiros indefinidamente. Pergunta: prazo de retenção, acesso, mascaramento e exportação? Impacto: privacidade, storage e compliance. Recomendação: política de retenção e minimização antes de produção. Status: OPEN.

## Q-007

Contexto: o enum e as queries conhecem `CANCELLED`. Decisão aplicada: cancelamento normal preserva a linha como `CANCELLED`; eventual purge administrativo continua fora do escopo. Evidência: BR-EVT-005, AC-EVT-001 e teste de integração. Status: RESOLVED.

## Atualização 2026-11-11 — decisões ainda sem resposta do dono

Nenhuma questão abaixo foi decidida pela consolidação/remodelagem; o comportamento atual
foi preservado e, quando relevante, fixado por teste.

| Item | Contexto | Opções | Recomendação | Impacto de adiar |
|---|---|---|---|---|
| Q-001..Q-003 | ver acima | ver acima | ver acima | regras de autoria/ADMIN seguem as atuais |
| Q-004 | edição SHARED | ver acima | criador edita; mudança material reabre | Pendências respeita a política atual; reabertura agora aparece corretamente |
| Q-005 | quem altera pagamento | A) autoria/edição (atual); B) capacidade financeira; C) ambas | B com exceção explícita do profissional | `PaymentUpdateMatrixIntegrationTests` documenta: FINANCE e VIEWER recebem 403, EDITOR só no próprio evento |
| Q-006 | retenção/minimização de auditoria | prazo fixo; minimizar snapshots; mascarar | política antes de produção | página Audit continua placeholder |
| BR-PAY-003 histórico | PAID → PENDING libera troca de tipo/valor? | A) estado atual (comportamento hoje); B) qualquer histórico de pagamento bloqueia; C) retificação financeira auditada | B ou C | teste registra que PAID→PENDING zera o recebido e volta a PENDING |
| BLG-SEC-007 | sessão JWT em localStorage | manter; cookie HttpOnly + CSRF; tokens curtos + refresh | cookie HttpOnly com revisão conjunta backend/SSR/CSRF | risco XSS → roubo de token permanece |
| BLG-BR-007 | Settings | só aparência (entregue); perfil editável; notificações | manter mínimo até haver API | sem edição de perfil |
| BLG-UX-004 | eventos multidia | não suportar (atual); data de término separada | só com requisito | atalho não oferece durações além de 23:59 |
| E2E/CI (proposto) | sem ferramenta de E2E | Playwright; Cypress | Playwright com dados isolados | fluxos completos só validados manualmente |

## Futuras possibilidades (não requisitos)

Recorrência, bloqueio de conflito, notificações, integrações externas, parcelamento, múltiplas moedas, timezone, comissão e divisão de receita permanecem fora do escopo até decisão explícita.
