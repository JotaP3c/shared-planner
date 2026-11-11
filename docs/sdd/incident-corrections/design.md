# Design técnico — correção de incidentes

## Arquitetura atual (verificada)

Spring Boot 4.0.6 / Java 17 / JPA / Flyway V1–V7 / PostgreSQL 17 (H2 MODE=PostgreSQL nos
testes, schema por entidades). Erros via `ResponseStatusException` (corpo ProblemDetail;
o frontend lê `error.detail`). Angular 21.2 standalone + signals, FullCalendar 6.1.

## Causas raiz comprovadas

1. **`<select [value]>` + `@for` (INC-03b, INC-05a).** O binding de propriedade `value`
   do `<select>` é aplicado na criação do elemento, antes das `<option>` geradas pelo
   bloco `@for`; o navegador então seleciona a primeira opção. O estado do componente fica
   diferente do que a tela mostra: Financeiro inicia em `MONTHLY` exibindo "Diário"
   (print 09/10: intervalo 1–30/11) e Membros envia `VIEWER` exibindo "Administrador".
   Correção: `[selected]` em cada `<option>` (Financeiro: calendário/período; Membros:
   calendário, papel do formulário e papel por linha; Calendário: duração).
2. **Membros (INC-03a/c/d).** `addMember` usava `findByEmailIgnoreCaseAndActiveTrue`, então
   inexistente e inativo produziam o mesmo 404 "User not found"; o frontend exibia o texto
   cru. Membro existente tinha o papel sobrescrito pelo POST. E-mail não era aparado.
3. **Usuários (INC-04).** Só existia autoproteção; outro ADMIN podia desativar/rebaixar o
   último ADMIN ativo. `CreateUserRequest` sem limites de tamanho e corrida de e-mail
   duplicado resultava em erro de integridade (500).

## Modelo de confirmação (NF-01)

Reutilização: `EventStatus` continua descrevendo o ciclo do evento (SCHEDULED,
PENDING_APPROVAL, APPROVED, REJECTED, CANCELLED pela equipe) e `PaymentStatus` o pagamento.
A confirmação do cliente é uma terceira dimensão, então ganha enum próprio
`AppointmentConfirmationStatus` (PENDING_CONFIRMATION, CONFIRMED, CANCELLED, RESCHEDULED).
"CANCELLED" de confirmação = desmarcado pelo cliente; o evento **não** recebe
`status = CANCELLED`, para que pagamentos/estornos continuem registráveis e o histórico
financeiro seja preservado.

Migration `V8__add_appointment_confirmation.sql` (não destrutiva):

- `events`: `confirmation_status`, `confirmation_changed_at`,
  `confirmation_changed_by_user_id` (FK users), `reschedule_count` (default 0),
  `unschedule_reason`, `unschedule_notes` + CHECKs. `UPDATE` legado: CLIENT →
  PENDING_CONFIRMATION; demais tipos NULL.
- `appointment_confirmation_history`: id, event_id (FK, cascade com o evento),
  previous_status, new_status, reason, notes, previous/new starts/ends, performed_by,
  performed_at; índice por evento/data.

Endpoints novos (todos autenticados):

| Método | Rota | Regra | Respostas |
|---|---|---|---|
| POST | `/api/events/{id}/confirm` | `ensureCanEditEvent`; CLIENT; transição válida | 200 EventResponse; 400; 403; 404; 409 |
| POST | `/api/events/{id}/unschedule` | body `{reason, notes?, newStartsAt?, newEndsAt?}` | idem |
| GET | `/api/events/{id}/confirmation-history` | `ensureCalendarVisible` | 200 lista |
| GET | `/api/finance/timeline` | `ensureCanUseFinance`; DAY ≤ 62 dias, senão MONTH; ≤ 1100 dias | 200 |
| GET | `/api/finance/appointments` | `ensureCanUseFinance`; limite 1–50 (padrão 10) | 200 |

`EventResponse` ganha campos de confirmação (CLIENT). `FinanceSummaryResponse` ganha
indicadores de confirmação; campos existentes mantidos.

### Regras financeiras

População: CLIENT, `status <> CANCELLED`, `startsAt ∈ [início, fim+1)`.

| Indicador | Fórmula |
|---|---|
| expectedAmount (prevista) | Σ amount, exceto desmarcados |
| receivedAmount | Σ receivedAmount de toda a população (inclui desmarcados com pagamento) |
| pendingAmount | Σ (amount − receivedAmount), exceto desmarcados |
| confirmedAmount | Σ amount CONFIRMED |
| unconfirmedAmount | Σ amount PENDING_CONFIRMATION/RESCHEDULED/legado nulo |
| unscheduledAmount | Σ amount CANCELLED (valor associado, não prejuízo) |
| contagens de pagamento | mutuamente exclusivas sobre `appointmentCount` |
| contagens de confirmação | mutuamente exclusivas sobre `appointmentCount` (situação atual) |
| rescheduleOccurrences | Σ rescheduleCount (histórico, não situação) |

Os donuts mostram **quantidade de atendimentos**; a evolução mostra **valores** (prevista e
recebida por dia/mês). Quantidade e valor nunca dividem o mesmo percentual.

## Frontend

- `AppointmentConfirmation` (novo componente em `features/calendar/appointment-confirmation`):
  seção de confirmação, ações e formulário de desmarcação; emite o evento atualizado.
- Modal de detalhes reestruturado em seções; rodapé com hierarquia de ações.
- `LayoutPreferencesService` (novo): sinais `sidebarCollapsed` e `sidePanelCollapsed`
  persistidos em `localStorage` (`sharedPlanner.layout`), SSR-safe. Sidebar recolhida =
  72 px com ícones e tooltips; painel direito recolhido = trilho com botão de reabrir;
  FullCalendar recebe `updateSize()` após a transição.
- Financeiro: KPIs, cards secundários, `sp-donut-chart` e `sp-bar-chart` (SVG próprio em
  `shared/ui/charts`), atendimentos recentes.
- Usuários: ícones lápis/lixeira/reativar, confirmação, mensagens 409.
- Membros: mensagens por status/detalhe, recarga após sucesso.
- Auditoria: lista real com filtros e estados.

Decisão — biblioteca de gráficos: o projeto não possui; Chart.js/ngx-charts somariam
>60 kB e dependência nova para três gráficos simples. SVG com tokens cobre o requisito,
é acessível (`role="img"`, tabela de legenda) e respeita os temas.

## Compatibilidade

- `POST /members` deixa de ser upsert: membro existente → 409 (troca de papel via `PUT`).
  Teste de invariante do owner ajustado de 400 para 409 (owner continua ADMIN).
- `expectedAmount`/`pendingAmount` passam a excluir desmarcados; sem desmarcados os
  valores são idênticos aos anteriores (teste de agosto preservado).

## Testes

Backend: `AppointmentConfirmationIntegrationTests`, `CalendarMemberIntegrationTests`,
`UserAdministrationIntegrationTests`, ampliação de `FinanceSummaryIntegrationTests`.
Frontend: specs de confirmação, membros, usuários, financeiro (donut/filtros), layout,
login e auditoria. Limitações: H2 não executa a migration V8; PostgreSQL real e navegador
não disponíveis ao agente.
