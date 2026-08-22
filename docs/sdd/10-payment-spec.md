# 10 — Pagamentos

Pagamento é parte de `Event`, não agregado separado. Campos: `paymentStatus`, `paymentMethod`, `receivedAmount`, `paidAt`. Somente CLIENT aceita atualização. Permissão CURRENT é a de editar o evento, não a permissão financeira — conflito potencial (Q-005).

| Status | Recebido | Método | `paidAt` | Validação CURRENT |
|---|---:|---|---|---|
| PENDING | 0 | opcional | nulo | obrigatório |
| PARTIALLY_PAID | `>0` e `<amount` | obrigatório | automático se ausente | obrigatório |
| PAID | `=amount` | obrigatório | automático se ausente | obrigatório |
| REFUNDED | 0 | opcional | não restringido | obrigatório |

Recebido nunca pode superar `amount`; DTO impede negativo. O código permite qualquer transição entre estados se o novo snapshot for válido, inclusive REFUNDED→PAID. Não existe valor histórico reembolsado ou pagamento parcial múltiplo.

UI CURRENT: formulário dentro do detalhe do evento no calendário; página financeira é placeholder. Saída: `EventResponse` atualizado e audit `PAYMENT_UPDATED`. Critérios: AC-PAY-001–003. Evidência: `EventService.validatePayment/updatePayment`, `calendar-page.ts`.
