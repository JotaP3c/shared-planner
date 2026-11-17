# 34 — Auditoria do backlog e gate da Etapa 3

Data: 17/11/2026. Escopo: documentação e verificações somente; sem alterações de código,
novas funcionalidades, migrations, importações, commits ou pushes.

## Resultado

A [matriz vigente completa](33-development-backlog.md) tem 79 IDs BLG únicos:

| Estado | Quantidade |
|---|---:|
| DONE | 44 |
| PARTIAL | 22 |
| OPEN | 4 |
| BUG | 1 |
| BLOCKED | 8 |
| Total pendente (não DONE) | 35 |

As dez referências complementares CAL-01/02/03, APP-01, CLI-01, REC-01, IMP-01,
HOL-01, FIN-01 e UI-01 foram avaliadas separadamente: dez DONE no escopo aprovado.
Total combinado: 89 referências, 54 concluídas e 35 pendentes. IDs repetidos,
como FE-005, contam uma vez; Q/SEC-FIND são vínculos, não novas tarefas.

DONE exige implementação e evidência de teste pertinente. PARTIAL preserva uma
entrega válida cujo critério integral não terminou. OPEN indica ausência do mecanismo.
BUG indica regressão confirmada por verificação atual; BLOCKED exige decisão ou
verificação externa que esta auditoria não pode fabricar. A classificação não muda P0–P4.

Não foram reproduzidos novos bugs funcionais P0/P1. Os BLG-BUG-001–015 estão corrigidos
com regressões; cobertura/constraints complementares continuam em seus próprios IDs.
O novo estado BUG é **BLG-SEC-005**, por audit completo novamente não zero.
Isso não comprova exploração ou vulnerabilidade no runtime da aplicação.

## Evidências verificadas

### E1 — Backend

Executado `mvnw.cmd test`, com JDK 17 explícito e perfil de testes H2:
**150 contabilizados, zero falhas, zero erros, um ignorado** — 149 executados com sucesso.
`application-test.properties` usa H2 e desabilita Flyway; não se confunde esse resultado
com execução real das migrations PostgreSQL.

Suítes inspecionadas e executadas: ApiSecurityIntegrationTests, AccessControlIntegrationTests,
AuthorizationServiceTests, CalendarMemberIntegrationTests, CalendarEvolutionIntegrationTests,
SharedEventApproverIntegrationTests, EventFinancialIntegrityIntegrationTests,
PaymentUpdateMatrixIntegrationTests, EventCancellationIntegrationTests,
AppointmentConfirmationIntegrationTests, FinanceSummaryIntegrationTests,
QuarterFinanceIntegrationTests, FinanceExportIntegrationTests, FinanceExportLimitsTests,
UserAdministrationIntegrationTests, RecurrenceEngineTests, IcalendarParserTests,
CalendarImportAndRecurrenceIntegrationTests e HolidayServiceTests.

`PostgresMigrationIntegrationTests` exige `PLANNER_MIGRATION_TEST_URL` para a porta
isolada 54629 e foi ignorado por não haver opt-in nesta execução. Evidências anteriores
de V1–V12 e restore foram lidas no relatório de perfis, mas não reexecutadas nem
apresentadas como resultados atuais. Testes de lock sequenciais não provam corridas.

Rastreabilidade de bugs: 001 → EventFinancialIntegrity/PaymentUpdateMatrix;
002/003 → ApiSecurity/CalendarMember/SharedEventApprover; 009 → SharedEventApprover;
015 → CalendarMember. Confirmação FE-010 → AppointmentConfirmation.

### E2 — Frontend

Executado `npm.cmd test -- --watch=false`: **197/197, 28 arquivos**.
Specs reais, não apenas scaffold: calendar-page (32), finance-page, members-page,
users-page, access-page, audit-page, pending-page, app-shell, auth/interceptor/guards,
calendar-permissions, theme/login/settings, importação, confirmação, recorrência e DS.

Rastreabilidade dos bugs: 004/005/011/012 → calendar-page; 006/014 → members-page;
007/011 → app-shell; 008/010 → pending-page; 013 → theme/login; 014 → finance-page.
`CalendarCreator` tem testes positivo e negação sem grant; BLG-FE-008 não está OPEN.
Estados assíncronos foram confirmados: BLG-TEST-007 não fica PARTIAL por texto antigo.

Os testes de navegador existentes interceptam HTTP em fixtures. São úteis para
responsividade, teclado, sessão/menus, filtros e downloads; não equivalem a E2E integrado
com servidor/banco reais. BLG-TEST-009 muda de OPEN para PARTIAL, não para DONE.

