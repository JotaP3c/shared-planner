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
| POST `/api/calendars/{id}/members` | `{email,role?}` | 204 | global/calendar ADMIN; default VIEWER; e-mail normalizado; **404** sem conta, **409** conta inativa ou já membro (sem upsert desde 2026-11-11); nunca cria conta |
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
| POST `/api/events/{id}/confirm` | — | `EventResponse`, 200 | edição do evento; CLIENT; PENDING_CONFIRMATION/RESCHEDULED → CONFIRMED; 409 transição inválida |
| POST `/api/events/{id}/unschedule` | `{reason: RESCHEDULE\|GAVE_UP\|OTHER, notes?, newStartsAt?, newEndsAt?}` | `EventResponse`, 200 | notes obrigatório em OTHER; datas obrigatórias em RESCHEDULE (mesmo evento); 409 se já desmarcado |
| GET `/api/events/{id}/confirmation-history` | — | histórico, 200 | calendário visível |
| GET `/api/finance/timeline` | `calendarId,startDate,endDate` | `{granularity: DAY\|MONTH, points[]}` | capacidade financeira; DAY ≤ 62 dias; máx. 1100 dias |
| GET `/api/finance/appointments` | `calendarId,startDate,endDate,limit?` | atendimentos recentes | capacidade financeira; limit 1–50 (padrão 10) |

## Contratos por tipo

### Extensões — auditoria e calendários (11/11/2026)

| Rota | Contrato complementar |
|---|---|
| POST `/api/calendars` | autenticado; cria SHARED (padrão) ou IMPORTED; owner ADMIN; ownerEmail diferente do ator exige ADMIN global |
| GET `/api/calendars` | acrescenta calendarType PERSONAL/SHARED/LEGACY/IMPORTED e memberRoles[]; campos antigos preservados |
| POST/PUT membros | roles[] combináveis, fallback role singular; owner exige ADMIN |
| POST/PUT eventos | clientPhone?, allDay?, approvalRequestedFromEmails[]?; respostas acrescentam approvals/participantes |
| GET `/api/events/{id}/approval-history` | rodadas e respostas de aprovação, calendário visível |
| POST `/api/event-series` | `{event:CreateEventRequest,recurrence:{frequency,interval?,weekDays?,until?,count?,zoneId}}`; finito ≤366, ≤3 anos |
| GET `/api/event-series/by-event/{id}` | metadados e eventos da série autorizada |
| PUT/DELETE `/api/event-series/{id}` | `scope=ALL\|FUTURE`, fromEventId para FUTURE; individual usa API de eventos |
| POST `/api/calendar-imports/preview` | ICS, sourceCalendarId, targetCalendarId, zoneId, windowStart/windowEnd; consulta sem gravar |
| POST `/api/calendar-imports/commit` | mesmo corpo e mappingConfirmed=true; privateEventsAuthorized opcional false; resultados por linha, deduplicação persistida |
| GET `/api/holidays?country=BR&year=2026` | camada read-only autenticada, id estável, startDate/endDateExclusive e fonte oficial |

PRIVATE/CONFIDENTIAL só é aceito com opt-in, gestão do destino PERSONAL/IMPORTED e
owner como único membro. YEARLY é suportado pelo importador, inclusive 29/02 sem
deslocar datas em anos comuns. A interface de criação de série mantém os presets
diário/semanal/quinzenal/mensal/personalizado aprovados.

Recorrência/importação reutilizam EventService; autorização contextual e validações
continuam no backend. ICS não suportado/incompleto ou privado é bloqueado com motivo.
Nenhuma rota exporta credenciais ou atribui preço ausente. Detalhes no complemento.

- CLIENT: exige clientName/workDescription/amount; PERSONAL: exige personName; SHARED: exige approvalRequestedFromEmail diferente do ator e membro.
- `EventResponse` contém IDs/e-mails, tipo/status, conteúdo e datas. Os campos `amount`, `paymentStatus`, `paymentMethod`, `receivedAmount` e `paidAt` são omitidos quando o ator não possui capacidade financeira ou de pagamento aprovada para aquele evento; ver `SEC-AUTHZ-006`.
- Não há envelope padronizado de erro documentado.
- PROPOSED, sujeito a decisões: endpoint/atributo que represente agenda/responsável próprio; nenhuma URL deve ser fixada antes de Q-001/Q-002.

Evidência: todos `*Controller.java`, DTOs e services backend.
