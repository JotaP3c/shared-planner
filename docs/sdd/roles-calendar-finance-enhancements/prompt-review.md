# Conferência do SDD original — 13/11/2026

Publicação autorizada posteriormente pelo dono: ver o
[fechamento de 16/11/2026](publication-report.md). A restrição de novos commits/pushes
na matriz abaixo descreve o checkpoint desta revisão, anterior à autorização.

Revisão independente do anexo **RBAC, Correção dos Calendários, Gestão Financeira e
Exportação Excel**, solicitada pelo dono na continuação. A leitura foi confrontada
com código, testes e evidências privadas, sem repetir a importação nem inferir
propriedade por nome de arquivo ou título. Os resultados de 12/11 continuam sendo
checkpoints históricos; as alterações desta revisão foram validadas separadamente.

## Lacunas encontradas nesta conferência

| ID | Requisito do SDD | Divergência comprovada | Correção validada | Estado |
|---|---|---|---|---|
| REVIEW-01 | 3.4/3.5: ativação, associação e edição dos acessos | Perfil inativo já associado ficava marcado e desabilitado, impedindo sua remoção pela tela | Permitir desmarcar a associação inativa existente sem permitir concedê-la novamente; cobrir Perfis e Membros | PASS |
| REVIEW-02 | 3.6/3.7: controles coerentes após revogação | O membro que revogava o próprio acesso podia manter controles baseados no calendário carregado antes da mudança | Recarregar grants contextuais e fechar/limpar a gestão quando o próprio acesso for perdido; manter backend como autoridade | PASS |
| REVIEW-03 | 10.4/10.8: arquivo Excel válido e textos preservados | Limite de texto podia cortar entre os dois caracteres UTF-16 de um caractere suplementar | Validar limites UTF-16 antes da geração, rejeitar excesso com 413 e preservar integralmente texto válido | PASS |
| REVIEW-04 | 7.2: preço de todos os CLIENT conforme duração | Um dos 35 CLIENT tinha 35 minutos e manteve R$50, embora a faixa definida seja R$90; a preservação não foi uma exceção autorizada nesse requisito | Delta privado idempotente de valor/recebimento simulado, com snapshot, backup e ledger, mantendo a referência congelada e o estado do evento | PASS |

A correção de REVIEW-04 acrescenta R$40 à massa e ao dashboard ativo. Valores finais,
conferidos por REST e Microsoft Excel: massa 35 CLIENT = R$3.640 previstos,
R$2.000 recebidos e R$1.640 pendentes; recorte ativo de 34 = R$3.520/R$1.880/R$1.640.
O CLIENT cancelado de R$120 deve continuar cancelado. O delta foi aplicado e repetido tanto no restore quanto no local: uma atualização,
depois zero alterações/uma já aplicada. Nenhum evento ou pagamento foi criado.

Foi encontrada também uma **lacuna de evidência**, sem erro de dados confirmado:
o navegador alternava Mês/Semana/Dia, mas não afirmava especificamente a ocorrência
Academia das 16h às 17h nas três visualizações. O check real de leitura passou em
11/11/2026, com capturas privadas de cada vista e apenas o calendário correto selecionado.

## Matriz de rastreabilidade por seção

