# 11 — Contratos de API

Todas as respostas são JSON salvo 204/string; todas as rotas, exceto health/login, requerem `Bearer JWT`. Bean Validation ou regra de serviço retorna tipicamente 400; autenticação 401; autorização 403; inexistência 404; e-mail duplicado 409.

| Método e URL | Request/parâmetros | Response/status | Permissão e regras |
|---|---|---|---|
| GET `/api/health` | — | string, 200 | público |
| POST `/api/auth/login` | `LoginRequest` | `LoginResponse`, 200 | público; credencial inválida 401 |
| GET `/api/auth/me` | — | `UserResponse`, 200 | autenticado |
| GET `/api/users` | — | `UserResponse[]`, 200 | global ADMIN |
| POST `/api/users` | `CreateUserRequest` | `UserResponse`, 201 | global ADMIN; duplicado 409 |
| PUT `/api/users/{id}` | `UpdateUserRequest` | `UserResponse`, 200 | global ADMIN; autoproteção |
| GET `/api/calendars` | — | `CalendarResponse[]`, 200 | visíveis; ADMIN vê todos |
| POST `/api/calendars` | `{name}` | `CalendarResponse`, 201 | global ADMIN |
| GET `/api/calendars/{id}/members` | — | `CalendarMemberResponse[]`, 200 | calendário visível |
| POST `/api/calendars/{id}/members` | `{email,role?}` | 204 | global/calendar ADMIN; default VIEWER; owner permanece ADMIN |
| PUT `/api/calendars/{id}/members/{memberId}` | `{role}` | membro, 200 | global/calendar ADMIN; owner permanece ADMIN |
| DELETE `/api/calendars/{id}/members/{memberId}` | — | 204 | global/calendar ADMIN; owner protegido |
| GET `/api/events` | `calendarId,start,end` ISO datetime | `EventResponse[]`, 200 | calendário visível; sobreposição do intervalo |
| POST `/api/events` | `CreateEventRequest` | `EventResponse`, 201 | BR-EVT-002 e regras por tipo |
| GET `/api/events/search` | `term,limit?` | `EventSearchResponse[]`, 200 | visíveis; termo <2 → []; limite default 20/max 50 |
| GET `/api/events/pending-approvals` | — | `EventResponse[]`, 200 | alvo ativo e membro atual; ADMIN lista todas |
| GET `/api/events/{id}` | — | `EventResponse`, 200 | calendário visível |
| PUT `/api/events/{id}` | `UpdateEventRequest` | `EventResponse`, 200 | permissão de edição; status recalculado; BR-PAY-003 |
| DELETE `/api/events/{id}` | — | 204 | permissão de edição; transição persistente para CANCELLED e auditoria |
| POST `/api/events/{id}/approve` | `{}` | `EventResponse`, 200 | alvo ativo + membro atual + pendente |
| POST `/api/events/{id}/reject` | `{}` | `EventResponse`, 200 | alvo ativo + membro atual + pendente |
| PUT `/api/events/{id}/payment` | `UpdatePaymentRequest` | `EventResponse`, 200 | edição + BR-PAY-001 |
| GET `/api/events/client-revenue` | `calendarId,period,date?` | resumo, 200 | financeiro; date default hoje |
| GET `/api/finance/summary` | `calendarId,startDate,endDate` | `FinanceSummaryResponse`, 200 | financeiro |
| GET `/api/audit-logs` | `calendarId?,entityType?,entityId?,limit?` | logs, 200 | global ADMIN ou calendar ADMIN; limit 1–100 |

## Contratos por tipo

- CLIENT: exige clientName/workDescription/amount; PERSONAL: exige personName; SHARED: exige approvalRequestedFromEmail diferente do ator e membro.
- `EventResponse` contém IDs/e-mails, tipo/status, conteúdo e datas. Os campos `amount`, `paymentStatus`, `paymentMethod`, `receivedAmount` e `paidAt` são omitidos quando o ator não possui capacidade financeira ou de pagamento aprovada para aquele evento; ver `SEC-AUTHZ-006`.
- Não há envelope padronizado de erro documentado.
- PROPOSED, sujeito a decisões: endpoint/atributo que represente agenda/responsável próprio; nenhuma URL deve ser fixada antes de Q-001/Q-002.

Evidência: todos `*Controller.java`, DTOs e services backend.
