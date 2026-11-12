# Revalidação e preparação da publicação — 12/11/2026

O dono autorizou novos testes dos cenários reportados e, caso aprovados, commits
separados por rotina e pushes nos três repositórios. Este registro atualiza o
checkpoint anterior, que ainda não tinha commits nem autorização para publicação.

## Checks executados novamente

| Verificação | Resultado |
|---|---|
| Backend monorepo | 120 testes em 18 suítes; zero falhas, erros ou ignorados |
| Backend standalone | 120 testes em 18 suítes; zero falhas, erros ou ignorados |
| Migrations PostgreSQL | PASS em banco isolado nos dois backends, incluindo V9/V10 e preservação do legado |
| Frontend monorepo | 130 testes em 21 arquivos; PASS |
| Frontend standalone | 130 testes em 21 arquivos; PASS |
| Builds frontend | PASS nos dois contextos; zero warnings, uma rota pré-renderizada |
| Navegador sintético | Oito combinações de tema/resolução, sistema, storage e reload; PASS |
| Navegador real | Login, cinco calendários e feriados, mês/semana/dia e gráficos financeiros; PASS |
| Dependências de produção | `npm.cmd audit --omit=dev`: zero vulnerabilidades |
| Paridade oficial | Backend 130/130 e frontend 115/115; PASS |

A revisão de privacidade substituiu um e-mail pessoal antigo da fixture de membros
por um endereço sintético `.invalid`, nas duas cópias. Após essa mudança somente de
fixture, os nove testes de MembersPage passaram novamente. Não houve mudança de
código de produção depois das regressões completas.

## Cenários do dono e evidências

| Cenário | Evidência principal |
|---|---|
| Pessoal automático, único e com ADMIN próprio | CalendarEvolutionIntegrationTests e PostgresMigrationIntegrationTests |
| FINANCE global exige vínculo, sem administração global implícita | QuarterFinanceIntegrationTests e testes de autorização/guards |
| Papéis combinados e gestão de membros do calendário | CalendarEvolutionIntegrationTests, MembersPage e calendar-permissions |
| Compartilhamento e aprovação dos demais participantes | CalendarEvolutionIntegrationTests, pendências e CalendarPage |
| Calendários separados e filtros | CalendarPage, browser smoke e navegador real |
| Descrição única e telefone brasileiro | CalendarEvolutionIntegrationTests, CalendarPage e browser smoke |
| Importação sem duplicação, recorrências e privacidade | CalendarImportAndRecurrenceIntegrationTests e IcalendarParserTests |
| Financeiro de outubro, novembro e dezembro | QuarterFinanceIntegrationTests e FinancePage, com dados sintéticos isolados |
| Feriados separados, sem receita | HolidayServiceTests e navegador |

Os testes desta rodada não repetiram a importação real nem alteraram os eventos do
banco de desenvolvimento. As evidências da carga autorizada anterior permanecem em
[data-import-report.md](data-import-report.md). O navegador real fez login e consultas;
as mutações funcionais foram verificadas com dados de teste isolados.

## Separação dos commits

| Rotina | Monorepo | Standalone |
|---|---|---|
| Calendários e permissões backend | `1ed0498` | backend `88d436f` |
| Recorrência e importação backend | `a1025aa` | backend `bd9f34d` |
| Feriados backend | `07c8f16` | backend `8762a49` |
| Financeiro e migrations: testes | `da9c289` | backend `67c68e9` |
| Documentação backend | `6269655` | backend `060bcd9` |
| Calendário colaborativo frontend | `531b86b` | frontend `b8c8063` |
| Membros e papéis frontend | `cc128d5` | frontend `75c8256` |
| Consolidação e gráficos financeiros | `9904660` | frontend `8e45baf` |
| Validação de usuários | `a082d36` | frontend `b6af899` |
| Proxy local IPv4 | `19450b3` | frontend `3fe67f3` |
| Checks de navegador | `8aecb83` | frontend `85d532d` |
| Documentação frontend | `35e9241` | frontend `ba4d9b4` |
| Ferramentas privadas de desenvolvimento | `cbd3320` | somente monorepo |
| SDD e este relatório | commit documental final | somente monorepo |

V9 e V10 acompanham a evolução central do backend porque a entidade Event já depende
das colunas de V10. No frontend, contratos, serviços e componentes centrais acoplados
ficam no mesmo commit para manter coerência de compilação.

Conta autenticada conferida: `JotaP3c`. Autor e committer dos commits: João Pedro
Corrêa, `Jpcbnu@gmail.com`, definidos por variáveis de ambiente sem alterar Git config.
As branches locais são `main`; a confirmação dos pushes e dos hashes remotos será
informada na entrega final. Não se considera apenas um dry run como publicação.

ZIP/ICS reais, backup, credenciais, mapa da importação, runtime e capturas privadas
ficam fora dos commits. `.vscode/` e `docs/reffs/` locais permanecem não rastreados.
QA manual do dono, o evento sem título e as decisões de produto explicitamente abertas
continuam com os limites registrados no relatório de validação.
