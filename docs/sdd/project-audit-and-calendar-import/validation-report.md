# Relatório de validação — auditoria e importação

Atualização após autorização para commits e pushes: a nova regressão passou nos
dois contextos; commits separados por rotina e evidências em
[publication-report.md](publication-report.md). As seções Git abaixo registram o
checkpoint anterior à publicação.

## Resultado final — 12/11/2026

| Módulo | Estado anterior | Problema encontrado | Correção/entrega | Resultado executado |
|---|---|---|---|---|
| Login/tema | IMPLEMENTED_AND_VALIDATED | nenhuma divergência funcional nova | preservado | testes + 8 cenários reais de navegador com fixtures sintéticas |
| Calendários próprios | NOT_IMPLEMENTED | cadastro sem pessoal, filtro só tinha agenda legada | PERSONAL por usuário, owner ADMIN, backfill sem mover eventos | evolução + V9 PostgreSQL + 3 pessoais reais, sem duplicidade |
| Papéis por calendário | PARTIALLY_IMPLEMENTED | enum singular não representava EDITOR+FINANCE | roles combináveis, compatibilidade e autorização contextual | testes positivos/negativos PASS |
| Compartilhamento | PARTIALLY_IMPLEMENTED | criação só globalADMIN e um aprovador | criação autenticada, administradores contextuais, múltiplos designados/rodadas | testes PASS; sem consentimento do próprio criador |
| Consistência de mutações | IMPLEMENTED_WITH_BUGS na revisão nova | pagamento/confirmacão podiam disputar estado com aprovação | mesmo lock nas mutações, batches para evitar N+1 de aprovações | testes de estado e 60 eventos/consultas limitadas PASS |
| CLIENT | IMPLEMENTED_WITH_BUGS | dois textos redundantes, sem telefone | descrição única preservando legado, telefone BR opcional | API/formulário/mascara PASS |
| Recorrência | NOT_IMPLEMENTED | sem séries | finita, individual/ALL/FUTURE, fuso e exceções | engine/integração PASS, 3 séries reais/54 ocorrências |
| Importação | NOT_IMPLEMENTED | sem parser/preview/deduplicação | ICS separado por origem/destino, opt-in privado seguro | 365 reais, 365 duplicados na repetição, 0 novas |
| Feriados | NOT_IMPLEMENTED | sem camada | 10 feriados oficiais BR/2026, leitura/all-day | 3 testes PASS, navegador e sem efeito financeiro |
| Financeiro | PARTIALLY_IMPLEMENTED | sem consolidação; label pendente incorreto com desmarcação | soma de calendários autorizados, label fiel, gráficos recolhíveis | fixtures trimestrais + gráficos reais PASS |
| Membros/Usuários/Auditoria/Settings | IMPLEMENTED_AND_VALIDATED na baseline | ajustes necessários para novos papéis e e-mail180 | funcionalidades preservadas, capacidades combinadas | regressões PASS |
| Intervalo importado | IMPLEMENTED_WITH_BUGS na revisão | edição de conteúdo podia encurtar evento entre datas | intervalo original preservado; campos só leitura com aviso | all-day e timed overnight PASS |
| Filtro/visual móvel | IMPLEMENTED_WITH_BUGS na revisão de navegador | Escape com foco no opener não fechava; data/badge cortados | Escape no documento, retorno de foco, wrap/badge por tokens | regressões e navegador PASS |
| Runtime local | IMPLEMENTED_WITH_BUGS | frontend C:\git e backend C:\Kiro com contratos distintos; proxy ::1 | JAR validado C:\git e proxy IPv4 explícito | health direto/proxy200, login e gráficos reais PASS |

### Checks finais executados

| Verificação | Monorepo | Standalone |
|---|---|---|
| Backend `mvnw.cmd ... test` | **120/120**, 18 suítes, 0 falhas/erros/skips | **120/120**, 18 suítes, 0 falhas/erros/skips |
| PostgreSQL Flyway opt-in | PASS V1–V10 em schema isolado novo | PASS em schema isolado novo |
| Frontend `npm.cmd test -- --watch=false` | **130/130**, 21 arquivos | **130/130**, 21 arquivos |
| Build frontend produção | PASS, 0 warnings, 1 rota pré-renderizada | PASS, 0 warnings, 1 rota pré-renderizada |
| Backend package | PASS; runner usa JAR atual | fonte equivalente, testes aprovados |
| Audit produção | `npm.cmd audit --omit=dev`: **0** | mesmo package-lock, sem alteração de dependências nesta rodada |
| Navegador com fixtures sintéticas | 8 cenários: claro/escuro × 1440×900, 1280×720, 1024×640, 390×844; telefone, modal, guard, consolidação, feriado, SO/storage/reload | código equivalente |
| Navegador no runtime real | login local, 5 calendários + feriados, mês/semana/dia, receita/gráficos/confirmação | API e frontend reais do monorepo |
| Paridade oficial | **REPOSITORY_SYNC PASS**, backend130/130 e frontend115/115 | metadados .git e arquivos locais preservados |

