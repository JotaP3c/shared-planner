# Matriz inicial e tarefas

Estados seguem o anexo. Evidência de baseline anterior à implementação nesta rodada.

| Módulo | Estado inicial | Evidência / testes | Trabalho necessário |
|---|---|---|---|
| Login/tema | IMPLEMENTED_AND_VALIDATED | login/theme specs, baseline frontend | preservar; QA visual separada |
| Usuários | IMPLEMENTED_WITH_BUGS | autoproteção testada; calendário pessoal ausente | provisionamento transacional e limite de e-mail coerente |
| Calendário próprio | NOT_IMPLEMENTED | entidade sem tipo, cadastro sem provisão | CAL-01 + V9 + backfill isolado |
| Permissões | PARTIALLY_IMPLEMENTED | financeiro exige vínculo; um papel apenas | papéis combináveis + negativos |
| Compartilhamento | PARTIALLY_IMPLEMENTED | criação só globalADMIN | criação por autenticado/múltiplosadmins |
| Aprovações | PARTIALLY_IMPLEMENTED | um alvo SHARED e reabertura testados | múltiplos designados/histórico |
| Multicalendário | IMPLEMENTED_AND_VALIDATED | CalendarPage já seleciona todos e consulta por ID | preservar e ampliar regressão |
| CLIENT descrição/telefone | IMPLEMENTED_WITH_BUGS | formulário com dois textos e sem telefone | CLI-01 sem perda de legado |
| Pagamento/confirmacão | IMPLEMENTED_AND_VALIDATED | matriz18, confirmação10, finance4 na baseline | preservar regras; testes trimestrais |
| Recorrência | NOT_IMPLEMENTED | sem entidade/API/UI | REC-01 |
| Importador ICS | NOT_IMPLEMENTED | sem API/UI | IMP-01 preview/commit idempotente |
| Importação real Google | BLOCKED | sem pasta google-calendar-2026 ou arquivo ICS | requer fonte/mapa inequívoco; prints insuficientes |
| Feriados BR2026 | NOT_IMPLEMENTED | sem catálogo | HOL-01 com fonte oficial |
| Finance consolidado | PARTIALLY_IMPLEMENTED | UI apenas um calendário | consolidação autorizada + fixtures 3 meses |
| Layout/auditoria | IMPLEMENTED_AND_VALIDATED | sidebar/painel/audit specs | preservar; compactar filtros/gráficos |
| Migrations locais | BLOCKED | sem autorização de backup/aplicação | testar em banco isolado, não no local |

- [x] Auditar estado Git, SDD, fontes e baseline antes de código.
- [x] Especificar complemento sem apagar histórico.
- [x] Implementar calendários, permissões, aprovações e CLIENT.
- [x] Implementar recorrência e importador, inclusive YEARLY e opt-in privado seguro.
- [x] Implementar catálogo de feriados e camada visual.
- [x] Validar fixtures financeiras de outubro/novembro/dezembro.
- [x] Integrar frontend e testar contratos/fluxos.
- [x] Executar regressão/build/audit/migrations isoladas.
- [x] Sincronizar standalones e verificar paridade.
- [x] Registrar resultados reais e limitações nos relatórios.

## Atualização operacional — 12/11/2026

O ZIP real e o mapa foram confirmados pelo dono, superando os bloqueios iniciais de
fonte e aplicação local. Backup com restore isolado PASS; V9/V10 aplicadas depois de
V8 já existente. Importação real 365, repetição 0 novas/365 duplicadas, 1 sem título
bloqueado, 101 UIDs fora da janela de 2026. Ver data-import-report e validation-report.
Pendências reais: título ausente, QA manual final, políticas Q-002/003/005/006 não
definidas por esta entrega. Não reabrir funcionalidades já aprovadas por testes.
