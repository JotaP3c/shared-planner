# 21 — Development Progress

## Completed

- Baseline integrada atual: backend 16/16, frontend 31/31 em 12 arquivos e build SSR com 9 rotas.
- Cancelamento persistente `CANCELLED` alinhado a BR-EVT-005/AC-EVT-001.
- Gestão de membros frontend e contratos correspondentes.
- PostgreSQL 17.11 como runtime, Flyway V1–V7 e migração 6/4/10/11/11 validada.
- Docker engine operacional; NX Mode e SVM Mode habilitados.
- Três diretórios de repositório criados.
- Login API confirmado para os seis usuários de desenvolvimento ativos.
- Paridade oficial histórica confirmada em 80/80 e 74/74; após o incremento atual, revalidada em backend 84/84 e frontend 76/76.
- Contextos Docker absolutos confirmados em `C:\git\shared-planner-backend` e `C:\git\shared-planner-frontend`.
- Builds/testes standalone, stack integrada, regressão API, Edge headless, persistência e DBeaver concluídos com PASS.
- SEC-FIND-001/002 encerrados e revalidados nos três repositórios: redação financeira por capacidade, sem consulta N+1 por evento, e revogação imediata de alvo SHARED removido.
- Owner preservado como ADMIN em DELETE/PUT/POST; precisão e integridade de pagamento endurecidas.
- JWT sem fallback dev versionado, configuração validada, issuer e usuário ativo verificados.
- Portas Compose em loopback por padrão; interceptor Bearer restrito a `/api` same-origin e sessão diferenciada em 401/403/500.
- Finance implementado com cinco opções de período e oito métricas (três valores e cinco contagens), estados completos, refresh, responsividade, acessibilidade e navegação honesta por capacidade.

## Incremento 2026-11-10 — estados assíncronos, guards e aprovador SHARED

- BLG-BUG-004..008: calendário, pendências, membros e busca global com latest-wins, loading por requisição ativa, erro distinto de vazio e ações por item.
- BLG-FE-002: `systemAdminGuard` (`/admin/users`) e `auditAccessGuard` (`/audit`), com menu de Auditoria coerente.
- BLG-FE-007: validação de título após trim, `workDescription` em CLIENT e e-mail SHARED válido.
- BLG-BUG-009: reabrir SHARED rejeita aprovador herdado inativo ou que deixou o calendário.
- Validação: backend 19/19 e frontend 53/53 em 13 arquivos (integrado e standalones); build SSR com 9 rotas e 4 warnings de budget conhecidos; paridade backend 85/85 e frontend 78/78.
- Q-004, Q-005 e a leitura de BR-PAY-003 (PAID → PENDING → troca de tipo/valor) continuam abertas.

## Incremento 2026-11-11 (noite) — correção de incidentes e confirmação de agendamento

Detalhes em [incident-corrections/](incident-corrections/tasks.md). Sem commit/push.

- INC-01 login sem nota de token; INC-02 modal em seções; INC-03 membros (select, 404/409,
  sem upsert); INC-04 usuários (ícones, desativação lógica, último ADMIN); INC-05 financeiro
  (select de período, KPIs, donuts, evolução, recentes); INC-06 sidebar/painel recolhíveis;
  INC-07 auditoria real.
- NF-01 confirmação de atendimento (confirmar, desmarcar com motivo, remarcar no mesmo
  evento, histórico e auditoria) com integração financeira.
- Backend 37 → 60 testes. Frontend: ver 20.

## Incremento 2026-11-11 (tarde) — consolidação SDD + remodelagem

Continuação da execução interrompida do agente anterior (que só havia criado os 3 docs de
`frontend-redesign/`). Entregue no monorepo e sincronizado nos standalones:

- BLG-TEST-001: `PaymentUpdateMatrixIntegrationTests` (18 casos, H2).
- Dependências: Angular 21.2.21 → 21.2.26 (framework) / 21.2.29 (build, cli, ssr);
  transitivos body-parser 2.4.0, proxy-addr 2.0.8, qs 6.17.1. Audit produção 0.
- BLG-FE-004 Admin Users completo; Settings com aparência e identidade somente leitura.
- Login: SVG próprio com tokens, seletor de tema; resolvedor único do tema; sync entre abas.
- Calendário: invalidação do resumo, relógio dos próximos eventos, duração sem truncamento,
  card de pendência sem interativo aninhado, foco gerenciado nos modais, texto PT-BR.
- Pendências: reabertura legítima visível; notificação de mudança; tokens.
- Membros/Financeiro: tokens, template legível, papéis em PT-BR, gráfico real, budget sem aviso.
- Testes: frontend 53 → 86 (15 arquivos); backend 19 → 37.

