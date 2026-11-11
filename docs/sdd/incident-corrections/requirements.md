# Correção de incidentes e confirmação de agendamento — requisitos

Data: 11/11/2026. Fonte: SDD "Correção de Incidentes, Evolução das Regras de Negócio e
Refinamento UI/UX" do proprietário, com prints 01–11 anexados ao chat (não estão no
repositório). Alterações de backend autorizadas quando necessárias; sem commit/push.

Classificação: **[BUG]** comprovado por código/print; **[ESPERADO]** comportamento correto
com UX ruim; **[REGRA]** regra de negócio ausente; **[VISUAL]** só apresentação.

## Incidentes

| ID | Tipo | Resumo | Evidência |
|---|---|---|---|
| INC-01 | VISUAL | Remover "Acesso protegido por autenticação com token." do login | print 01; `login-page.html` `.security-note` |
| INC-02 | VISUAL | Modal de detalhes do evento sem hierarquia | prints 02/03; `calendar-page.html` `.event-detail-grid` |
| INC-03a | ESPERADO + UX | `POST /members` → 404 "User not found" | prints 04/05: o e-mail não existe (lista de Usuários do print 06 tem só o admin); `CalendarService.addMember` busca usuário **ativo** e responde 404 genérico em inglês |
| INC-03b | BUG | Papel exibido ≠ papel enviado ao adicionar membro | print 04 mostra "Administrador"; o estado `memberRole` inicia em `VIEWER`. Causa: `<select [value]>` aplicado antes das `<option>` do `@for` existirem → navegador mostra a 1ª opção |
| INC-03c | REGRA | `POST` de membro existente alterava o papel silenciosamente (upsert) | `addMember` → `updateMemberRole` |
| INC-03d | BUG | E-mail com espaços não era normalizado no backend | `request.email()` usado sem `trim` |
| INC-04 | VISUAL + REGRA | Usuários sem ícones de editar/desativar; último ADMIN podia ser desativado/rebaixado por outro ADMIN | prints 06/07; `UserService.update` só protegia o próprio usuário |
| INC-05a | BUG | Financeiro mostra "Diário" e calcula o mês inteiro | print 09/10: "Diário" + "1 a 30 de nov.". Mesma causa do INC-03b no `<select>` de período e de calendário |
| INC-05b | VISUAL + REGRA | Financeiro sem evolução, donut, confirmação e recentes | prints 09/10 |
| INC-06 | VISUAL | Sidebar e painel direito fixos | print 11 |
| INC-07 | REGRA | `/audit` exibe `audit-page works!` | print 08; backend `GET /api/audit-logs` existe |
| NF-01 | REGRA | Confirmação de agendamento independente do pagamento | SDD §6–7 |

## Requisitos funcionais

- RF-01 (INC-01): a nota de segurança some nos temas claro/escuro/sistema; JWT, guards,
  interceptor e endpoints inalterados.
- RF-02 (INC-02): modal com cabeçalho (tipo, título, calendário, responsável, status),
  seções "Agendamento", "Financeiro" (CLIENT com capacidade financeira), "Confirmação do
  atendimento" (CLIENT) e rodapé com ações primárias/secundárias/destrutivas permitidas.
- RF-03 (NF-01): eventos CLIENT têm `confirmationStatus` ∈ {PENDING_CONFIRMATION,
  CONFIRMED, CANCELLED, RESCHEDULED}, independente de `paymentStatus` e de `status`.
  - Criação CLIENT → PENDING_CONFIRMATION. Abrir o modal não confirma nada.
  - Confirmar: PENDING_CONFIRMATION|RESCHEDULED → CONFIRMED.
  - Desmarcar com motivo obrigatório: Remarcação | Desistência | Outros (justificativa
    obrigatória em "Outros"). Desistência/Outros → CANCELLED. Remarcação exige nova data e
    → RESCHEDULED no **mesmo** evento (sem novo registro financeiro), `rescheduleCount + 1`.
  - Transições a partir de CANCELLED são recusadas (409). Evento com `status = CANCELLED`
    (cancelado pela equipe) não aceita confirmação (400). Não CLIENT → 400.
  - Cada mudança grava histórico (anterior, novo, motivo, observações, datas antiga/nova,
    usuário, data/hora) e auditoria.
  - Permissão: mesma regra de edição do evento (`ensureCanEditEvent`), validada no backend.
- RF-04 (financeiro): desmarcados não entram em receita prevista nem pendente; pagamentos
  recebidos continuam contabilizados; nada é apagado nem estornado automaticamente.
  Novos indicadores: confirmados, aguardando, desmarcados, remarcados (situação atual),
  ocorrências de remarcação, receita prevista confirmada, receita potencial não confirmada,
  valor associado a desmarcações (não é prejuízo).
- RF-05 (INC-05): filtros refletem o estado real; KPIs, evolução diária/mensal, donut de
  pagamento (quantidade de atendimentos), donut de confirmação (quantidade) e lista de
  atendimentos recentes com link para o detalhe no calendário. Período sem dados: R$ 0,00,
  mensagem e gráficos ocultos.
- RF-06 (INC-03): adicionar membro só para conta existente e ativa; 404 inexistente,
  409 inativo, 409 já membro, 404 calendário, 403 sem permissão, 400 inválido, 204 sucesso.
  Não cria conta; a UI orienta "Administração › Usuários". Lista recarrega após sucesso.
- RF-07 (INC-04): ícones lápis (editar) e lixeira (desativar) com tooltip e nome
  acessível; reativar inativos; confirmação explícita; sem exclusão física (FKs de eventos,
  calendários, auditoria e usuários criadores); último ADMIN ativo protegido (409);
  autoproteção mantida.
- RF-08 (INC-06): sidebar e painel direito recolhíveis de forma independente, com
  `aria-expanded`, tooltips, persistência local e calendário ocupando o espaço liberado.
- RF-09 (INC-07): Auditoria com dados reais, filtros existentes (calendário, tipo,
  limite), sem exibir snapshots `oldValue/newValue` (Q-006 — minimização).

## Requisitos não funcionais

- Migrations Flyway versionadas e não destrutivas (V8); legado CLIENT classificado como
  PENDING_CONFIRMATION (nunca presumido confirmado).
- Operações transacionais; autorização no backend; sem JWT/senha em logs.
- Sem nova dependência: gráficos em SVG próprio com tokens do tema.
- Light/Dark/System em todas as telas novas; PT-BR; acessível por teclado.

## Critérios de aceite

Os do SDD §18, verificados por testes automatizados (backend JUnit/H2, frontend Vitest) e
build. Itens dependentes de navegador/PostgreSQL real ficam registrados em `tasks.md`.