| Seção do anexo | Evidência existente | Resultado da conferência |
|---|---|---|
| 2 — Auditoria antes de implementar | Histórico dos três HEADs, baselines e descoberta em design/validation-report | ATENDIDO; sem recriar login, pagamento, confirmação ou importador |
| 3.1–3.3 — Dois níveis e catálogo único | `access/Permission`, `PermissionResolver`, `AuthorizationService`; 22 grants, sete perfis nativos e perfis personalizados | ATENDIDO; papéis legados são mapeamentos, não outro mecanismo de autorização |
| 3.4 — Tela de Perfis e Permissões | `features/access/access-page`, API `/api/access`, specs e navegador positivo/negativo | ATENDIDO; REVIEW-01 PASS |
| 3.5 — Gerenciar acessos do calendário | `members-page`, associações contextuais e consulta efetiva; proteção de owner e teto de delegação | ATENDIDO; REVIEW-01/02 PASS |
| 3.6–3.7 — Segurança e testes | `AccessControlIntegrationTests`, guards, AuthService, AppShell e Members specs; REST, revogação, usuários somente leitura e autoelevação | ATENDIDO; revisão de Perfis/Membros23/23 e regressão frontend165/165 |
| 4.2–4.3 — Mapa de novembro | Comparação independente das 45 linhas com o plano privado, por data/início/tipo e UID | 35 CLIENT, seis PERSONAL, quatro SHARED; destinos conferidos |
| 4.4 — Identidade, idempotência e aprovação histórica | CLI, snapshots, ledger, auditoria e relatórios apply/repeat isolados e locais | 44 IDs existentes preservados e um derivado autorizado; repetição anterior zero updates/creates, 45 já aplicados; estados compartilhados preservados |
| 5 — Academia | Comparação independente do ZIP bruto com os dados materializados: duas séries WEEKLY, duas exceções deslocadas, 53 ocorrências | DADOS ATENDIDOS; prova específica Mês/Semana/Dia PASS |
| 6 — Feriados permanentes | Recurso BR-2026 com dez datas e fonte MGI; overlay separado e testes CalendarPage/HolidayService/navegador | ATENDIDO: fora do seletor, all-day, sem receita/escrita/aprovação e sem duplicação visual equivalente |
| 7.1–7.3 — Simulação e pagamentos | Campos duráveis de simulação/referência, 35 CLIENT, 19 pagos e 16 pendentes, quatro métodos suportados | ATENDIDO;35/35 faixas conferidas,19 pagos/16 pendentes, referência12/11 preservada |
| 7.4 — Consistência | Separação de status do evento, confirmação e pagamento; conferência independente com summary e workbook | ATENDIDO; massa3640/2000/1640 e dashboard3520/1880/1640 conferidos, cancelado preservado |
| 7.5 — Outros meses | Checksums de outubro/dezembro, seis não importados, 365 identidades e três séries; `QuarterFinanceIntegrationTests` | ATENDIDO; eventos não listados e recorrência não foram redistribuídos |
| 8 — Dashboard | Linhas/áreas, tooltips BRL, roscas exclusivas, total central, legendas, controles discretos e preferência por usuário | ATENDIDO, incluindo contenção do gráfico no mobile; dados reais do backend |
| 9 — Filtros recolhíveis | FinancePage/specs: filtros aplicados separados dos valores em edição, resumo, preferências e consultas contadas | ATENDIDO; recolher/expandir não busca nem apaga seleção |
| 10.1–10.5 — XLSX e integração | FinanceExportService/Workbook/Controller, FinanceService frontend e specs; quatro abas e três gráficos nativos | ATENDIDO; loading/erro/download, datas e moedas numéricas, filtros e congelamento; REVIEW-03 PASS |
| 10.6–10.8 — Segurança e validação Excel | VIEW+EXPORT em cada ID, deduplicação, limites de linhas/datas/textos, células STRING; reabertura POI e Excel16 documentada | ATENDIDO;15 testes XLSX, casos Unicode e reabertura Excel16 com3520/1880/1640/34 PASS |
| 11–12 — Regressão e três identidades | Suítes backend/frontend/CLI e checks funcionais privados; mudança global autorizada para FINANCE com ADMIN próprio/compartilhado preservado | ATENDIDO;150 backend/165 frontend nos dois contextos, navegador e três identidades reais PASS |
| 13 — Documentação | requirements, design, tasks, validation-report e changed-files no diretório solicitado | ATENDIDO; números atuais e delta de preço incorporados ao relatório |
| 14 — Execução e 15 — Restrições | Auditoria, implementação, plano/backup/restore, aplicação local e verificações; arquivos reais fora do Git | ATENDIDO; sem produção, exclusão de eventos, migration destrutiva ou novos commits/pushes |
| 16 — Relatório final | Matriz abaixo e seções correspondentes do validation-report | ATENDIDO; os 20 tópicos e os resultados desta conferência constam no relatório |

Os paths de código acima se referem à cópia do monorepo; a paridade com os
standalones foi reconferida após as correções:149/149 backend e124/124 frontend, PASS.

## Os 20 itens exigidos no relatório final

| Item | Onde está documentado |
|---|---|
| 1 — Funcionalidades já corretas | Resultado e funcionamento já existente |
| 2 — Bugs identificados | Problemas identificados e correções; lacunas desta revisão |
| 3 — Bugs corrigidos | Mesma tabela, com resultado de testes por correção |
| 4 — Tela de perfis | Perfis e matriz efetiva |
| 5 — Matriz final | Design: matriz nativa contextual e regras globais/contextuais |
| 6 — Eventos corrigidos | Correção local de novembro; detalhe privado por registro |
| 7 — Não corrigidos e justificativas | Nenhuma das 45 entradas pendente; sem título anterior e eventos fora do mapa mantidos fora da classificação |
| 8 — Recorrências | Recorrência e preservação; comparação do ZIP e check visual específico nas três vistas PASS |
| 9 — Feriados | Feriados, catálogo e fonte oficial |
| 10 — Valores de teste | Simulação financeira;35/35 faixas reconciliadas e conferidas |
| 11 — Pagamentos simulados | Mesma seção: referência congelada, quantidades e métodos |
| 12 — Gráficos | Dashboard, filtros e XLSX |
| 13 — Filtros recolhíveis | Mesma seção e testes FinancePage |
| 14 — Excel implementado | Mesma seção: quatro abas e três gráficos nativos |
| 15 — Abertura do XLSX | Reabertura POI e Microsoft Excel16, com métricas conferidas |
| 16 — Testes | Checks executados;150 backend e165 frontend nos dois contextos |
| 17 — Builds | Checks executados: frontend nos dois contextos e package backend |
| 18 — Arquivos modificados | changed-files.md com estado Git dos três repositórios |
| 19 — Migrations | Arquivos, banco e limites: V11/V12 aditivas, anteriores preservadas |
| 20 — Pendências e limitações | Arquivos, banco e limites; quatro correções e evidência de recorrência aprovadas nesta revisão |

## Limites reais preservados

- A data financeira continua congelada no encerramento de **12/11/2026**, mesmo
  quando os checks são executados em 13/11; não avançar o seed com a data do relógio.
- Payments reflete o snapshot do Event. O modelo não fornece ledger nem histórico
  detalhado de reembolso, e o relatório não deve inventá-los.
- A materialização da importação permanece no ano de 2026 explicitamente autorizado;
  a comparação da série não declara importação ilimitada de anos futuros.
- QA manual final do dono e decisões históricas fora deste SDD não são encerradas
  por uma contagem de testes. Mapa real, IDs/UIDs, dados de clientes e workbooks
  reais permanecem somente na pasta privada, fora dos três repositórios.