## Incremento 2026-11-11 — redesign de UI/UX do frontend

- Design system em `src/styles/` (tokens claro/escuro, base, shell, calendário, FullCalendar, modais, login); componentes abaixo do budget de 8 kB (avisos de budget caíram de 4 para 1).
- Ícones SVG inline (`shared/ui/icon`), sem dependência nova. `lang="pt-BR"`.
- Tema claro/escuro/sistema real (`ThemeService`, `localStorage sharedPlanner.theme`), aplicado antes da pintura.
- Shell: sidebar navy com grupos, colapsável em ≤1024px; sino com contagem real de aprovações que aguardam o usuário; perfil com papel, tema, configurações e sair; "Convidar usuário" falso virou "Adicionar membro" → `/members`.
- Calendário: cores por tipo (CLIENT verde, PERSONAL azul, SHARED roxo, pendente âmbar, rejeitado vermelho), segmentado Mês/Semana/Dia, chips de tipo, título do período; painéis Próximos eventos, Convites pendentes e Resumo financeiro (real, `/api/finance/summary`, só com capacidade financeira, variação contra o mês anterior).
- Modal: cards de tipo, campos dinâmicos, duração como atalho do término (contrato da API inalterado); CLIENT usa o nome do cliente como título quando vazio.
- Login: split-screen, mostrar/ocultar senha, erros por campo; removidos Google, cadastro, "esqueci a senha" e "lembrar de mim" (sem suporte).
- Correção: rotas autenticadas deixam de ser pré-renderizadas (`RenderMode.Client`); antes, F5/URL direta em `/calendar` caía num `<meta refresh>` fixo para `/login`. Só `/login` é pré-renderizada.
- Decisões aplicadas: D1–D9 do Estágio 1 do redesign (pt-BR, tema real, sem campos/menus sem suporte).

## Multi-repository stabilization

| Etapa | Status |
|---|---|
| Repositórios standalone criados | PASS |
| Specs de topologia/sync/acesso | PASS |
| Contextos Compose standalone | PASS |
| Paridade backend/frontend | PASS — 84/84 e 76/76 |
| Builds Docker standalone | PASS |
| Stack, health e regressão | PASS |
| PostgreSQL e persistência | PASS |
| Login API e Edge headless | PASS |
| Conexão DBeaver | PASS |
| Commit backend atual | PASS — `1a9475283e93dafc188ecf903c45ed4f5690a924` |
| Commit frontend atual | PASS — `e18c68fcd22aa3d83e6f5df5bb5a7c291af8b3f1` |
| Commit integração — implementação | PASS — `28289250189302882644a27ea3e91ed8eb15b0fe` |
| Commit integração — documentação/SDD | THIS_DELIVERY — SHA reportado no handoff |
| Push | NO — FORBIDDEN_IN_THIS_EXECUTION |

## Remaining Product Features

- Admin users page e listagem no UserService frontend.
- Audit page.
- Guards/menus por capacidade fora do fluxo Finance.
- Settings e decisões abertas.
- Automação ampla de regras e E2E.

## Blocked

Q-001–Q-006: decisões de autoria, responsável, ADMIN, SHARED, pagamento e retenção. Q-007 foi resolvida tecnicamente pela regra de cancelamento persistente.

## Known Technical Debt

- Snapshot 2026-08-22: o build SSR passava com quatro warnings de budget SCSS. Em
  2026-11-11 o build passa sem avisos de budget.
- Audit completo (dev) 2026-11-11: 27 achados (22 moderados, 5 altos) somente em tooling de
  desenvolvimento; não entram no bundle nem no servidor SSR (ver 31).
- Dependências integradas foram atualizadas de forma deliberada para Angular 21.2.21, sem `npm audit fix`/major; `npm ci` PASS com 505 pacotes e audits runtime/completo retornam 0 vulnerabilidades.

## Next Recommended Step

Atualização 2026-11-11: Admin Users foi entregue. Próximos passos recomendados: decidir
Q-005/Q-004/Q-006 e BR-PAY-003; validar invariantes em PostgreSQL isolado; adicionar E2E
(requer nova ferramenta — decisão do dono) e CI de testes/build/paridade; hardening S2/S3
mediante autorização de backend/infra. O parágrafo abaixo é histórico.

Implementar a página administrativa de Users como próxima unidade vertical. Em seguida, manter S0/S1 zerados enquanto Audit, os S2/S3 e estados assíncronos restantes são tratados; Q-004/Q-005 continuam exigindo decisão explícita.
