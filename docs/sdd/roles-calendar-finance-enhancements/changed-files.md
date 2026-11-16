# Arquivos e estado Git — revisão 13/11/2026

Este inventário preserva o checkpoint anterior à publicação. Os commits por rotina,
as bases e o fechamento autorizado em 16/11 constam no
[relatório de publicação](publication-report.md).

Nenhum commit/push novo nesta rodada. `.vscode/` e `docs/reffs/` locais foram preservados e não entram nesta lista de código/SDD. Backups, ICS, planos, relatórios de dados e workbooks reais ficam fora dos repositórios; caches Python são ignorados. Os três índices continuam vazios.

Status de `git status --short --untracked-files=all`, excluindo apenas esses dois diretórios locais preservados:

## monorepo

HEAD preservado: `c52b324`. 64 paths rastreados modificados e 48 arquivos novos. Índice vazio: sim.

```text
 M .gitignore
 M README.md
 M backend/README.md
 M backend/pom.xml
 M backend/src/main/java/com/sharedplanner/audit/AuditEntityType.java
 M backend/src/main/java/com/sharedplanner/auth/AuthenticatedUserController.java
 M backend/src/main/java/com/sharedplanner/calendar/CalendarMemberResponse.java
 M backend/src/main/java/com/sharedplanner/calendar/CalendarResponse.java
 M backend/src/main/java/com/sharedplanner/calendar/CalendarService.java
 M backend/src/main/java/com/sharedplanner/calendarimport/CalendarImportService.java
 M backend/src/main/java/com/sharedplanner/config/AuthorizationService.java
 M backend/src/main/java/com/sharedplanner/event/Event.java
 M backend/src/main/java/com/sharedplanner/event/EventRepository.java
 M backend/src/main/java/com/sharedplanner/event/EventResponse.java
 M backend/src/main/java/com/sharedplanner/event/EventService.java
 M backend/src/main/java/com/sharedplanner/finance/FinanceService.java
 M backend/src/main/java/com/sharedplanner/finance/FinanceSummaryResponse.java
 M backend/src/main/java/com/sharedplanner/finance/FinanceTotals.java
 M backend/src/main/java/com/sharedplanner/user/UserRepository.java
 M backend/src/main/java/com/sharedplanner/user/UserResponse.java
 M backend/src/main/java/com/sharedplanner/user/UserService.java
 M backend/src/test/java/com/sharedplanner/config/AuthorizationServiceTests.java
 M backend/src/test/java/com/sharedplanner/migration/PostgresMigrationIntegrationTests.java
 M docs/sdd/01-current-state.md
 M docs/sdd/04-permissions.md
 M docs/sdd/20-validation-report.md
 M docs/sdd/21-development-progress.md
 M frontend/README.md
 M frontend/src/app/app.routes.ts
 M frontend/src/app/core/api/finance.service.ts
 M frontend/src/app/core/auth/auth.service.spec.ts
 M frontend/src/app/core/auth/auth.service.ts
 M frontend/src/app/core/auth/calendar-permissions.spec.ts
 M frontend/src/app/core/auth/calendar-permissions.ts
 M frontend/src/app/core/auth/finance-access.ts
 M frontend/src/app/core/guards/role.guard.spec.ts
 M frontend/src/app/core/guards/role.guard.ts
 M frontend/src/app/core/layout/app-shell/app-shell.html
 M frontend/src/app/core/layout/app-shell/app-shell.spec.ts
 M frontend/src/app/core/layout/app-shell/app-shell.ts
 M frontend/src/app/core/models/shared-planner.models.ts
 M frontend/src/app/features/audit/audit-page/audit-page.spec.ts
 M frontend/src/app/features/audit/audit-page/audit-page.ts
 M frontend/src/app/features/calendar/calendar-creator/calendar-creator.spec.ts
 M frontend/src/app/features/calendar/calendar-creator/calendar-creator.ts
 M frontend/src/app/features/calendar/calendar-import-page/calendar-import-page.spec.ts
 M frontend/src/app/features/calendar/calendar-import-page/calendar-import-page.ts
 M frontend/src/app/features/calendar/calendar-page/calendar-page.html
 M frontend/src/app/features/calendar/calendar-page/calendar-page.spec.ts
 M frontend/src/app/features/calendar/calendar-page/calendar-page.ts
 M frontend/src/app/features/finance/finance-page/finance-page.html
 M frontend/src/app/features/finance/finance-page/finance-page.spec.ts
 M frontend/src/app/features/finance/finance-page/finance-page.ts
 M frontend/src/app/features/members/members-page/members-page.html
 M frontend/src/app/features/members/members-page/members-page.spec.ts
 M frontend/src/app/features/members/members-page/members-page.ts
 M frontend/src/app/features/users/users-page/users-page.html
 M frontend/src/app/features/users/users-page/users-page.spec.ts
 M frontend/src/app/features/users/users-page/users-page.ts
 M frontend/src/app/shared/ui/charts/donut-chart.ts
 M frontend/src/styles/_charts.scss
 M frontend/src/styles/_finance.scss
 M frontend/tests/browser-smoke.cjs
 M frontend/tests/local-development-check.cjs
?? backend/src/main/java/com/sharedplanner/access/AccessAssignment.java
?? backend/src/main/java/com/sharedplanner/access/AccessAssignmentRepository.java
?? backend/src/main/java/com/sharedplanner/access/AccessControlController.java
?? backend/src/main/java/com/sharedplanner/access/AccessControlService.java
?? backend/src/main/java/com/sharedplanner/access/AccessProfile.java
?? backend/src/main/java/com/sharedplanner/access/AccessProfileRepository.java
?? backend/src/main/java/com/sharedplanner/access/BuiltInProfiles.java
?? backend/src/main/java/com/sharedplanner/access/Permission.java
?? backend/src/main/java/com/sharedplanner/access/PermissionResolver.java
?? backend/src/main/java/com/sharedplanner/access/ProfileScope.java
?? backend/src/main/java/com/sharedplanner/finance/FinanceExportController.java
?? backend/src/main/java/com/sharedplanner/finance/FinanceExportEventRepository.java
?? backend/src/main/java/com/sharedplanner/finance/FinanceExportService.java
?? backend/src/main/java/com/sharedplanner/finance/FinanceWorkbook.java
?? backend/src/main/resources/db/migration/V11__configurable_access_profiles.sql
?? backend/src/main/resources/db/migration/V12__development_correction_provenance.sql
?? backend/src/test/java/com/sharedplanner/access/AccessControlIntegrationTests.java
?? backend/src/test/java/com/sharedplanner/finance/FinanceExportIntegrationTests.java
?? backend/src/test/java/com/sharedplanner/finance/FinanceExportLimitsTests.java
?? "docs/reffs/Dashboard do Shared Planner em modo escuro-2.png"
?? "docs/reffs/Login do Shared Planner em modo escuro-1.png"
?? "docs/reffs/Modal de Novo Agendamento no Calend\303\241rio SaaS-3.png"
?? "docs/reffs/Painel Compartilhado de Calend\303\241rio-5.png"
?? "docs/reffs/Painel Compartilhado de Planejamento-4 (1).png"
?? "docs/reffs/Painel Compartilhado de Planejamento-4.png"
?? "docs/reffs/Painel Financeiro em Modo Escuro-6.png"
?? "docs/reffs/Painel de Perfil em Modo Escuro-4.png"
?? "docs/reffs/Painel do Shared Planner em Novembro-3 (1).png"
?? "docs/reffs/Painel moderno de calend\303\241rio compartilhado-1.png"
?? "docs/reffs/Painel moderno do Shared Planner-2 (1).png"
?? "docs/reffs/Pend\303\252ncias no Shared Planner-5.png"
?? docs/sdd/roles-calendar-finance-enhancements/changed-files.md
?? docs/sdd/roles-calendar-finance-enhancements/design.md
?? docs/sdd/roles-calendar-finance-enhancements/prompt-review.md
?? docs/sdd/roles-calendar-finance-enhancements/requirements.md
?? docs/sdd/roles-calendar-finance-enhancements/tasks.md
?? docs/sdd/roles-calendar-finance-enhancements/validation-report.md
?? frontend/src/app/core/api/access.service.ts
?? frontend/src/app/core/models/access.models.ts
?? frontend/src/app/features/access/access-denied.ts
?? frontend/src/app/features/access/access-page.html
?? frontend/src/app/features/access/access-page.scss
?? frontend/src/app/features/access/access-page.spec.ts
?? frontend/src/app/features/access/access-page.ts
?? frontend/src/app/shared/ui/charts/line-chart.spec.ts
?? frontend/src/app/shared/ui/charts/line-chart.ts
?? scripts/correct-development-events.py
?? scripts/tests/test_correct_development_events.py
```