Os hashes atuais dos 159 arquivos do frontend foram comparados ao manifesto final da
validação profissional: **zero diferenças**. Portanto os builds de produção aprovados,
764 verificações/101 capturas, catálogo excluído da produção, quatro downloads XLSX,
contraste por amostragem e temas daquele relatório são evidência recente aplicável.
Não foram repetidos builds e screenshots sem mudança de fonte; testes foram repetidos.
Não se declara certificação WCAG ou teste manual com leitor de tela.

### E3 — Implementação e infraestrutura

| Área | Código inspecionado | Conclusão |
|---|---|---|
| Autorização | `backend/.../config/AuthorizationService.java`, `access/`, `frontend/.../core/auth/calendar-permissions.ts`, guards | Grants próprios/terceiros, pagamento e exportação independentes; vínculo contextual; ADMIN essencial tem bypass explícito |
| Pagamento | `event/EventService.java`, migrations V2/V3/V8/V12 | Serviço e matriz fortes; constraints de período/valores não negativos existem, mas invariantes cruzadas não são integralmente garantidas pelo DB |
| Cadastro | `user/CreateUserRequest.java`, `UserService.java` | Nome 120/e-mail 180 e saveAndFlush com conflito 409 existem; não perpetuar antigos gaps inferidos como bugs atuais |
| Auditoria | `audit/AuditService.java`, `AuditLogResponse.java`, tela/spec audit | Filtros e limite default 50/máximo 100 existem; oldValue/newValue continuam retornados; falta retenção e prova positiva completa de boundaries |
| Autenticação | `auth/JwtService.java`, `config/SecurityConfig.java` | Secret externo, issuer, HS256 e usuário ativo; BCrypt/tamanho de senha; sem limiter de login, logout revogável ou audience adicional |
| Sessão | AuthService/interceptor | localStorage permanece; decisão cookie/CSP não foi presumida |
| Infra | `compose.yaml`, `frontend/src/server.ts`, Dockerfiles | Loopback padrão; usuário PostgreSQL de bootstrap reutilizado; não há terminação TLS operacional/CSP validada; proxy sem timeout/filtro hop-by-hop explícitos |
| Backup | `scripts/backup-development-database.ps1`, relatório de perfis | pg_dump, catálogo e SHA256 existem e restore anterior foi evidenciado; retenção/restore periódico não automatizados |
| Fluxos | Calendários/eventos/importação/financeiro/perfis e respectivas specs | Pessoais, aprovações, recorrências, ICS e XLSX existentes; preservar, não recriar |

As referências abreviadas `backend/...` correspondem a `src/main/java/com/sharedplanner/`;
as de frontend a `src/app/`. Não foram lidos/publicados valores de .env, tokens ou senhas.
Não houve conexão ou escrita em dados reais. ACL/TLS/runtime atuais não foram certificados.
Headers padrão Spring não significam ausência total de headers nem hardening concluído.

### E4 — Specs e checkpoints anteriores

Lidos backlog 33, questões 99, project-state, segurança 29/31/32, critérios e relatórios
de infraestrutura, `project-audit-and-calendar-import`, `roles-calendar-finance-enhancements`
(design/tasks/prompt-review/validation/publication) e `professional-design-system`.

Correções documentais relevantes:

- Q-001 resolvida para pessoal automático e único (V9 e testes).
- Q-005 resolvida no escopo aprovado por FINANCE_MANAGE/FINANCE_MANAGE_OWN e perfis
  configuráveis, sem mudar autoria. Não manter o pagamento inteiro bloqueado por enum antigo.
- BLG-BR-007/Settings resolvida somente para aparência e identidade de leitura (FE-009);
  edição de perfil ou preferências novas não são requisitos faltantes presumidos.
- Q-002, Q-003 e Q-006 continuam decisões abertas. Q-004 resolveu consentimento/rodadas,
  mas não toda política adicional de edição por campo e compatibilidade LEGACY.
- Recorrência, ICS e Excel deixaram de ser possibilidades: foram entregues e testados.
- Detalhe de recorrência funciona; selo na grade exige metadados não expostos na listagem.
  Isso pode ser discutido depois, sem inventar informação a partir de títulos.

### E5 — Git, paridade e CI

HEADs auditados: monorepo `f9c0853`, backend `9f8e2b8`, frontend `cecfd3e`.
Histórico contém cinco commits frontend por escopo e documentação profissional;
backend contém RBAC/V11, proveniência/V12 e XLSX com gráficos nativos.
`HEAD...origin/main` nas referências locais: **0/0 nos três**; sem nova consulta remota
nesta auditoria. Standalones inicialmente limpos; monorepo tinha apenas `.vscode/` e
`docs/reffs/` locais não rastreados, preservados.

