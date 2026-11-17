# Remodelagem profissional — validação

Continuação concluída em 17/11/2026. Escopo e decisões estão em
[requirements.md](requirements.md) e [design.md](design.md).

## Evidência e método

Diretório privado da execução:
`C:\shared-planner-private\qa-evidence\professional-design-system-20261117`.
Logs, relatórios JSON, hashes e capturas permanecem fora dos repositórios.

A comparação utiliza o build e as fontes preservados antes da remodelagem em
`C:\shared-planner-private\qa-evidence\professional-design-system-20261116\before`.
As 30 capturas originais foram mantidas. O mesmo conjunto de HTTP fixtures isolados
também renderizou a versão anterior em `before-complete/`, com 101 capturas e 248
verificações aprovadas. A data controlada é apenas do navegador de teste.

Nenhum teste visual autentica em conta real, importa dados no banco ou chama o
backend real. As respostas HTTP sintéticas são interceptadas no Playwright e não
entram no produto. Não foram modificados banco, backend, APIs, JWT, guards ou
interceptors. Valores, cálculos, grants e contratos são exercitados pela suíte
existente; esta entrega não representa uma nova homologação integrada do servidor.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| Monorepo: `npm.cmd test -- --watch=false` | 197 testes em 28 arquivos aprovados |
| Calendário após o último ajuste de dia inteiro | 32 testes em `calendar-page.spec.ts` aprovados |
| TypeScript: `node node_modules/typescript/bin/tsc --project tsconfig.app.json --noEmit` | Aprovado |
| Production: `npm.cmd run build -- --configuration production --stats-json` | Aprovado; métricas finais abaixo |
| Catálogo DS em development | Quatro combinações claro/escuro × 1440/390 px aprovadas, interações e reload |
| Tema sistema, alteração do SO, storage entre abas, movimento reduzido no catálogo | Aprovados |
| Contraste no catálogo | Texto mínimo observado 5,17:1; bordas 3,55:1; foco 6,70:1; tooltip 16,30:1 |
| Catálogo em production | Ausente em 73 artefatos JS/HTML; acesso direto retorna ao login |
| `tests/browser-smoke.cjs` | Oito combinações tema/resolução + dois cenários de perfis + sistema/storage/reload aprovados |
| Excel no smoke | Quatro downloads sintéticos; nome e tamanho do arquivo conferidos |
| `tests/professional-ui-check.cjs` | 764 verificações, 101 capturas, zero falhas, zero exceções de página e zero requisições externas |
| Movimento normal no celular | 159 verificações e 22 capturas adicionais aprovadas em 390 px |
| Sincronização oficial, preview e Apply | Backend: nenhuma alteração; frontend: oito inclusões e 54 atualizações, sem exclusões |
| Paridade após sincronização | Backend 149/149 e frontend 159/159 arquivos equivalentes |
| Standalone: `npm.cmd test -- --watch=false` | 197 testes em 28 arquivos aprovados após a última alteração |
| Standalone: build production | Aprovado, sem avisos de budget, métricas equivalentes ao monorepo |

Não foram alterados budgets. A compilação development mostrou a recomendação
Angular NG02801 sobre `HttpClient`/fetch no SSR. Ela já pertence à infraestrutura de
HTTP existente; o build terminou com sucesso e sua configuração foi preservada.

Build production do monorepo: bundle inicial de 425,94 kB, transferência estimada
de 106,03 kB, CSS de 97,00 kB e uma rota pré-renderizada. Nenhum aviso de budget.
O estado `/design-system` permanece restrito ao build development.

Uma execução do standalone simultânea a compilações excedeu o limite de 5000 ms em
dois testes do catálogo. O log foi preservado em
`standalone-tests-concurrent-timeout.log`; a repetição isolada passou os 197 testes,
sem aumentar timeouts ou modificar os testes para contornar a falha.

## Cobertura de interação e correções encontradas

- Login e validação; calendário e criação em um clique, uma descrição, máscara de
  telefone; financeiro, membros, usuários, perfis, auditoria, pendências, importação
  e configurações em claro/escuro. 1440 e 390 px cobrem todas essas áreas; 1024 px
  cobre login, calendário, modal, financeiro, usuários e configurações.
