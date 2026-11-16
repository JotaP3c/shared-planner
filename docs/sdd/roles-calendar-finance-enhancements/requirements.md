# Requisitos — perfis, calendários e financeiro

Baseline publicada: monorepo `c52b324`, backend `060bcd9`, frontend `ba4d9b4`.
Este complemento atende ao SDD recebido em 12/11/2026 sem substituir o histórico.

- RBAC-01: catálogo único de permissões explícitas, perfis globais e contextuais
  configuráveis, associações múltiplas e consulta de permissões efetivas.
- RBAC-02: backend aplica autorização por operação e calendário; UI/URLs usam os
  grants efetivos. Ausência de grant nega. Administradores essenciais e owner protegidos.
- RBAC-03: catálogo global somente para ROLES_MANAGE; administrador contextual gerencia
  apenas associações de membros de calendários que administra, sem promover globalmente.
- DATA-01: corrigir apenas eventos identificados no mapa explícito de novembro do dono,
  por IDs/UIDs, preservando identidade, relacionamentos, duração e alterações válidas.
  Mapa, títulos reais e evidência por registro ficam na pasta privada fora do Git.
- DATA-02: correção idempotente com backup, preview, snapshot anterior e ledger.
  Correções de importação não disparam convites retrospectivos nem fabricam aprovações.
- DATA-03: desdobramento de um compromisso combinado em dois autorizado pelo dono,
  preservando 15:30–17:00 em ambos, com proveniência do registro derivado.
- REC-01: preservar série Academia, segunda/quarta 16–17h, limites e exceções do ICS.
- HOL-01: feriados nacionais de 2026 sempre visíveis, all-day, fora do seletor e do
  financeiro; suprimir duplicação visual de feriado importado sem excluir dados.
- SIM-01: seed local determinístico por duração para todos os 35 CLIENT explícitos,
  R$50–250, referência congelada no fim de 12/11/2026 e métodos suportados alternados.
  Reconciliar valores dessa massa com as faixas solicitadas, retendo o estado anterior
  no ledger. Preservar os registros fora da massa e os pagamentos futuros válidos;
  marcar a simulação de forma durável e impedir operação em produção.
- FIN-01: aprimorar gráficos, tooltips, legendas e responsividade sem mudar os totais;
  confirmação usa categorias exclusivas, remarcações históricas não compõem percentuais.
- FIN-02: filtros recolhíveis com resumo dos filtros aplicados; recolher/expandir sem
  consultar novamente nem apagar seleção; controle discreto de gráficos persistente.
- XLSX-01: exportar mesmos calendários e período do dashboard em quatro abas com
  dados numéricos/datas e três gráficos nativos editáveis, incluindo marcação de simulação.
- XLSX-02: exigir FINANCE_VIEW+FINANCE_EXPORT por calendário, limites de volume,
  conteúdo textual seguro, erros/loading no download e testes reabrindo o workbook.

Reusar login/JWT, papéis combinados, isolamento pessoal, aprovações, confirmação,
pagamentos, recorrência e importação já validados. Não publicar dados privados, não
apagar eventos, não alterar produção, não executar migrations destrutivas. Esta rodada
não inclui novos commits/pushes sem autorização específica para as novas mudanças.
