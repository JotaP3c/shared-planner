# Remodelagem e consolidação — requisitos

Data: 11/11/2026. Fontes: dois anexos do proprietário (consolidação SDD e redesign do
frontend) e o onboarding técnico. O proprietário autorizou implementar os ajustes e exigiu
que **todas** as alterações existam no monorepo (`backend/`, `frontend/`, `docs/`) e nos dois
repositórios standalone. Sem commits, push ou alteração do banco local. As referências em
`docs/reffs` são preservadas e não versionadas por esta execução.

## Requisitos funcionais

- R-01: interface PT-BR, responsiva e coerente com as 12 referências; controles só para
  funcionalidades reais.
- R-02: login com ilustração própria e seletor de tema; sem Google, cadastro, recuperação de
  senha ou "lembrar". Preferência claro/escuro/sistema persistida, aplicada antes da pintura
  e preservada após refresh, logout, login, navegação, reabertura e entre abas.
- R-03: preservar visões mensal/semanal/diária, navegação, Hoje, filtros por calendário/tipo,
  busca, CRUD, detalhe, pagamento e aprovação. Invalidar resumo financeiro e contador após
  mutações; próximos eventos acompanham o tempo; atalho de duração sem truncamento silencioso.
- R-04: pendência reaberta reaparece em consulta nova; resposta antiga não desfaz decisão
  recente. Somente o aprovador solicitado vê/aciona Aprovar/Reprovar.
- R-05: Usuários — listagem, busca local, criação (nome, e-mail, senha, papel), edição (nome,
  papel, ativo), 409 de e-mail duplicado, 403, loading/vazio/erro/sucesso/retry e
  autoproteção do ADMIN autenticado. Sem alteração de e-mail/senha (contrato atual).
- R-06: Financeiro conserva as oito métricas, períodos civis, intervalo customizado e
  autorização; gráfico apenas com contagens reais; período vazio mostra zeros sem gráfico.
  PERSONAL/SHARED não geram receita.
- R-07: Membros, Pendências, Financeiro, Usuários e Configurações usam tokens; modais com
  foco inicial, contenção e retorno.
- R-08: Configurações com aparência (3 modos) e identidade somente leitura; sem edição de perfil.
- R-09: dependências corrigidas por atualização compatível deliberada (sem `audit fix`, sem
  major), aplicabilidade documentada.
- R-10: alterações equivalentes nos três repositórios, validadas pelo verificador oficial.

## Requisitos não funcionais

- Sem nova biblioteca de UI/gráficos; budgets do Angular sem novos avisos.
- Segurança: backend continua autoridade; nenhum segredo/token em logs, relatórios ou UI.
- Compatibilidade: Angular 21.2.x, Node 22, navegadores evergreen; SSR seguro (sem globals no servidor).
- Acessibilidade: labels associados, `aria-*` em controles icônicos, anúncios de estado,
  foco visível, movimento reduzido. Validação WCAG completa exige teste manual com
  tecnologia assistiva.

## Funcionalidades preservadas

Autenticação JWT, guards, redação financeira, latest-wins, erros totais/parciais, retry,
bloqueio por item, validação do aprovador SHARED herdado, cancelamento persistente.

## Limites e decisões

Q-001..Q-006, BR-PAY-003 histórico, sessão JWT (BLG-SEC-007), Settings além de aparência
(BLG-BR-007) e eventos multidia (BLG-UX-004) não são redefinidos por imagens. Mudanças de
backend/infra além de testes aguardam autorização específica (o anexo 2 proíbe alterar o
backend na remodelagem). Auditoria completa depende de Q-006. Não executar
migrations/seeds/scripts administrativos contra o banco existente.

## Critérios de aceitação

- `ng test --no-watch` e `ng build` passam; `mvnw test` passa.
- Login funciona e respeita claro, escuro e sistema; tema sobrevive a refresh/logout.
- Nenhuma ação decorativa, receita inventada ou gráfico sem dado.
- Paridade monorepo ↔ standalones PASS no verificador oficial.
- Resultados históricos não contam como validação nova; limitações ficam explícitas.