## backend

HEAD preservado: `060bcd9`. 21 paths rastreados modificados e 19 arquivos novos. Índice vazio: sim.

```text
 M README.md
 M pom.xml
 M src/main/java/com/sharedplanner/audit/AuditEntityType.java
 M src/main/java/com/sharedplanner/auth/AuthenticatedUserController.java
 M src/main/java/com/sharedplanner/calendar/CalendarMemberResponse.java
 M src/main/java/com/sharedplanner/calendar/CalendarResponse.java
 M src/main/java/com/sharedplanner/calendar/CalendarService.java
 M src/main/java/com/sharedplanner/calendarimport/CalendarImportService.java
 M src/main/java/com/sharedplanner/config/AuthorizationService.java
 M src/main/java/com/sharedplanner/event/Event.java
 M src/main/java/com/sharedplanner/event/EventRepository.java
 M src/main/java/com/sharedplanner/event/EventResponse.java
 M src/main/java/com/sharedplanner/event/EventService.java
 M src/main/java/com/sharedplanner/finance/FinanceService.java
 M src/main/java/com/sharedplanner/finance/FinanceSummaryResponse.java
 M src/main/java/com/sharedplanner/finance/FinanceTotals.java
 M src/main/java/com/sharedplanner/user/UserRepository.java
 M src/main/java/com/sharedplanner/user/UserResponse.java
 M src/main/java/com/sharedplanner/user/UserService.java
 M src/test/java/com/sharedplanner/config/AuthorizationServiceTests.java
 M src/test/java/com/sharedplanner/migration/PostgresMigrationIntegrationTests.java
?? src/main/java/com/sharedplanner/access/AccessAssignment.java
?? src/main/java/com/sharedplanner/access/AccessAssignmentRepository.java
?? src/main/java/com/sharedplanner/access/AccessControlController.java
?? src/main/java/com/sharedplanner/access/AccessControlService.java
?? src/main/java/com/sharedplanner/access/AccessProfile.java
?? src/main/java/com/sharedplanner/access/AccessProfileRepository.java
?? src/main/java/com/sharedplanner/access/BuiltInProfiles.java
?? src/main/java/com/sharedplanner/access/Permission.java
?? src/main/java/com/sharedplanner/access/PermissionResolver.java
?? src/main/java/com/sharedplanner/access/ProfileScope.java
?? src/main/java/com/sharedplanner/finance/FinanceExportController.java
?? src/main/java/com/sharedplanner/finance/FinanceExportEventRepository.java
?? src/main/java/com/sharedplanner/finance/FinanceExportService.java
?? src/main/java/com/sharedplanner/finance/FinanceWorkbook.java
?? src/main/resources/db/migration/V11__configurable_access_profiles.sql
?? src/main/resources/db/migration/V12__development_correction_provenance.sql
?? src/test/java/com/sharedplanner/access/AccessControlIntegrationTests.java
?? src/test/java/com/sharedplanner/finance/FinanceExportIntegrationTests.java
?? src/test/java/com/sharedplanner/finance/FinanceExportLimitsTests.java
```

