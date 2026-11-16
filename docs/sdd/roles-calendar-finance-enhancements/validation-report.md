# Validação — perfis, calendários, financeiro e Excel — revisão 13/11/2026

Fechamento em 16/11/2026: ver [relatório de publicação](publication-report.md).
O código permaneceu igual ao testado em 13/11. Os estados Git/runtime e a ausência
de commits/pushes descritos neste checkpoint antecedem a autorização posterior
do dono para publicar após os testes.

## Conferência final do SDD

A [matriz requisito por requisito](prompt-review.md) registra a releitura integral do
anexo. A revisão encontrou e corrigiu quatro lacunas: remover associações de perfis
inativos, atualizar os acessos da própria tela Membros após autorrevogação, impedir
truncamento Unicode no XLSX e reconciliar uma exceção de preço com a faixa solicitada.
Também acrescentou a prova funcional específica de Academia nas três visualizações.
Os checks atuais são 150 backend e 165 frontend nos dois contextos, com builds aprovados.

## Resultado e funcionamento já existente

Login/JWT, criação automática de pessoal, papéis contextuais combinados, proteção do
owner, aprovações por rodada/designados, descrição única/telefone, confirmação,
cancelamento, pagamento, recorrência e idempotência ICS já existiam. Foram preservados
e cobertos pela regressão. Baselines focadas antes das alterações: acesso frontend
23/23, calendário/financeiro frontend 37/37, autorização/evolução backend 21/21.

O catálogo configurável e o XLSX são funcionalidades novas. Os importados originalmente
PERSONAL receberam classificação/propriedade somente após o novo mapa explícito do
dono. As categorias backend de confirmação já eram mutuamente exclusivas; não foi
necessário refazer seu cálculo.

## Problemas identificados e correções

| Área | Problema observado | Correção validada |
|---|---|---|
| Acessos | decisões por nomes de papéis, sem configuração de perfil | catálogo único com 22 grants, sete perfis nativos e perfis personalizados |
| Operações | edição e pagamento compartilhavam controle visual | FINANCE_MANAGE independente de EVENT_EDIT, inclusive edição própria e edição de terceiros separadas |
| Revogação | menus/guard podiam reutilizar grants antigos | revalidar identidade e calendários, cancelar respostas antigas e negar grants não resolvidos |
| Delegação | caminhos legados/restauração podiam ampliar um gerente reduzido | teto de delegação também em PUT de membros, reset e ciclo de papéis globais |
| Calendários | classificação/destino divergiam do mapa novo | correção por ID/UID e snapshot, com ledger e auditoria |
| Feriados | seletor permitia esconder a camada | overlay permanente, fora do seletor, com deduplicação apenas visual |
| Financeiro | barras/rótulos pouco legíveis, painéis altos | linhas/áreas com tooltip, controles discretos e filtros com resumo recolhível |
| Mobile | SVG alargava a trilha implícita do grid | contenção `minmax(0,1fr)` e assert também no contêiner main.content |
| Exportação | XLSX ausente | quatro abas, três gráficos nativos, dados tipados e autorização por calendário |

## Perfis e matriz efetiva

Tela em Administração → Perfis e Permissões: listar/criar/editar/ativar perfis,
checkboxes por funcionalidade, associações por usuário/escopo e consulta efetiva.
Membros → Gerenciar acessos permite associações contextuais sem editar o catálogo
global. A [matriz e as regras do design](design.md) descrevem os perfis nativos.

AuthorizationService usa um único resolvedor. Perfis explícitos substituem o fallback
de papéis apenas naquele escopo; grants globais habilitam operações, vínculo/grants
contextuais limitam os dados. Perfil sem permissão ou contexto não resolvido nega.
Protegidos: owner e administrador essencial; último ADMIN tem lock ordenado no conjunto
ativo. Alterações de perfis/associações/papéis são auditadas. O JWT não congela grants.

RBAC: 15 testes de integração, incluindo permitido/negado, perfis simultâneos e distintos
por calendário, revogação com o mesmo token, REST direto, USERS_VIEW sem USERS_MANAGE,
pagamento sem edição, export VIEW+EXPORT, edição sem leitura de valores, bloqueio de
autoelevação e restauração/troca de papel acima do teto. Não se declara teste de corrida
multithread do último administrador; o lock foi revisado e o ciclo sequencial testado.