- Gaveta móvel com conteúdo inert, retenção de Tab, Escape e retorno de foco;
  perfil com Home/End/Escape; tema por teclado e persistência após reload.
- Usuários em carregamento, vazio, erro e nova tentativa; pendências vazias;
  prévia ICS distingue pronto/duplicado/bloqueado e mantém confirmação explícita.
- Tokens medidos no navegador: raiz 16 px, texto 14 px, passo 4 px e controle 40 px.
  Inter carregada localmente e glifos efetivamente renderizados conferidos pelo CDP.
- A revisão corrigiu a escala rem aplicada indevidamente à raiz, duplicação de
  estilos de textarea, a especificidade do painel no tablet, semântica do popover
  de checkboxes e obrigatoriedade/erros no modal de eventos. O último ajuste remove
  transições implícitas de visibilidade com movimento reduzido para permitir foco
  imediato na gaveta.
- A inspeção final também uniformizou eventos de dia inteiro no painel e no detalhe:
  exibem “Dia inteiro”, em vez de um intervalo enganoso `00:00–00:00`, preservando as
  datas e os intervalos armazenados. O teste existente cobre eventos com e sem horário.

## Comparação visual e rastreabilidade

`before-complete/` e `after/` usam os mesmos fixtures e resoluções, permitindo comparar
proporções e conteúdo sem expor dados reais. A revisão visual confirmou tipografia
Inter, navegação mais estreita, maior área da grade, formulário rolável e hierarquia
consistente entre painéis e tabelas. As referências de `docs/reffs` orientaram navy,
azul, superfícies, categorias e composição; controles sem suporte real não foram copiados.

Exemplos de pares dentro do diretório privado de evidências:

| Área | Capturas com o mesmo nome em `before-complete/` e `after/` |
|---|---|
| Calendário desktop | `light-1440-calendar.png`, `dark-1440-calendar.png` |
| Calendário tablet/celular | `light-1024-calendar.png`, `light-390-calendar.png` |
| Financeiro e gráficos | `light-1440-finance.png`, `dark-1440-finance-charts.png` |
| Modal móvel | `light-390-event-modal.png` |
| Administração | `dark-1440-admin-users.png`, `light-390-admin-roles.png` |
| Login e aparência | `light-1440-login.png`, `dark-390-settings.png` |

| Aceite | Evidência |
|---|---|
| PRO-01/02 | Tokens/fonte local, controles unificados, tabs/tabela; três testes específicos e catálogo interativo |
| PRO-03 | Gaveta, menu, foco/teclado e perfis no browser e testes de AppShell |
| PRO-04 | Grade, filtros, modal, contexto/escape HTML e dia inteiro; testes de calendário e capturas |
| PRO-05 | Suíte financeira, gráficos, filtros e quatro downloads XLSX no smoke |
| PRO-06/07 | Testes existentes de usuários/membros/perfis/auditoria/pendências/login e estados no browser |
| PRO-08 | Três resoluções no QA amplo, quatro no smoke; claro/escuro/sistema, contraste, movimento e teclado |
| PRO-09 | Logs de testes, TypeScript, builds e relatórios/capturas privados |
| PRO-10 | Quatro documentos, sincronização/paridade, Git sem commits/pushes |

## Limites e continuidade

- A listagem de eventos não fornece `seriesId`. A grade não inventa um indicador
  de recorrência; consulta/edição de série e escopos existentes foram preservados.
- A revisão de contraste é automatizada por amostragem e complementada pela
  inspeção das capturas. Não é certificação WCAG nem teste manual com leitor de tela.
- Tabelas/gráfico mantêm rolagem local quando precisam de largura mínima legível.
- Nenhuma dependência npm foi adicionada; Angular/FullCalendar/gráficos SVG e a
  Foundation existentes foram reutilizados. Único novo ativo externo: Inter v4.1
  auto-hospedada com OFL, sem CDN em runtime.
- Não houve commit, staging ou push. Alterações anteriores da Foundation, arquivos
  de IDE e referências locais foram preservados.

## Inventário deste incremento

Comparado ao snapshot anterior à remodelagem: oito arquivos novos, 54 alterados e
nenhum removido no frontend; quatro documentos nesta pasta. As mudanças anteriores
da Foundation já existentes no working tree não são contadas como novidade desta
etapa. `angular.json`, rotas, foco de diálogo e arquivos originais da Foundation
continuam presentes; suas diferenças contra HEAD podem pertencer à etapa anterior.

