# Design técnico — remodelagem do frontend e consolidação

Angular 21.2 standalone, signals, Reactive Forms, HttpClient e FullCalendar 6.1.
Spring Boot 4/Java 17 permanece como autoridade de autorização e cálculo.
SSR pré-renderiza somente `/login`; rotas autenticadas são renderizadas no cliente
(`app.routes.server.ts`). [VERIFICADO]

## Arquitetura frontend encontrada

- `core/api/*`: serviços HTTP finos por recurso (`/api/...` same-origin).
- `core/auth`: `AuthService` (JWT em `localStorage`), interceptor (Bearer só em `/api`,
  401 encerra sessão), `finance-access.ts` (capacidade financeira espelhando BR-FIN-003).
- `core/guards`: `authGuard`, `systemAdminGuard`, `auditAccessGuard`.
- `core/theme/theme.service.ts`: fonte única do tema.
- `core/state/data-change.service.ts` (**novo**): sinal de versão incrementado após mutações.
- `core/layout/app-shell`: sidebar, topbar, busca global, sino, menu do perfil.
- `features/*`: páginas lazy. `shared/ui/icon` (SVG inline), `shared/a11y` (**novo**).
- Estilos: `src/styles/_tokens|_base|_shell|_calendar|_fullcalendar|_modal|_login|_pages.scss`
  importados globalmente com escopo por classe de tela; SCSS de componente quase vazio por
  causa do budget de 8 kB por componente.

## Direção visual

As 12 imagens de `docs/reffs` seguem duas famílias (clara e navy escura). Adota-se a família
navy coerente com o conjunto: fundo `#080F20`, sidebar `#0B1530`, superfícies
`#111C35`/`#172440`, texto `#F8FAFC`/`#A8B8D5`, marca `#2563EB`/`#3B82F6`, índigo `#4F46E5`.
Claro: `#F8FAFC`, `#FFFFFF`, `#F1F5F9`, `#0F172A`, `#64748B`. Eventos: CLIENT verde,
PERSONAL azul, SHARED roxo, pendente âmbar, rejeitado vermelho, cancelado neutro
(`--sp-cancelled*`). Elementos das imagens sem suporte (Google, cadastro, recuperação de
senha, "lembrar", despesas, comissões, exportação, gráficos/percentuais fictícios,
menus Dashboard/Clientes/Permissões) **não** foram implementados.

## Componentes e camadas reutilizáveis

| Peça | Onde | Uso |
|---|---|---|
| Botões `primary/secondary/ghost/danger/icon/link` | `_base.scss` | todas as telas |
| Campo `.sp-field` | `_base.scss` | formulários |
| Pílulas `.sp-pill.type-*`/`status-*` | `_base.scss` | tipo/status |
| `.page`, `.page-header`, `.page-panel`, `.page-feedback`, `.page-empty`, `.page-form`, `.page-table(.is-stackable)` | `_pages.scss` (**novo**) | Pendências, Membros, Usuários, Financeiro, Configurações |
| `spDialogFocus` | `shared/a11y/dialog-focus.directive.ts` (**novo**) | modal de evento e painel de detalhes |
| `sp-icon` | `shared/ui/icon` | ícones sem dependência |

Não foi criada biblioteca de componentes nem dependência nova.

## Tema (causa e correção)

Causas encontradas [VERIFICADO]:
1. A ilustração do login era um PNG 575×545 totalmente opaco (alfa 255) com fundo claro e a
   palavra "Despesas"; no tema escuro aparecia como bloco claro (conflito visual público ×
   autenticado) e anunciava funcionalidade inexistente.
2. O login não oferecia seleção de tema; a preferência só podia ser trocada no shell.
3. O script pré-pintura de `index.html` tratava valor armazenado inválido como claro,
   enquanto o serviço o tratava como "sistema" — fontes de verdade divergentes.
4. O serviço não reagia à alteração em outra aba e não removia listeners.

Correção: `resolveTheme()`/`parseThemePreference()` exportados do `ThemeService` são o
resolvedor único; o script pré-pintura replica exatamente a mesma regra (inválido = sistema)
e também define `color-scheme`. O serviço escuta `prefers-color-scheme` e `storage`, remove
os listeners no `DestroyRef`, mantém a preferência em memória se o storage falhar e é
instanciado na raiz (`App`), valendo para login, shell e Configurações. Login ganhou seletor
claro/escuro/sistema e ilustração SVG cujas cores vêm dos tokens. A chave
`sharedPlanner.theme` é independente do token, por isso logout/login preservam o tema.

## Consistência de dados

`DataChangeService.notify()` é chamado após criar/editar/cancelar evento, atualizar pagamento
e aprovar/reprovar (calendário e Pendências). O card financeiro inclui a versão na chave de
cache; o shell reconsulta o contador do sino. Sem polling de rede.
Pendências: `Map<eventId, loadRequestId>` registra a última consulta iniciada antes da
decisão; respostas dessa consulta (ou anteriores) não ressuscitam o item; consultas
iniciadas depois são autoritativas e exibem uma reabertura legítima. Q-004 não muda.
Próximos eventos: relógio local de 60 s; o escopo continua sendo o período carregado com os
filtros ativos (janela independente exigiria aceite explícito).
Duração: opções que ultrapassam 23:59 não são exibidas e não são aplicadas; uma mensagem
orienta o ajuste manual. Eventos multidia continuam em BLG-UX-004.

## Responsividade e acessibilidade

Tabelas `.is-stackable` viram cartões abaixo de 720 px (rótulo via `data-label`); grids com
`auto-fit`. Modais: foco inicial no primeiro campo, Tab/Shift+Tab contidos, retorno ao
elemento de origem, Escape já tratado. Card de pendência deixou de ser `role=button` com
botões internos (o título virou o botão). Mensagens com `role=alert`/`role=status`.
`prefers-reduced-motion` neutraliza transições/animações globalmente.

## Estratégia de testes

Vitest via `ng test --no-watch` (unit/componente com HttpTestingController) e JUnit/Spring
Boot com H2 MODE=PostgreSQL no backend. Não há lint, E2E nem testes visuais configurados.

## Riscos técnicos

- H2 não exercita migrations V1–V7 nem constraints reais do PostgreSQL.
- Sem E2E/inspeção visual automatizada, fidelidade visual e contraste dependem de revisão manual.
- `localStorage` para JWT permanece (BLG-SEC-007, decisão pendente).
- Script inline de tema precisa de hash/nonce quando uma CSP for adotada (BLG-SEC-008).