## Correção local de novembro

Antes: três usuários, cinco calendários, sete membros, 371 eventos, 365 identidades
importadas e Flyway V10. Backup custom de 133.650 bytes, SHA256 verificado, restaurado
em PostgreSQL isolado; contagens 3/5/7/371/393 logs/V10 conferidas. O mesmo JAR validado
aplicou V11/V12 primeiro no restore e depois no desenvolvimento local. Sem reset/drop.

O plano privado contém **45 entradas: 44 atualizações e um derivado autorizado**:
35 CLIENT no pessoal correto, seis PERSONAL e quatro SHARED em novo calendário com
os dois participantes ADMIN contextuais. Seis diferenças de título foram reconciliadas
por data/início únicos, UID e o mapa explícito, sem inferir dono do nome do arquivo.
O compromisso combinado foi desdobrado com autorização específica do dono; ambos
mantêm 15:30–17:00. O registro original conserva ID/UID, o derivado tem ID estável e
proveniência apontando para a origem no ledger.

Preview V10: 44 updates/um create, sem escrita. Apply no restore e local: 44/1;
repetição nos dois: **zero updates, zero creates, 45 alreadyApplied**. Após a carga:
372 eventos, seis calendários e nove membros. Cada operação tem snapshot anterior,
estado aplicado, origem, referência e auditoria. O script não sobrescreve edições
posteriores em uma repetição. Não houve exclusão/recriação dos 44 existentes.

Os quatro SHARED importados mantêm estado de migração e rodada anterior, sem convites
retrospectivos nem aprovação fabricada. Edição normal posterior segue o EventService
e as regras de aprovação. Um CLIENT já cancelado permanece cancelado; o estado não
foi reativado para aumentar artificialmente o total financeiro.

O relatório por registro, com IDs/UIDs/datas/destinos, está somente em
`C:\shared-planner-private\enhancements-20261112\classification-applied.md`.
Nenhuma das 45 entradas ficou sem tratamento. Eventos não listados foram preservados;
o evento sem título bloqueado na importação anterior continua fora desta classificação.

## Recorrência e preservação

Academia: duas séries semanais originais, segunda/quarta 16–17h, quatro componentes
ICS incluindo duas exceções deslocadas em julho. Comparação de todas as ocorrências
com DTSTART/RRULE/EXDATE/RECURRENCE-ID: **53/53 PASS**. Outubro sete, novembro nove,
dezembro cinco; exclusões e limites do ano importado preservados. Nenhuma série nova.

Checksums antes/depois coincidem para outubro (53 eventos), dezembro (46), os seis
eventos não importados, 365 identidades externas, três séries e 54 vínculos de
ocorrência (53 Academia + aniversário). Datas/horários das entradas corrigidas também
coincidem com a origem. Calendários auxiliares/legado foram mantidos.

## Feriados

