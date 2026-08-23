# 10 — Pagamentos

Pagamento é parte de `Event`, não agregado separado. Campos: `paymentStatus`, `paymentMethod`, `receivedAmount`, `paidAt`. Somente CLIENT aceita atualização. Permissão CURRENT é a de editar o evento, não a permissão financeira — conflito potencial (Q-005).

| Status | Recebido | Método | `paidAt` | Validação CURRENT |
|---|---:|---|---|---|
| PENDING | 0 | opcional | nulo | obrigatório |
| PARTIALLY_PAID | `>0` e `<amount` | obrigatório | automático se ausente | obrigatório |
| PAID | `=amount` | obrigatório | automático se ausente | obrigatório |
| REFUNDED | 0 | opcional | não restringido | obrigatório |

Recebido nunca pode superar `amount`; DTO impede negativo e limita `receivedAmount` a 10 inteiros e 2 decimais. O código permite qualquer transição entre estados se o novo snapshot for válido, inclusive REFUNDED→PAID. Após o pagamento deixar `PENDING`, o update comum rejeita mudança de `eventType` ou `amount`; conversão de CLIENT ainda pendente para outro tipo limpa todo o snapshot financeiro. Não existe valor histórico reembolsado ou pagamento parcial múltiplo.

UI CURRENT: formulário dentro do detalhe do evento no calendário e página `/finance` funcional para resumo. Dados e controles de pagamento não são renderizados quando `EventResponse` os omite por capacidade. Saída: `EventResponse` atualizado e audit `PAYMENT_UPDATED`. A política de quem altera permanece CURRENT até Q-005. Critérios: AC-PAY-001–004. Evidência: `EventService.validatePayment/updatePayment/validatePaymentIntegrityForUpdate`, `EventFinancialIntegrityIntegrationTests` e `calendar-page.ts`.