## frontend

HEAD preservado: `ba4d9b4`. 37 paths rastreados modificados e 9 arquivos novos. Índice vazio: sim.

```text
 M README.md
 M src/app/app.routes.ts
 M src/app/core/api/finance.service.ts
 M src/app/core/auth/auth.service.spec.ts
 M src/app/core/auth/auth.service.ts
 M src/app/core/auth/calendar-permissions.spec.ts
 M src/app/core/auth/calendar-permissions.ts
 M src/app/core/auth/finance-access.ts
 M src/app/core/guards/role.guard.spec.ts
 M src/app/core/guards/role.guard.ts
 M src/app/core/layout/app-shell/app-shell.html
 M src/app/core/layout/app-shell/app-shell.spec.ts
 M src/app/core/layout/app-shell/app-shell.ts
 M src/app/core/models/shared-planner.models.ts
 M src/app/features/audit/audit-page/audit-page.spec.ts
 M src/app/features/audit/audit-page/audit-page.ts
 M src/app/features/calendar/calendar-creator/calendar-creator.spec.ts
 M src/app/features/calendar/calendar-creator/calendar-creator.ts
 M src/app/features/calendar/calendar-import-page/calendar-import-page.spec.ts
 M src/app/features/calendar/calendar-import-page/calendar-import-page.ts
 M src/app/features/calendar/calendar-page/calendar-page.html
 M src/app/features/calendar/calendar-page/calendar-page.spec.ts
 M src/app/features/calendar/calendar-page/calendar-page.ts
 M src/app/features/finance/finance-page/finance-page.html
 M src/app/features/finance/finance-page/finance-page.spec.ts
 M src/app/features/finance/finance-page/finance-page.ts
 M src/app/features/members/members-page/members-page.html
 M src/app/features/members/members-page/members-page.spec.ts
 M src/app/features/members/members-page/members-page.ts
 M src/app/features/users/users-page/users-page.html
 M src/app/features/users/users-page/users-page.spec.ts
 M src/app/features/users/users-page/users-page.ts
 M src/app/shared/ui/charts/donut-chart.ts
 M src/styles/_charts.scss
 M src/styles/_finance.scss
 M tests/browser-smoke.cjs
 M tests/local-development-check.cjs
?? src/app/core/api/access.service.ts
?? src/app/core/models/access.models.ts
?? src/app/features/access/access-denied.ts
?? src/app/features/access/access-page.html
?? src/app/features/access/access-page.scss
?? src/app/features/access/access-page.spec.ts
?? src/app/features/access/access-page.ts
?? src/app/shared/ui/charts/line-chart.spec.ts
?? src/app/shared/ui/charts/line-chart.ts
```