Os dez feriados de 2026 do recurso existente coincidem com a
[publicação oficial do MGI](https://www.gov.br/gestao/pt-br/assuntos/noticias/2025/dezembro/confira-o-calendario-oficial-de-feriados-nacionais-e-pontos-facultativos-em-2026).
Novembro: 02, 15 e 20, all-day com fim exclusivo. Pontos facultativos não entram.
Permanecem fora do seletor e dos cálculos financeiros, sem escrita/aprovação. Equivalente
all-day importado pode ser suprimido apenas na renderização; o registro não é apagado.
Tests e navegador cobrem temas e visibilidade independente da seleção de calendários.

## Simulação financeira e conferência independente

Somente os 35 CLIENT explicitamente mapeados receberam simulação identificada por
`financial_simulation=true` e referência 12/11/2026. Faixas determinísticas por duração:
até15 →50; até30 →70; até45 →90; até60 →120; até90 →180; acima90 →250 reais.
Horários finais vieram da origem. O checkpoint de 12/11 havia mantido um valor de R$50
para 35 minutos; a revisão constatou que isso contrariava a faixa solicitada. Em 13/11,
um delta privado com snapshot reconciliou valor e recebimento para R$90. Agora os35
CLIENT seguem integralmente as faixas, sem exceção. A referência continua em 12/11.

Antes desse delta foi feito novo backup de 158.355 bytes, restaurado e conferido em
banco isolado: 3 usuários, 6 calendários, 9 membros, 372 eventos, 440 logs, 45 entradas
de ledger e V12. Preview: uma atualização/zero criações. Apply e repetição no restore
e no local: uma atualização, depois zero alterações/uma já aplicada. O ledger passou
a 46 operações sobre os mesmos 45 eventos corrigidos; nenhum pagamento ou evento novo.
O preview do plano original após o delta confirmou zero alterações, 44 já aplicadas
e uma modifiedSkipped: a repetição antiga preserva a correção posterior de preço.

Foram simulados 19 pagamentos integrais até12/11 inclusive, todos com `paid_at`
congelado em12/11/2026 23:59:59; 16 posteriores permanecem pendentes. Métodos suportados
PIX/CASH/DEBIT_CARD/CREDIT_CARD alternados por ordem determinística. A marca e o aviso
no Finance/XLSX deixam claro que não são preços nem transações reais.

| Recorte | Atendimentos | Prevista | Recebida | Pendente |
|---|---:|---:|---:|---:|
| Massa CLIENT completa, incluindo um cancelado pela equipe |35|R$3.640,00|R$2.000,00|R$1.640,00|
| Dashboard do pessoal corrigido, regra vigente exclui CANCELLED |34|R$3.520,00|R$1.880,00|R$1.640,00|

O cancelado representa R$120 simulados e é excluído da consulta financeira vigente;
não há divergência de soma. No dashboard são18 pagos/16 pendentes. A situação de
confirmação permanece independente do pagamento. Os quatro CLIENT legados somam
R$260 previstos/R$100 recebidos e foram preservados integralmente. PERSONAL/SHARED
não receberam receita. Fixtures isoladas anteriores continuam validando outubro,
novembro, dezembro, parcial, reembolso, remarcação e consolidação.

As somas foram calculadas a partir do plano/origem e comparadas com REST e Excel,
sem usar o total retornado pelo próprio summary como resultado esperado. Três contas
ativas foram consultadas no runtime isolado e local; listas/perfis/financeiro/export
obedeceram seus grants atuais. A auditoria encontrou duas contas ADMIN globais;
após confirmação explícita, a conta indicada foi alterada para FINANCE pela API,
com auditoria e proteção do administrador essencial. O estado final é um ADMIN
global e duas contas FINANCE.

A conta alterada passou de seis para quatro calendários visíveis; manteve ADMIN
no pessoal e no compartilhado. GET users/perfis globais passou a403; consulta/export
de financeiro privado sem vínculo é negada. A validação usou também token com
scope antigo de ADMIN: o backend aplicou o papel atual do banco e negou acesso,
confirmando a revogação. A outra conta FINANCE tem três calendários autorizados;
o Administrador vê seis. A conferência financeira foi repetida depois da mudança,
com os mesmos totais e identidades preservadas.

## Dashboard, filtros e XLSX

Linhas/áreas SVG com eixo temporal civil, valores BRL, tooltips, legenda, ausência de
dados e responsividade. Roscas com total/percentuais de categorias exclusivas; histórico
de remarcações é informação separada. Gráficos/filtros recolhíveis persistidos por
usuário; recolher não consulta novamente nem altera os filtros aplicados.

`GET /api/finance/export`: mesmos calendário(s)/datas aplicados, FINANCE_VIEW e
FINANCE_EXPORT em todos os IDs antes da consulta, IDs deduplicados, snapshot consistente.
Limites:20 calendários,1100 dias,10.000 atendimentos,2milhões de caracteres agregados e
32767 por célula. Datas1900–9999. Textos de usuário são células STRING, nunca fórmulas.
O limite de texto é reconferido em unidades UTF-16 depois da consulta SQL, inclusive
caracteres suplementares. Texto que ultrapassa a célula ou o orçamento agregado recebe
413; nenhum conteúdo é truncado silenciosamente. Textos válidos com32767 unidades
BMP/suplementares foram preservados integralmente nos testes de fronteira.

Apache POI6.0.0: `poi-ooxml` + schemas completos necessários para rosca, conforme
[documentação oficial de schemas](https://poi.apache.org/help/faq.html).
Abas Dashboard/Appointments/Payments/Calendar Summary, três gráficos nativos editáveis,
BRL numérico, datas Excel, filtros, congelamento, legendas e marca de simulação.
Payments contém snapshots do modelo atual; não inventa ledger, datas ou valores de
reembolso que o Event não armazena.

15 testes XLSX passaram (estrutura, valores, vazio, limites, Unicode, injeção, autorização,
consolidação). POI reabriu o artefato sintético. **Microsoft Excel16.0 também abriu**
o sintético e a exportação local, somente leitura, sem reparação: quatro abas e três
gráficos; a exportação revisada de13/11 tem A7:D7 =3520/1880/1640/34. Arquivos/capturas reais
permanecem privados. Não se substituiu XLSX por CSV ou imagens de gráficos.

## Checks executados

| Check | Resultado |
|---|---|
| Backend monorepo |150/150,21 suítes,0 falhas/erros/skips|
| Backend standalone |150/150,21 suítes,0 falhas/erros/skips|
| PostgreSQL real isolado |V1–V12; legado/defaults/constraint simulação/ledger/idempotência PASS|
| Frontend monorepo |165/165,23 arquivos; revisão de Perfis/Membros23/23|
| Frontend standalone |165/165,23 arquivos; build produção PASS|
| Builds frontend |PASS nos dois contextos,0 warnings,1 rota pré-renderizada|
| Backend package |PASS; JAR atual executado no local após backup/restore|
| Ferramenta de correção |10/10, incluindo quatro integrações PostgreSQL isoladas|
| Navegador sintético |8 temas/resoluções +2 Perfis positivos, SO/storage/reload,4 downloads PASS|
| Navegador real |login,6 calendários, Academia em11/11 das16–17h no mês/semana/dia, financeiro/gráficos; somente leitura PASS|
| NPM produção |audit --omit=dev:0 vulnerabilidades|
| Paridade oficial |149/149 backend e124/124 frontend; PASS após último sync de Shell|

Build: initial395,22kB/CSS67,08kB. Capturas reais em
`C:\shared-planner-private\qa-evidence\2026-11-13-sdd-review`; relatórios e workbooks em
`C:\shared-planner-private\enhancements-review-20261113`. Evidências de12/11 permanecem
preservadas nas pastas anteriores. A execução inicial do navegador nesta revisão falhou
porque o processo local de frontend foi iniciado sem proxy-config; o processo foi
reiniciado com a configuração do projeto e o check final passou. O teste aguarda a hidratação antes do login.
Nenhum ajuste de credencial ou de regra de autenticação foi necessário.
Na conferência final, API8080 e proxy4200 responderam health200; PostgreSQL5432 e
frontend4200 permaneceram ativos. O PostgreSQL de testes54629 foi encerrado.

## Arquivos, banco e limites

V11 cria catálogo/associações e sete perfis nativos; V12 adiciona marca de simulação e
ledger de correções. Nenhuma migration histórica foi modificada; V1–V10 preservadas.
Grupos alterados: access/config/auth/user/calendar/event/finance backend, controllers
e tests; modelos/serviços/guards/shell/tela de perfis/Members/Calendar/Finance/Users,
gráficos/styles/browser frontend; CLI de correção, testes, README e SDD. A relação
dos paths e o estado Git final ficam em [changed-files.md](changed-files.md).

Limites: sessão JWT existente não foi redesenhada; não há sincronização Google
bidirecional; nenhuma aprovação foi fabricada; a exportação não cria histórico
financeiro ausente. QA manual final do dono continua apropriado. Q-002/003/005/006,
hardening amplo e CI fora do escopo não são declarados concluídos por esta entrega.
Nenhum novo commit/push nesta rodada; `.vscode/` e `docs/reffs/` locais preservados.
