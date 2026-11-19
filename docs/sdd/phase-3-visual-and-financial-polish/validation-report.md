# Validação do refinamento visual e financeiro

## Financeiro e XLSX

O build Java executou 181 testes sem falhas ou omissões. A suíte incluiu
autorização, limites do XLSX, migrações, histórico de preços e jornada HTTP
contra PostgreSQL 17 isolado. A validação usou dados sintéticos.

| Valor no mesmo calendário e período | API | XLSX |
| --- | ---: | ---: |
| Receita prevista | R$ 296,95 | R$ 296,95 |
| Receita recebida | R$ 40,00 | R$ 40,00 |
| Receita pendente | R$ 256,95 | R$ 256,95 |
| Atendimentos | 2 | 2 |

A jornada criou itens, registrou o atendimento, alterou a promoção, confirmou
o agendamento, registrou o pagamento parcial e exportou o relatório. A aba
`Item Details` preservou 2 × R$ 79,95 e 3 × R$ 12,35, somando R$ 196,95. O
atendimento legado de R$ 100,00 entrou uma vez na receita. O usuário sem acesso
recebeu a negação esperada. As exportações com dados legados conservaram quatro
abas. O dashboard conservou três gráficos nativos.

O Chrome integrado passou em 44 verificações com o build Angular de
produção, a API Java e o PostgreSQL isolado. A jornada confirmou um
atendimento, registrou pagamento parcial via Pix e baixou o Excel para a
mesma data e calendário do Financeiro. A API e o XLSX retornaram R$ 132,50
previstos, R$ 40,00 recebidos e R$ 92,50 pendentes. A inspeção do arquivo
confirmou cinco abas, três gráficos nativos e duas linhas de itens com o
ID do atendimento, 2 × R$ 60,00 e 1 × R$ 12,50. Também passaram os temas
Claro, Escuro e Sistema e a largura de 412 px. Os processos isolados foram
encerrados ao final.

## Angular e comparação visual

Os 209 testes Angular em 29 arquivos passaram. O build de produção gerou os
bundles de navegador e servidor. A comparação usa a versão anterior do
monorepo e o build refinado com as mesmas respostas HTTP sintéticas e data
de 17/11/2026. A base tem 107 capturas e 260 verificações aprovadas.

O Playwright no Chrome aprovou 1.622 verificações no build refinado e gerou
195 capturas. A matriz cobriu 320 × 640, 390 × 844, 768 × 1024,
900 × 480 e 1440 × 960 nos temas Claro e Escuro. O modo Sistema acompanhou
alterações do esquema do navegador. A rotação de 390 × 844 para 844 × 390
ocorreu com o formulário aberto. O teste confirmou o acesso à ação de salvar
e o total de R$ 112,50 para dois procedimentos e um produto sintéticos.

A primeira rodada visual revelou que a quantidade atualizava o preço e a
duração ao sair do campo. A versão final recalcula ao digitar uma quantidade
válida e mantém o último valor válido ao fechar uma edição incompleta.

| Área | Mudança conferida na comparação |
| --- | --- |
| Calendário | Grade mais compacta no celular, com filtros sob demanda e agenda por data. O painel lateral acompanha a grade em desktop e passa para baixo quando o espaço diminui. |
| Criação e detalhes | Os campos mantêm leitura e foco com rolagem interna. O resumo permite conferir os itens, horário e valor antes de salvar. A paisagem curta preserva as ações do modal. |
| Financeiro | O gráfico de receita passou da rolagem lateral para um eixo proporcional à largura do painel. As roscas mantêm legenda e valores separados. |
| Catálogo | O seletor de calendário permanece visível com os filtros recolhidos. A versão estreita mostra preço e ações no mesmo item. |
| Login e configurações | O formulário de login ganha um painel definido. A tela de configurações agrupa conta e tema na mesma hierarquia da referência escura. |
| Pendências e administração | Ações com mais área de toque, estados por texto e cor e quebra de nomes e permissões longos. Tabelas largas de administração e finanças usam rolagem dentro do painel. |

As capturas e os logs foram salvos em
`C:\shared-planner-private\qa-evidence\phase-3-polish-20261119`. O
[design](design.md) registra a correspondência de cada tela com as referências.
`before/report.json` e `after-final/report.json` listam as capturas e
verificações. `catalog-browser-report.json` registra a jornada integrada
e `live-browser-xlsx-validation.json` registra a inspeção do download.

Os resultados abrangem o Chrome. A renderização dos gráficos nativos no
Excel desktop e a experiência com teclado físico e virtual em aparelhos
reais permanecem fora da matriz executada.

## Paridade dos módulos

Foram sincronizados cinco arquivos de backend e 23 de frontend. A comparação
SHA-256 confirmou 175 arquivos rastreados do backend e 170 do frontend
idênticos às cópias no monorepo.

<details>
<summary>Arquivos de implementação e teste</summary>

- `backend/src/main/java/com/sharedplanner/finance/FinanceExportEventRepository.java`
- `backend/src/main/java/com/sharedplanner/finance/FinanceExportService.java`
- `backend/src/main/java/com/sharedplanner/finance/FinanceWorkbook.java`
- `backend/src/test/java/com/sharedplanner/finance/FinanceExportLimitsTests.java`
- `backend/src/test/java/com/sharedplanner/stabilization/Phase3PostgresIntegrationTests.java`
- `frontend/src/app/features/access/access-page.html`
- `frontend/src/app/features/access/access-page.scss`
- `frontend/src/app/features/calendar/calendar-page/calendar-page.html`
- `frontend/src/app/features/calendar/calendar-page/calendar-page.spec.ts`
- `frontend/src/app/features/calendar/calendar-page/calendar-page.ts`
- `frontend/src/app/features/catalog/catalog-page.html`
- `frontend/src/app/features/catalog/catalog-page.scss`
- `frontend/src/app/features/catalog/catalog-page.ts`
- `frontend/src/app/features/members/members-page/members-page.html`
- `frontend/src/app/features/members/members-page/members-page.scss`
- `frontend/src/app/features/pending/pending-page/pending-page.html`
- `frontend/src/app/features/pending/pending-page/pending-page.scss`
- `frontend/src/app/features/pending/pending-page/pending-page.ts`
- `frontend/src/app/features/settings/settings-page/settings-page.html`
- `frontend/src/app/features/settings/settings-page/settings-page.scss`
- `frontend/src/app/features/users/users-page/users-page.scss`
- `frontend/src/app/shared/ui/charts/line-chart.ts`
- `frontend/src/styles/_calendar.scss`
- `frontend/src/styles/_finance.scss`
- `frontend/src/styles/_fullcalendar.scss`
- `frontend/src/styles/_login.scss`
- `frontend/src/styles/_modal.scss`
- `frontend/tests/professional-ui-check.cjs`

</details>