Build final: initial 390,57 kB, CSS 63,14 kB, calendário lazy 362,60 kB. Sem novo
framework de UI/gráficos ou dependência de produção. Playwright usado do cache externo
como ferramenta de teste; não introduz mocks na aplicação. Testes de UI sintéticos
interceptam HTTP somente no processo de teste; o check real não intercepta APIs.
Capturas reais ficam em `C:\shared-planner-private\qa-evidence\2026-11-12`.

### Fixtures financeiras isoladas — resultados esperados e confirmados

Dois calendários sintéticos, 8 CLIENT por mês, mais PERSONAL/SHARED/cancelado que não
entram em receita. Incluem parcial, reembolso, desmarcado com valor recebido e remarcado
no mesmo Event. Nomes e e-mails são fictícios `.invalid`; transações H2 fazem rollback.
Nenhum desses valores foi atribuído aos eventos reais ou carregado no banco local.

| Mês | Prevista | Recebida | Pendente | Atendimentos |
|---|---:|---:|---:|---:|
| Outubro/2026 | R$ 990,00 | R$ 460,00 | R$ 580,00 | 8 |
| Novembro/2026 | R$ 1.980,00 | R$ 920,00 | R$ 1.160,00 | 8 |
| Dezembro/2026 | R$ 2.970,00 | R$ 1.380,00 | R$ 1.740,00 | 8 |

`QuarterFinanceIntegrationTests`: 5 execuções PASS (três meses, limites civis e
isolamento por papel). Summary/timeline/recentes concordam; parcial não é integral;
remarcação não cria outro atendimento; camada de feriados não grava Events; importação
PERSONAL não altera receita. Testes adicionais cobrem recorrência CLIENT, idempotência,
rollback e decisões independentes nas ocorrências. O financeiro real preservou os
valores anteriores: R$ 210,00 prevista/R$ 50,00 recebida no consolidado de novembro.

### Backup, migrations e preservação reais

Autorização explícita em 12/11. pg_dump custom fora do Git, 25.697 bytes, catálogo
verificado e restore completo em `audit_restore_20261112061029` na porta isolada54629.
Contagens conferidas: 3 usuários, 1 calendário, 3 membros, 5 eventos, 13 logs, V8.
Só depois disso o backend atual aplicou **V9/V10**; V8 já estava aplicada. V1–V8
permanecem intactas. Não houve drop, reset, alteração de senha ou redistribuição de eventos.

Após a carga: 370 eventos = 5 anteriores + 365 importados; checksum dos campos
históricos dos 5 eventos inalterado. 365 identidades distintas, 3 séries/54 ocorrências,
3 calendários PERSONAL (um por usuário), 1 IMPORTED privado e 1 LEGACY preservado.
Nenhum terceiro recebeu acesso aos novos pessoais/auxiliar. Fonte ZIP e mapa privados
fora do Git; detalhes em data-import-report.

### Intercorrências e limites

- Expectativa inicial de teste para não membro foi corrigida de403 para404, mantendo
  o contrato de ocultação; produto não foi relaxado para passar teste.
- Empacotar JAR em execução falhou no Windows por arquivo aberto. Runner próprio foi
  parado, package reexecutado com sucesso e runtime reiniciado; dados preservados.
- Durante edição o dev-server exibiu um erro TS transitório de tipo do handler; corrigido,
  build e navegador final passaram. Não foi aceito como resultado final.
- 1 evento sem título não importado; 101 UIDs fora de2026 não materializados. Nenhuma
  informação ausente foi inventada. Importador não é sincronização bidirecional: mantém
  registros já importados para preservar alterações locais, reportando duplicados.