`check-repository-sync.ps1` executado: backend **149/149**, frontend **159/159**, PASS.
Históricos/SHA diferentes entre repos são esperados: equivalência foi verificada por conteúdo,
não por igualdade de commits. Não é necessário repetir toda a suíte no standalone de fonte idêntica.
Não existem workflows de CI em `.github/workflows`; hooks de modernização não são CI.
Check local pronto não fecha TD-002/SEC-014 integralmente.

### E6 — Dependências atuais

Executados via registry npm: `npm.cmd audit --json` e `npm.cmd audit --omit=dev --json`.
Audit completo: **38 entradas de pacotes, 19 high/19 moderate, zero critical**.
Audit runtime: **zero**. Inclui toolchain Angular/build/CLI, Vite/Vitest e dependências
transitivas de ferramentas. Não somar entradas como 38 ataques independentes nem inferir
exposição da aplicação em produção. A evidência nova invalida a afirmação histórica de
audit completo zero e exige triagem de advisory/caminho/versão/fix compatível.
Não foi instalado ou atualizado pacote nem executado audit fix.

Logs privados: `C:\shared-planner-private\qa-evidence\backlog-audit-*` (backend,
frontend, paridade, audits completo/runtime e contagens). Logs de testes contêm apenas
fixtures; não devem ser publicados automaticamente junto à documentação.

## Ordem recomendada e bloqueios

| Ordem | IDs / prioridade preservada | Gate e ação |
|---|---|---|
| 1 | BE-001 / TEST-001 — P0; SEC-015 — P3 associado | Antes de mudanças de negócio/financeiro: especificar invariantes possíveis sobre legado, provar constraints e corridas em PostgreSQL isolado; manter backup/restore. Não aplicar CHECK indiscriminado a dados antigos |
| 2 | BE-005 / TEST-004/006 — P1 | Completar testes críticos de autenticação/revogação/último ADMIN; rate limit e eventos defensivos antes de exposição compartilhada |
| 3 | BR-002/003/004 — P1; SEC-017 — P2 | Decidir responsável/bypass/edição adicional apenas se a próxima entrega alterar esses comportamentos; grants e consentimento atuais não estão suspensos |
| 4 | TEST-005 — P1; TEST-009 — P2; TD-002 — P3 | Jornada real isolada de acesso/SHARED/pagamento/Finance e check de paridade como gate; concurrency não substituída por testes sequenciais |
| 5 | SEC-005/TD-001 — P2 | Triar já as dependências de desenvolvimento, aplicar solução compatível em tarefa própria e repetir regressão; antes de aceitar novo baseline da toolchain |
| 6 | BR-006/SEC-010/BE-007/FE-005/TEST-010 — P2 | Decidir retenção/minimização e completar auditoria; antes de uso compartilhado com dados sensíveis, sem refazer a tela existente |
| 7 | Etapa 3; UX-002 — P2, TD-006 — P4 | Refino de responsividade/ajudas/leitor de tela, com DS atual e regressão. Excel já entregue: refinar UX e compatibilidade, não implementar de novo |
| 8 | SEC-006/007/008/011 — P2; SEC-013/014/016, TD-003, UX-004 — P3 | Hardening operacional antes de publicação; decisões opcionais/multidia e dívida podem aguardar sem bloquear protótipos visuais locais |

Prioridades mantidas; dependências e gates não são uma renumeração P0–P4.

**Prontidão: condicionada.** A base visual e os fluxos atuais estão validados para
preparar refinamentos isolados. Não declarar todo backlog encerrado nem liberar uma
Etapa 3 irrestrita sem tratar o pacote P0 de validação de integridade e estabelecer o
gate integrado correspondente; a triagem do audit deve preceder novo baseline de ferramentas.
Não é necessário esperar decisões opcionais de produto para desenhar uma tela.
Prontidão para refino local não equivale a autorização/homologação de produção.

## Limites desta auditoria

Não foi feito pentest, inventário de CVEs Java/imagens, inspeção de ACL privada,
homologação de TLS, teste multithread ou restore novo. Ausência de falhas nas suítes
não comprova ausência de bugs. Lacunas não implementadas são OPEN/PARTIAL/BLOCKED,
e não foram rotuladas como bugs reproduzidos. A matriz preserva as funcionalidades
concluídas, os IDs, as prioridades e todos os checkpoints históricos do arquivo 33.
