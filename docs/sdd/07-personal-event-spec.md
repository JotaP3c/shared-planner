# 07 — Evento PERSONAL

Objetivo: representar compromisso pessoal. Entrada CURRENT: calendário, tipo, título, `personName`, descrição opcional, início e fim. Criador é obtido do JWT; `personName` é texto livre, não relação com User.

Fluxo: validar → autorizar criação → criar `SCHEDULED` → auditar → exibir nome/responsável/horário. Atualização redefine status para `SCHEDULED`; cancelamento preserva a linha como `CANCELLED` terminal.

TARGET proíbe criar compromisso comum em nome de terceiro. A implementação apenas verifica permissão no calendário e aceita qualquer `personName`; portanto há conflito e ausência de identidade estruturada. Até Q-001/Q-002 serem decididas, “responsável” não pode ser garantido.

Erros: 400 `personName`/período, 403 permissão, 404 recurso. Critérios: AC-PERSONAL-001/002. Evidência: `EventService.create/update`, `Event`, formulário de `calendar-page`.
