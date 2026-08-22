# 00 — Visão do produto

## Objetivo

O Shared Planner permite que casais e pequenos grupos combinem visibilidade de agendas com autoria e consentimento explícitos. Cada usuário pode acompanhar calendários autorizados; visualizar não implica criar. Atendimentos `CLIENT` alimentam o financeiro; compromissos `PERSONAL` representam a rotina; `SHARED` representa participação que depende da aprovação de outra pessoa.

## Atores e resultados

- Usuário: consulta calendários e cria onde a política permitir.
- Participante solicitado: aprova ou rejeita `SHARED` destinado a ele.
- Gestor de calendário: administra membros e papéis.
- Financeiro: consulta receitas e atualiza pagamentos conforme autorização.
- Administrador global: administra usuários e possui bypass amplo no CURRENT.

## Princípios TARGET

1. Autoria não deve ser confundida com o responsável/participante.
2. Evento comum não deve ser criado em nome de terceiro; consentimento usa `SHARED`.
3. Permissão deve ser mínima, explícita e verificável no backend.
4. Somente `CLIENT` não cancelado integra faturamento.
5. Operações relevantes devem ser auditáveis.

Fora do escopo confirmado: recorrência, conflito automático de horários, push, e-mail, WhatsApp, Google Calendar, comissão, parcelamento, moedas e timezone por usuário. Ver [questões](99-open-questions.md).
