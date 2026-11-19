# Validação do catálogo comercial

Validação em 18/11/2026 nas cópias locais de `C:\git`. A API foi exercitada com
dados sintéticos. O PostgreSQL isolado escutou em `127.0.0.1:54629`. Os testes de
upgrade geraram dumps verificáveis por SHA-256 e `pg_restore --list`, e a suíte
comprovou também a restauração de um backup em banco de teste.

| Requisito | Evidência |
|---|---|
| CAT-01. Serviços e produtos por calendário | `CatalogIntegrationTests` verifica criação, pesquisa, filtros, alteração, status e isolamento. `catalog-page.spec.ts` verifica os formulários e os parâmetros de consulta. |
| CAT-02. Promoção e histórico | Testes consultam o preço antes, nas datas de início e fim e após o período. O histórico preserva preço e vigência anteriores. |
| CAT-03. Agendamento CLIENT | Testes do calendário exercitam pesquisa contextual, seleção pelo teclado, remoção, quantidades, observações, duração sugerida e atualização do total. |
| CAT-04. Condições contratadas | Testes de eventos e o cenário PostgreSQL validam edição sem reprecificação, revisão explícita, reordenação, remoção e proteção após pagamento parcial. A requisição recusa preço desatualizado e detecta nova duração em item cotado sem duração. |
| CAT-05. Permissões | Catálogos e cotações são isolados por calendário. Os testes exercitam usuário sem grant financeiro, usuário de calendário diferente e editor sem acesso ao catálogo. Este último pode editar conteúdo, com os itens e o valor contratados preservados. |
| CAT-06. Legado e recorrência | Os testes aplicam V14 sobre schema com registros legados. Série CLIENT nova e conversão de ocorrência recorrente são recusadas. A suíte de importação e recorrência cobre as séries históricas. |
| CAT-07. Receita e Excel | Na jornada HTTP com PostgreSQL, um atendimento legado de R$ 100,00 e um atendimento com catálogo de R$ 196,95 geram duas linhas no Excel e R$ 296,95 previstos. A cotação atualizada do catálogo não altera a receita contratada. |
| CAT-08. Concorrência | Um teste consulta `pg_stat_activity` para confirmar a espera pelo lock real, conclui a alteração de preço e verifica 409 na gravação com a cotação anterior. |

## Suítes e builds

- `mvnw.cmd package` com Java 17 e as suítes opt-in de PostgreSQL executou 180
  testes sem falhas ou omissões e gerou o JAR.
- `npm.cmd run build` gerou os bundles de produção do Angular e servidor.
- `npm.cmd test -- --watch=false` executou 207 testes em 29 arquivos com sucesso.
  Em duas rodadas simultâneas ao Maven, o teste do showcase atingiu o timeout
  de 5 segundos. O teste passou isoladamente e na suíte completa seguinte,
  com o mesmo limite e sem alteração do teste.
- A suíte de navegador com respostas HTTP sintéticas passou por oito combinações
  de tema e resolução, dois cenários de perfis configuráveis, tema de sistema e
  quatro downloads XLSX.
- O Chrome passou em 37 verificações com o build Angular, a API e o PostgreSQL
  reais, restritos ao ambiente isolado. Foram exercitados inclusão e edição de
  serviço e produto, ativação e filtros, histórico de preço, seleção por teclado
  e mouse, remoção, quantidades e persistência do atendimento. A edição de
  observações após mudança no catálogo preservou os itens e os R$ 132,50
  contratados. Light, Dark e System foram verificados em desktop e a 412 px,
  sem falhas de API ou console.

As evidências ficam em
`C:\shared-planner-private\qa-evidence\service-product-catalog-20261118`.
O JSON `catalog-browser-report.json` enumera as verificações e as capturas.

## Paridade dos repositórios

Foram copiadas 34 fontes e testes para `C:\git\shared-planner-backend` e 19
para `C:\git\shared-planner-frontend`. A verificação SHA-256 encontrou
175/175 arquivos equivalentes no backend e 166/166 no frontend. A comparação
ignorou metadados Git, builds, caches e arquivos locais de ambiente, conforme as
exclusões do projeto. `git diff --check` passou nas três cópias.

## Escopo operacional

A V14 foi aplicada somente no PostgreSQL isolado. As cópias de desenvolvimento
com dados reais e a produção ficaram fora da execução. Estoque, inventário e
vinculação retrospectiva de itens a eventos antigos ficaram fora do escopo.
