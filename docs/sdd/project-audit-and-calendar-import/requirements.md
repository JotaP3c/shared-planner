# Auditoria, calendários e importação — requisitos

Data da solicitação: 11/11/2026. Fonte: anexo “Complete Project Audit, Business
Rules, Google Calendar Import & Financial Validation” e relatos/prints do dono.
Este complemento evolui 03/04/05/06/08/09/11 sem apagar evidências históricas.

## Requisitos aprovados nesta solicitação

- CAL-01: exatamente um calendário PERSONAL por usuário, provisionado no cadastro,
  com proprietário ADMIN. Usuários existentes recebem calendário novo sem mover
  eventos legados nem inferir propriedade pelo nome. Nenhum terceiro recebe vínculo.
- CAL-02: papéis globais permanecem ADMIN/FINANCE/USER por compatibilidade; papéis
  contextuais são combináveis (ex.: EDITOR+FINANCE). Administrar calendário não
  autoriza criar/alterar usuários do sistema. FINANCE global exige membership.
- CAL-03: usuário autenticado pode criar calendário compartilhado e adicionar outros
  administradores/participantes existentes conforme autorização contextual.
- APP-01: calendário SHARED novo exige consentimento dos outros participantes
  designados; criador não vota. Todos aprovam para APPROVED; qualquer rejeição
  rejeita. Guardar rodadas/histórico; mudança material reabre aprovação. Calendários
  anteriores são LEGACY, preservando a política atual até migração explícita.
- CLI-01: CLIENT apresenta uma descrição do serviço e telefone brasileiro opcional.
  Preservar os textos históricos, sem apagar observações existentes.
- REC-01: séries diárias, semanais, quinzenais, mensais e personalizadas com fuso
  explícito e horizonte finito; edição individual/série/futuras e cancelamento.
  Sobreposição não é conflito impeditivo sem regra aprovada; não criar bloqueio novo.
- IMP-01: preview ICS e confirmação com calendário origem/destino explícitos,
  UID/RECURRENCE-ID, timezone, exceções e deduplicação. Não inventar fim/preço/dono.
  Importação real requer fonte estruturada ou dados visuais completos e mapa confirmado.
- HOL-01: camada “Feriados no Brasil”, BR/2026, somente leitura, all-day,
  selecionável; sem membership, aprovação ou impacto financeiro.
- FIN-01: preservar pagamento/confirmacão separados, métricas e regras atuais;
  consolidar calendários autorizados sem duplicar IDs e validar outubro/novembro/
  dezembro com fixtures exclusivamente sintéticas de resultados conhecidos.
- UI-01: preservar login/tema/auditoria/layout que passam na baseline; corrigir
  apenas lacunas, compactar filtros e permitir recolher gráficos.

## Complemento real confirmado — 12/11/2026

O dono forneceu exportação ZIP e confirmou os destinos: agenda da Malu → PERSONAL
da Malu; agenda do João → PERSONAL do João; Birthdays → IMPORTED “Aniversários do
João”. Confirmou todo 2026 e autorizou backup, migrations e importação no banco de
desenvolvimento local. Fonte, mapa e relatórios detalhados permanecem fora do Git.
`IMPORTED` é calendário auxiliar privado, não um segundo PERSONAL. Provisionamento
para outro owner pela API exige ADMIN global, sem adicionar o operador como membro.
Eventos CLASS=PRIVATE/CONFIDENTIAL só podem ser importados com opt-in explícito,
gestão do destino PERSONAL/IMPORTED e owner como único membro.

## Limites

Sem commits/push, descarte de alterações, aplicação de migrations no banco local,
seeds de produção ou exportações privadas versionadas. A aplicação local foi
autorizada em 12/11, depois de testes isolados e backup com restore verificado.
Q-001 é resolvida quanto ao calendário
PERSONAL tipado; Q-002, bypass global Q-003, capacidade de pagamento Q-005 e retenção
Q-006 não recebem políticas adicionais por inferência.

## Aceite

Baseline executada antes de editar código. Casos de isolamento e autorização,
aprovação por participantes, rollback, recorrência finita, importação repetida,
telefone e financeiro trimestral devem passar; build e paridade nos standalones.
Relatar importações bloqueadas e limites reais, sem confundir teste com operação local.
