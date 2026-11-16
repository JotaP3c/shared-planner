# Publicação — perfis, calendários e financeiro — 16/11/2026

O dono autorizou testar todas as melhorias e, com os resultados aprovados, fazer
commits separados por rotina e push em cada repositório. A continuação de 16/11
retomou esse fechamento. Não foi repetida a importação ou a correção de dados.

## Evidências para publicar

A última execução completa ocorreu em **13/11/2026**. Em **16/11/2026** foi conferido
que nenhum código de backend/frontend mudou depois desses checks; a separação dos
commits também preservou os bytes do código validado. Não se declara uma nova
execução das suítes em 16/11. A matriz [prompt-review.md](prompt-review.md) cobre as
seções 2–16 e os 20 itens finais do SDD; as quatro lacunas encontradas foram corrigidas.

| Verificação | Monorepo | Standalone |
|---|---|---|
| Backend, incluindo PostgreSQL/Flyway V1–V12 | 150/150, 21 suítes | 150/150, 21 suítes |
| Falhas/erros/ignorados backend | 0/0/0 | 0/0/0 |
| Frontend | 165/165, 23 arquivos | 165/165, 23 arquivos |
| Build frontend | PASS, 0 warnings, 1 rota pré-renderizada | PASS, 0 warnings, 1 rota pré-renderizada |
| Paridade oficial em 16/11 | backend 149/149 | frontend 124/124 |

Ferramenta de correção: **10/10**, incluindo quatro testes PostgreSQL isolados.
Navegador sintético: oito combinações de tema/resolução, dois cenários de perfis,
preferências de sistema/storage/reload e quatro downloads XLSX aprovados.
Navegador real: login, seis calendários, Academia das 16h às 17h em mês/semana/dia
e financeiro aprovados; esse check fez somente leitura após o login.

As suítes cobrem autorização positiva/negativa, revogação, proteção do owner e do
administrador essencial, delegação, pagamentos independentes de edição, criação de
calendários, aprovações, importação idempotente, recorrências/exceções, feriados,
confirmação/cancelamento, filtros e exportação. O XLSX foi reaberto em Microsoft
Excel 16: quatro abas, três gráficos nativos e totais numéricos conferidos.

O recorte simulado ativo continua em R$3.520 previstos, R$1.880 recebidos e R$1.640
pendentes. A referência financeira permanece congelada em 12/11/2026; os valores
são simulação identificada. A diferença para a massa completa de 35 CLIENT é o
registro cancelado de R$120, preservado. Detalhes e limites em
[validation-report.md](validation-report.md).

## Commits separados por rotina

Bases antes desta publicação: monorepo `c52b324`, backend `060bcd9`, frontend `ba4d9b4`.
Os três estavam em `main`, alinhados a `origin/main` após fetch em 16/11, sem incoming.
Conta GitHub conferida: `JotaP3c`. Autor e committer: João Pedro Corrêa, com a
identidade já adotada pelo projeto. Nenhuma configuração global foi alterada.

| Rotina | Monorepo | Standalone |
|---|---|---|
| Backend: catálogo, perfis e permissões | `009bf8d` | `3787b04` |
| Backend: proveniência da simulação/V12 | `d7decda` | `4ca8d82` |
| Backend: XLSX com gráficos nativos | `bf4123e` | `148ff0b` |
| Documentação backend | `3581ae5` | `9f8e2b8` |
| Frontend: gráficos interativos | `065315f` | `2211212` |
| Frontend: perfis, calendários e controles por operação | `47c7a7c` | `e5e3cd4` |
| Frontend: painel financeiro, filtros e download | `1dedbcd` | `5951839` |
| Navegador: cenários de permissões e recorrência | `0c06177` | `d51df41` |
| Documentação frontend | `5f58ee3` | `7473e8e` |
| Ferramenta de correção e testes | `3314dec` | somente monorepo |
| SDD e fechamento da entrega | commit que contém este relatório | somente monorepo |

São **11 commits no monorepo, quatro no backend e cinco no frontend**, com o padrão
`feat/fix/test/chore/docs(escopo): descrição` usado pelo projeto. O teste de migrations
que exige V12 acompanha a simulação. As expectativas de grants do teste FinancePage
acompanham a integração RBAC; os testes dos novos controles e do XLSX acompanham
o painel financeiro. O conteúdo final dos arquivos permaneceu inalterado.

## Fechamento Git e proteção dos dados

Os pushes usam os remotos existentes em `main`, pela conta conferida, sem force.
A verificação de fechamento compara o HEAD local com `refs/heads/main` remoto e
confere `HEAD...origin/main` em cada repositório. Os hashes finais são informados
na entrega ao dono; o próprio commit deste relatório contém o fechamento documental.

Somente código, testes e documentação autorizados foram selecionados para os commits.
ICS/ZIP, backups, planos reais, dumps, capturas, workbooks, configurações de runtime,
credenciais e evidências privadas permanecem fora do Git. `.vscode/` e `docs/reffs/`
locais foram preservados. Nenhuma alteração adicional de banco foi necessária
para a publicação. Migrations V1–V10 continuam intactas; V11/V12 são aditivas.

As frases “nenhum novo commit/push” nos relatórios de 12/11 e 13/11 são históricas:
antecedem a autorização posterior de publicação. O QA manual do dono, as decisões
abertas explicitamente fora deste SDD e os limites de importação/snapshot financeiro
continuam documentados; não são encerrados pela contagem de testes.
