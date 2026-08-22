# 06 — Evento CLIENT

Objetivo: representar atendimento e sua expectativa financeira. Ator: usuário com permissão de criação no calendário.

Entrada: `calendarId`, `eventType=CLIENT`, título, `clientName`, `workDescription`, `amount>=0`, início e fim; descrição é opcional. CURRENT não possui campo separado `service` nem profissional/responsável: título/workDescription e createdBy aproximam esses conceitos (GAP-004).

Fluxo: validar período/campos/permissão → criar `SCHEDULED` → inicializar pagamento `PENDING`, recebido zero → auditar → retornar `EventResponse`. Cancelamento preserva o evento como `CANCELLED`, audita e bloqueia novas alterações.

Saída resumida TARGET: cliente/serviço, responsável e horário; detalhe deve mostrar todos os dados disponíveis. O calendário atual renderiza rótulo derivado e detalhe completo, porém a modelagem de serviço/responsável precisa decisão.

Erros: 400 campos/período/valor; 403 criação; 404 calendário. Critérios: AC-CLIENT-001/002, AC-PAY-001, AC-FIN-001. Evidência: `EventService.create`, `validateEventFields`, `calendar-page.ts/html`.
