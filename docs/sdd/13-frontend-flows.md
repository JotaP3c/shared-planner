# 13 — Fluxos frontend

| Fluxo | Estado | Comportamento/evidência |
|---|---|---|
| Login | CURRENT | formulário → AuthService → token localStorage → calendário |
| Selecionar agenda | CURRENT | seleção múltipla e cores em `CalendarPage` |
| Visualizar calendário | CURRENT | mês/semana/dia, range e FullCalendar |
| Criar CLIENT/PERSONAL/SHARED | CURRENT | modal dinâmico e validação local/API |
| Visualizar/editar/cancelar | CURRENT | painel de detalhe; botões calculados no cliente |
| Aprovar/reprovar | CURRENT | painel/calendário e página `/pending` |
| Consultar financeiro | TARGET | rota/service existem; página placeholder |
| Atualizar pagamento | CURRENT | detalhe CLIENT no calendário |
| Administrar membros | CURRENT | seleção, listagem, inclusão, papel e remoção; owner protegido na UI |
| Administrar usuários | TARGET | rota placeholder; link só ADMIN; service sem listagem |
| Consultar auditoria | TARGET | rota placeholder; service disponível |
| Configurações | TARGET/OPEN | placeholder, sem requisitos definidos |

Fluxos protegidos usam apenas `authGuard`; autorização fina permanece no backend. Interceptor inclui Bearer e logout remove token. Busca global (>=2 caracteres, debounce) navega ao evento no calendário. SSR exige proteções ao acessar localStorage, aplicadas na página de calendário.

TARGET: UI deve ocultar/desabilitar ações pela matriz, mas resposta 403 do backend permanece autoridade. Critérios correspondentes estão em [15](15-acceptance-criteria.md). Evidência: `app.routes.ts`, `core/auth`, `core/api`, `features/**`.