### Novos arquivos

- `frontend/src/app/shared/ui/design-system/navigation.spec.ts`
- `frontend/src/app/shared/ui/design-system/table.directive.ts`
- `frontend/src/app/shared/ui/design-system/tabs.component.ts`
- `frontend/src/app/shared/ui/design-system/_control-foundations.scss`
- `frontend/src/assets/fonts/InterVariable.woff2`
- `frontend/src/assets/fonts/OFL.txt`
- `frontend/src/styles/_typography.scss`
- `frontend/tests/professional-ui-check.cjs`

### Arquivos existentes alterados

- `frontend/src/app/core/layout/app-shell/app-shell.html`
- `frontend/src/app/core/layout/app-shell/app-shell.spec.ts`
- `frontend/src/app/core/layout/app-shell/app-shell.ts`
- `frontend/src/app/features/access/access-page.html`
- `frontend/src/app/features/access/access-page.scss`
- `frontend/src/app/features/access/access-page.ts`
- `frontend/src/app/features/audit/audit-page/audit-page.html`
- `frontend/src/app/features/audit/audit-page/audit-page.ts`
- `frontend/src/app/features/auth/login-page/login-page.html`
- `frontend/src/app/features/auth/login-page/login-page.spec.ts`
- `frontend/src/app/features/auth/login-page/login-page.ts`
- `frontend/src/app/features/calendar/appointment-confirmation/appointment-confirmation.html`
- `frontend/src/app/features/calendar/appointment-confirmation/appointment-confirmation.ts`
- `frontend/src/app/features/calendar/calendar-creator/calendar-creator.ts`
- `frontend/src/app/features/calendar/calendar-import-page/calendar-import-page.html`
- `frontend/src/app/features/calendar/calendar-import-page/calendar-import-page.ts`
- `frontend/src/app/features/calendar/calendar-page/calendar-page.html`
- `frontend/src/app/features/calendar/calendar-page/calendar-page.spec.ts`
- `frontend/src/app/features/calendar/calendar-page/calendar-page.ts`
- `frontend/src/app/features/calendar/recurrence-editor/recurrence-editor.ts`
- `frontend/src/app/features/design-system/design-system-page.html`
- `frontend/src/app/features/design-system/design-system-page.ts`
- `frontend/src/app/features/finance/finance-page/finance-page.html`
- `frontend/src/app/features/finance/finance-page/finance-page.scss`
- `frontend/src/app/features/finance/finance-page/finance-page.spec.ts`
- `frontend/src/app/features/finance/finance-page/finance-page.ts`
- `frontend/src/app/features/members/members-page/members-page.html`
- `frontend/src/app/features/members/members-page/members-page.scss`
- `frontend/src/app/features/members/members-page/members-page.ts`
- `frontend/src/app/features/pending/pending-page/pending-page.html`
- `frontend/src/app/features/pending/pending-page/pending-page.ts`
- `frontend/src/app/features/settings/settings-page/settings-page.html`
- `frontend/src/app/features/settings/settings-page/settings-page.scss`
- `frontend/src/app/features/settings/settings-page/settings-page.spec.ts`
- `frontend/src/app/features/settings/settings-page/settings-page.ts`
- `frontend/src/app/features/users/users-page/users-page.html`
- `frontend/src/app/features/users/users-page/users-page.scss`
- `frontend/src/app/features/users/users-page/users-page.spec.ts`
- `frontend/src/app/features/users/users-page/users-page.ts`
- `frontend/src/app/shared/ui/design-system/controls.scss`
- `frontend/src/app/shared/ui/design-system/index.ts`
- `frontend/src/index.html`
- `frontend/src/styles/_base.scss`
- `frontend/src/styles/_calendar.scss`
- `frontend/src/styles/_charts.scss`
- `frontend/src/styles/_finance.scss`
- `frontend/src/styles/_fullcalendar.scss`
- `frontend/src/styles/_login.scss`
- `frontend/src/styles/_modal.scss`
- `frontend/src/styles/_pages.scss`
- `frontend/src/styles/_shell.scss`
- `frontend/src/styles/_tokens.scss`
- `frontend/src/styles.scss`
- `frontend/tests/browser-smoke.cjs`