- Formatos ICS fora do subconjunto documentado ficam bloqueados com motivo. Dados
  privados exigem opt-in e destino exclusivo do owner. Política futura de compartilhar
  esse calendário continua sendo uma ação deliberada do owner, não efeito da carga.
- Edição de horário em importações entre dias é somente leitura para preservar o intervalo;
  alterar conteúdo funciona. Um formulário geral de datas distintas segue evolução própria.
- Contraste AA/leitor de tela completos e QA manual do dono continuam pendentes;
  testes de navegador não equivalem a certificação de acessibilidade.
- Q-002/003/005/006, sessão JWT, hardening S2/S3 e CI não recebem decisões implícitas.
- No checkpoint anterior à autorização de publicação, não havia commits/push e as
  três worktrees continham as alterações para revisão. `docs/reffs` e
  `.vscode` locais preservados; nenhum arquivo real privado consta nas mudanças Git.

### Git e ambiente no checkpoint anterior à publicação

| Repositório | HEAD preservado | Paths rastreados modificados | Entradas não rastreadas |
|---|---|---:|---:|
| shared-planner | d216b8a | 66 | 31 |
| shared-planner-backend | 1e27685 | 22 | 16 |
| shared-planner-frontend | 68ed59b | 30 | 9 |

Contagens correspondem a `git status --porcelain` (diretórios não rastreados aparecem
como uma entrada). `git diff --check` PASS nos três. Paridade oficial final PASS:
backend 130/130, frontend 115/115. Nenhum path de ZIP/ICS/dump/credencial/mapa/runtime
privado nas mudanças Git. Naquele checkpoint, os HEADs não tinham sido alterados
nem publicados. O relatório de publicação acima registra a etapa seguinte autorizada.

Backend de desenvolvimento 8080 e frontend 4200 mantidos ativos, health direto/proxy
200. PostgreSQL isolado da porta54629 parado após os testes; cluster/restore de teste
preservados sob target ignorado. PostgreSQL real da aplicação na porta5432 permanece
ativo. O registro bloqueado foi confirmado sem SUMMARY (comprimento0), em 08/11/2026;
seus detalhes completos estão somente no relatório privado.

## Histórico da execução

As seções abaixo preservam a baseline e os checkpoints intermediários, superados
pelos resultados finais acima.

## Baseline desta execução

Estado Git confirmado: main d216b8a / backend1e27685 / frontend68ed59b. Só
.vscode/ e docs/reffs/ não rastreados. Testes executados antes de editar código:
frontend **109/109**, 17 arquivos; backend **60/60**, 11 suítes (XML confirmado).
Os resultados da rodada anterior não são usados como execução nova.

## A verificar após implementação

Migrations isoladas, regressões backend/frontend, build, auditoria de produção,
fixtures financeiras trimestrais e paridade. Banco local, exportações reais,
credenciais e processos existentes não foram modificados.

## PostgreSQL isolado

PostgreSQL 17.11 iniciado em cluster próprio sob `backend/target`, porta 54629 e
banco `audit_migration_test` (nenhuma conexão ao banco da aplicação). Teste opt-in
`PostgresMigrationIntegrationTests` executado: **PASS**. Flyway V1–V7, carga legada
sintética, V8, V9 e V10 executadas; validação de checksums, pessoal único por owner,
membership ADMIN, três usuários legados com três pessoais novos, papéis preservados,
eventos/textos no calendário antigo e idempotência da nova execução confirmados.
Aplicação das migrations no banco local continua pendente de backup/autorização.

## Feriados

Catálogo de 10 feriados BR/2026 conferido na
[publicação oficial do MGI](https://www.gov.br/gestao/pt-br/assuntos/noticias/2025/dezembro/confira-o-calendario-oficial-de-feriados-nacionais-e-pontos-facultativos-em-2026).
Carnaval, Corpus Christi, Dia do Servidor e vésperas são pontos facultativos e não
foram incluídos. A alteração de outubro/2026 só desloca ponto facultativo, não os
feriados nacionais. `HolidayServiceTests`: **3/3 PASS** na primeira execução focada.

## Registro de diagnóstico dos testes novos

A primeira execução de `QuarterFinanceIntegrationTests` aprovou os três meses e os
limites civis. O teste negativo esperava 403 também para não membro; o contrato
existente oculta esse calendário com 404. Expectativa corrigida para exigir 404 do
não membro e 403 do membro VIEWER, sem mudar o código de autorização. Resultado da
regressão final será registrado abaixo.
