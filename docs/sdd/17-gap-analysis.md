# 17 — Gap Analysis

## Produto e aplicação

| ID | Requirement | Target | Current | Gap | Backend | Frontend | DB | Priority |
|---|---|---|---|---|---|---|---|---|
| GAP-001 | Agenda própria vs terceiros | comum só no próprio escopo | EDITOR cria comuns em qualquer calendário permitido | CONFLICT | alterar autorização/modelo | ajustar opções | possível vínculo owner/responsável | P0 |
| GAP-002 | Responsável do evento | identidade inequívoca | createdBy + personName textual | NEEDS_DECISION | sem responsibleUser | rótulo ambíguo | sem FK | P0 |
| GAP-003 | Bypass ADMIN | respeitar autoria/consentimento | ADMIN vê/cria/edita tudo | NEEDS_DECISION | bypass amplo | UI assume admin | — | P0 |
| GAP-004 | Serviço CLIENT | campo de serviço/responsável | workDescription/título e createdBy | PARTIALLY_IMPLEMENTED | campo dedicado ausente | exibe descrição | coluna ausente | P1 |
| GAP-005 | Fluxo SHARED | aprovação controlada | funcional; edição/reabertura ainda depende de decisão | CONFLICT | transições permissivas | espelha backend | — | P0 |
| GAP-006 | Calendários/membros UI | gestão completa | backend e página funcional | IMPLEMENTED | pronto | pronto | pronto | — |
| GAP-007 | Financeiro UI | resumo/períodos | backend e frontend completos no escopo de receitas | IMPLEMENTED | pronto | pronto | pronto | — |
| GAP-008 | Pagamentos | atualização coerente | backend + UI; update pós-pagamento protege tipo/valor e precisão | IMPLEMENTED | sim | sim | sim | — |
| GAP-009 | Permissão de pagamento | papel financeiro coerente | usa permissão de edição | NEEDS_DECISION | conflito potencial | espelha edição | — | P0 |
| GAP-010 | Pendências | fila e ações | página e painel funcionais | IMPLEMENTED | sim | sim | sim | — |
| GAP-011 | Usuários UI | administração | backend pronto; frontend incompleto | PARTIALLY_IMPLEMENTED | pronto | pendente | pronto | P1 |
| GAP-012 | Auditoria UI | consulta filtrada | backend/service; frontend incompleto | PARTIALLY_IMPLEMENTED | pronto | pendente | pronto | P1 |
| GAP-013 | Testes | regras críticas automatizadas | builds e suites passam; matrizes amplas/E2E incompletas | PARTIALLY_IMPLEMENTED | parcial | parcial | Flyway real validado | P1 |
| GAP-014 | Integridade no DB | invariantes críticas | período/valores básicos | PARTIALLY_IMPLEMENTED | valida no service | — | enums/tipos/pagamento sem CHECK | P2 |
| GAP-015 | Rotas por papel | UX protegida | Finance usa menu por capacidade e no-access; Users/Audit ainda incompletos | PARTIALLY_IMPLEMENTED | seguro | parcial | — | P1 |
| GAP-016 | Auditoria/retention | rastreabilidade governada | logs funcionais, sem retenção/máscara | PARTIALLY_IMPLEMENTED | parcial | página pendente | sem política | P2 |
| GAP-017 | Cancelamento de evento | status CANCELLED preserva histórico e sai do faturamento | implementado e testado | IMPLEMENTED | pronto | pronto | linha preservada | — |
| GAP-018 | Redação financeira sem N+1 | autorização por recurso sem consulta repetida por evento | `EventFinancialAccess` é resolvido uma vez por request/calendar e cacheado por `calendarId` nas pendências | IMPLEMENTED | pronto/testado | transparente | — | — |

## Infraestrutura e repositórios

| ID | Requirement | Current | Remaining gate | Status | Priority |
|---|---|---|---|---|---|
| GAP-INFRA-001 | PostgreSQL como runtime | PostgreSQL 17.11, Flyway V1–V7, dados 6/4/10/11/11, regressão e persistência validados | nenhum gate técnico restante | VALIDATED | — |
| GAP-INFRA-002 | Paridade monorepo/standalone | paridade final confirmada em 84/84 arquivos backend e 76/76 frontend | nenhum gate técnico restante | VALIDATED | — |
| GAP-INFRA-003 | Docker usar standalones | contexts absolutos comprovados; builds individuais e stack com três serviços healthy | nenhum gate técnico restante | VALIDATED | — |
| GAP-INFRA-004 | Acesso DBeaver | DBeaver 26.1.5 conectado com driver 42.7.13; sessões confirmadas por TCP e `pg_stat_activity` | nenhum gate técnico restante | VALIDATED | — |
| GAP-INFRA-005 | Commits independentes | commits backend/frontend criados; esta atualização SDD integra o commit de integração | SHA da integração reportado no handoff; não fazer push | COMPLETE_ON_THIS_DELIVERY | — |

`VALIDATED` descreve evidência técnica registrada no relatório 29, não resolve gaps funcionais de produto. Backend e frontend receberam commits independentes; o commit de integração é a própria entrega que contém este relatório. Seu SHA é informado no handoff porque o documento não pode autorreferenciá-lo. Nenhum push foi executado.
