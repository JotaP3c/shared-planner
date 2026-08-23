# Shared Planner — Spec-Driven Development

Este diretório é a **Functional / Specification Source of Truth** do Shared Planner. Ele descreve produto, arquitetura, contratos, infraestrutura, critérios de aceite e evidências sem confundir o estado observado (**CURRENT / AS-IS**) com o objetivo aprovado (**TARGET / TO-BE**).

## Topologia de trabalho

```text
                    SDD / CODEX
                        │
                        ▼
              C:\git\shared-planner
              Integration Monorepo
                 /             \
                /               \
        backend copy         frontend copy
             │                    │
             │ sync               │ sync
             ▼                    ▼
shared-planner-backend    shared-planner-frontend
             │                    │
             └────────┬───────────┘
                      │
                    Docker
                      │
               Backend + Frontend
                      │
                      ▼
                  PostgreSQL
```

| Responsabilidade | Source of Truth |
|---|---|
| Especificação funcional e técnica | `C:\git\shared-planner\docs\sdd` |
| Contexto integrado backend + frontend | `C:\git\shared-planner` |
| Fonte implantável do backend | `C:\git\shared-planner-backend` |
| Fonte implantável do frontend | `C:\git\shared-planner-frontend` |
| Orquestração local | `C:\git\shared-planner\compose.yaml` |

## Navegação

| Tema | Documento |
|---|---|
| Visão e estado atual | [00](00-product-vision.md), [01](01-current-state.md) |
| Domínio e regras | [02](02-domain-model.md), [03](03-business-rules.md), [04](04-permissions.md) |
| Specs funcionais | [05](05-calendar-spec.md) a [10](10-payment-spec.md), [14](14-audit-spec.md) |
| Contratos e dados | [11](11-api-contracts.md), [12](12-data-model.md) |
| UX | [13](13-frontend-flows.md) |
| Validação funcional | [15](15-acceptance-criteria.md), [16](16-test-strategy.md), [20](20-validation-report.md) |
| Entrega e impacto | [17](17-gap-analysis.md), [18](18-implementation-plan.md), [19](19-traceability-matrix.md), [21](21-development-progress.md) |
| PostgreSQL e containers | [22](22-postgresql-migration-spec.md), [23](23-containerization-spec.md), [25](25-infrastructure-acceptance-criteria.md) |
| Arquitetura multi-repositório | [24](24-repository-split-spec.md), [26](26-multi-repository-sync-spec.md) |
| Acesso local e credenciais de teste | [27](27-local-access-and-test-credentials-spec.md) |
| Auditoria funcional | [28 — completude](28-functional-completeness-audit.md) |
| Segurança | [29 — spec](29-security-spec.md), [30 — threat model](30-threat-model.md), [31 — auditoria](31-security-audit-report.md), [32 — critérios](32-security-acceptance-criteria.md) |
| Backlog priorizado | [33](33-development-backlog.md) |
| Transferência de dados | [28 — plano PostgreSQL](28-postgresql-data-transfer-plan.md) |
| Evidência de infraestrutura | [29 — validação de infraestrutura](29-infrastructure-validation-report.md) |
| Decisões pendentes | [99](99-open-questions.md) |

## Estado desta baseline

- `MULTI_REPOSITORY_VALIDATED`
- `POSTGRESQL_VALIDATED`
- `DOCKER_STACK_HEALTHY`
- `NX_AND_SVM_ENABLED`
- `DBEAVER_CONNECTION_VALIDATED`
- `INDEPENDENT_COMMITS_COMPLETE_ON_THIS_DELIVERY`
- `PUSH_NOT_PERFORMED`
- `INTEGRATED_SECURITY_GATE_S0_0_S1_0`
- `FINANCE_REVENUE_SUMMARY_IMPLEMENTED`
- `STANDALONE_RESYNC_VALIDATED_84_76`

Os gates de infraestrutura históricos estão documentados no relatório de infraestrutura 29. O incremento atual possui 16 testes backend, 31 testes frontend e build SSR com 9 rotas; os dois S1 foram encerrados e Finance foi implementado. Os standalones foram sincronizados, revalidados e mantêm paridade oficial 84/84 no backend e 76/76 no frontend. O produto mantém decisões funcionais abertas em [99](99-open-questions.md), especialmente Q-004/Q-005, sem invalidar os controles independentes já aplicados.

## Fluxo SDD

```text
Business Requirement → Specification → Acceptance Criteria
→ Implementation Plan → Code → Tests → Validation → Independent Commits
```

Uma mudança começa pela spec, segue pela implementação integrada, sincronização explícita das cópias implantáveis, verificação de paridade e testes. Código no monorepo nunca é considerado pronto para Docker antes da sincronização com os repositórios standalone.
