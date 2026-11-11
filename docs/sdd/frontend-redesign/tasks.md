# Tarefas e matriz consolidada

IDs `R-*` e `BLG-*-NEW` são **propostos** nesta entrega (não constavam no SDD antes de
11/11/2026). IDs `BLG-*` existentes foram preservados. Classificação de evidência:
[VERIFICADO] leitura/execução nesta rodada; [DOC] só documentação; [INFERIDO] hipótese;
[DECISÃO NECESSÁRIA] depende do dono.

Rodada de execução: 11/11/2026, Windows/PowerShell, Java 17.0.12, Node 22.12.0, npm 10.9.0.
O agente Codex anterior parou após criar apenas `requirements.md`, `design.md` e este
arquivo (16 itens não rastreados = 12 referências em `docs/reffs`, `.vscode/settings.json`
e os 3 documentos). Nenhum código havia sido alterado. [VERIFICADO]

## Comparação entre as duas listas (anexo 1 = onboarding/consolidação; anexo 2 = redesign)

| Tema | Anexo 1 | Anexo 2 | Classificação | Tratamento |
|---|---|---|---|---|
| Paridade monorepo ↔ standalones | A | — (regra "todos os diretórios" do dono) | complementar | R-10 |
| Pagamentos BLG-TEST-001 | B | "não altere cálculos" | complementar | testes apenas, sem mudar regra |
| Dependências | C | "não adicione bibliotecas" | complementar | patch 21.2.x deliberado, sem lib nova |
| Calendário/pendências/sino | D | Fase 5/8 | equivalente | R-03/R-04 |
| Admin Users | E | Fase 9 (administração) | equivalente | R-05 |
| Login + ilustração + tema | F | Fase 10 (prioritária) | equivalente | R-02 |
| Financeiro | G | Fase 7 | equivalente | R-06 |
| Tokens, a11y, modais | H | Fases 4, 12 | equivalente | R-01/R-07 |
| Auditoria | I | — | dependente de decisão (Q-006) | não implementado |
| Hardening S2/S3 | J | "não altere backend" | conflitante | só documentado; exige autorização específica |
| Testes/E2E/CI | K | Fase 14 | complementar | unit/integração feitos; E2E/CI pendentes |
| Documentação | L | Fase 3 | equivalente | este diretório + SDD 01/19/20/21/33 |
| Settings / menu do usuário | BLG-BR-007 | Fase 11 | complementar | R-08: só aparência + identidade somente leitura |

## Backlog consolidado e estado

| ID | Origem | Problema | Evidência | Resultado esperado | Camadas/arquivos | Prio | Depend. | Esforço | Risco | BR/AC | Testes | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R-10 | ambos | standalones atrasados e paridade FAIL (2 backend / 34 frontend) | [VERIFICADO] `check-repository-sync.ps1` | ff dos standalones + sync + PASS | scripts, 3 repos | P0 | autorização Git (ff) | P | médio | 24–26 | check oficial | ver 20-validation-report |
| BLG-TEST-001 | onboarding | matriz `updatePayment` incompleta | [VERIFICADO] só 4 testes de integridade | 4 status, inválidos, método, datas, tipo, cancelado, autorização, sem efeito colateral/auditoria em falha | backend test | P0 | — | M | baixo | AC-PAY-001–004 | `PaymentUpdateMatrixIntegrationTests` 18/18 | DONE (H2) |
| BLG-SEC-DEP-NEW | onboarding | 6 achados produção (1 crítico, 3 altos, 2 moderados) | [VERIFICADO] `npm audit --omit=dev` | patch compatível, aplicabilidade documentada | package.json/lock | P0 | — | P | médio | SDD 29–33 | audit + testes + build | ver 20/31 |
| R-03a | onboarding | resumo financeiro do card não invalida | [VERIFICADO] chave só calendário+mês | recarregar após criar/editar/cancelar/pagar/aprovar | `core/state/data-change.service.ts`, calendar-page | P1 | — | P | baixo | AC-FIN-* | `reloads the monthly finance summary...` | DONE |
| R-04 | onboarding | pendência reaberta ocultada | [VERIFICADO] `resolvedEventIds` vitalício | consulta nova é autoritativa; resposta antiga ignorada | pending-page | P1 | Q-004 intacta | P | baixo | BR-SHARED | `shows a reopened item...` + stale | DONE |
| R-03b | onboarding | sino não atualiza após decidir | [VERIFICADO] só NavigationEnd | atualizar via DataChangeService | app-shell | P1 | R-03a | P | baixo | — | `refreshes the bell counter...` | DONE |
| R-03c | onboarding | "Próximos eventos" com `Date.now()` não reativo | [VERIFICADO] | relógio local de 60 s; escopo = período carregado + filtros | calendar-page | P2 | — | P | baixo | — | cobertura indireta | DONE (janela independente não aceita) |
| R-03d | onboarding | atalho de duração truncava em 23:59 | [VERIFICADO] `Math.min(...,23:59)` | durações que excedem o dia não são oferecidas/aplicadas; mensagem explícita | calendar-page | P2 | BLG-UX-004 | P | baixo | — | `never applies a duration...` | DONE |
| R-05 / BLG-FE-004 | ambos | Users placeholder | [VERIFICADO] | lista, busca local, criar, editar nome/papel/ativo, 409, 403, autoproteção | user.service, users-page | P1 | API existente | M | médio | BR-USER-001/002 | 13 testes | DONE |
| R-02 | ambos | tema inconsistente no login | [VERIFICADO] PNG opaco 575×545; sem controle de tema no login; script pré-pintura divergia em valor inválido | SVG com tokens; seletor claro/escuro/sistema; resolvedor único; sync entre abas | theme.service, index.html, login-page, _login | P1 | — | M | médio | — | theme.service.spec + login-page.spec | DONE |
| R-06 | ambos | Finance sem tokens/tema escuro, budget 5,03 kB, gráficos | [VERIFICADO] | tokens; scss reduzido; gráfico só com contagens reais | finance-page | P1 | — | P | baixo | BR-FIN-001–003 | finance-page.spec (chart + vazio) | DONE |
| R-01/R-07 | ambos | Pendências/Membros com cores fixas, acentuação, template comprimido, foco modal, role=button aninhado | [VERIFICADO] | camada `_pages.scss`; textos PT-BR; diretiva `spDialogFocus`; card sem aninhamento | styles, pages, shared/a11y | P1 | — | M | baixo | BLG-TD-004–006, BLG-UX-001/002/005 | dialog-focus.directive.spec | DONE (contraste/leitor de tela: manual) |
| R-08 | dono | Settings placeholder | [VERIFICADO] | aparência (3 modos) + identidade somente leitura | settings-page | P2 | BLG-BR-007 | P | baixo | — | settings-page.spec | DONE parcial (sem edição de perfil) |
| BLG-FE-005 | onboarding | Audit placeholder | [VERIFICADO] | lista/filtros sem snapshots sensíveis | audit-page | P2 | **Q-006** | M | alto | AC-AUDIT-001/002 | — | BLOCKED [DECISÃO NECESSÁRIA] |
| BLG-SEC-003/006–016 | onboarding | hardening S2/S3 | [DOC] 33 | unidades independentes | backend/infra | P2 | autorização backend/infra | G | alto | 29–32 | — | NOT STARTED (conflito com anexo 2) |
| BLG-E2E-NEW | ambos | sem E2E | [VERIFICADO] sem config | login→calendário→SHARED→aprovação; CLIENT→pagamento→Finance | novo tooling | P1 | ambiente isolado; adicionar ferramenta | M | médio | — | — | NOT STARTED (exige nova dependência) |
| BLG-CI-NEW | ambos | sem CI | [VERIFICADO] | testes/build/paridade em CI | .github | P2 | decisão de plataforma | P | baixo | — | — | NOT STARTED |
| BLG-PG-NEW | onboarding | invariantes só em H2 | [VERIFICADO] | validar em PostgreSQL isolado | infra | P1 | banco isolado (não o local) | M | médio | — | — | NOT STARTED |

## Tarefas executáveis

- [x] T1 Descoberta: SDD, código, rotas, serviços, guards, testes, Git dos 3 repos.
- [x] T2 Referências: 12 imagens em `docs/reffs` abertas por agente anterior e cruzadas com as
      decisões D1–D9 já registradas em 21 (família navy; sem Google/cadastro/despesas/gráficos fictícios).
- [x] T3 Paleta: tokens claros/escuros alinhados (`#080F20`, `#0B1530`, `#111C35`, `#172440`,
      `#F8FAFC`, `#A8B8D5`; claro `#F8FAFC`, `#FFFFFF`, `#F1F5F9`, `#0F172A`, `#64748B`); token de cancelado.
- [x] T4 Camada `_pages.scss` (header, painel, feedback, vazio, formulário, tabela responsiva, pendências).
- [x] T5 Pendências: tokens, PT-BR, pílula por tipo, reabertura correta, notificação de mudança.
- [x] T6 Membros: template legível, rótulos PT-BR dos papéis, tabela empilhável no mobile, `aria-label`.
- [x] T7 Financeiro: tokens, scss menor (budget sem aviso), gráfico de distribuição real, card com texto coerente.
- [x] T8 Calendário: invalidação do resumo, relógio, duração, card de pendência sem aninhamento, foco dos modais.
- [x] T9 Login e tema: SVG próprio, seletor de tema, resolvedor único, sync entre abas, `color-scheme`.
- [x] T10 Settings: aparência + identidade somente leitura.
- [x] T11 Users: CRUD permitido pelo contrato.
- [x] T12 Backend: matriz BLG-TEST-001 (somente testes, sem alterar regra).
- [x] T13 Dependências: patch 21.2.x e transitivos (ver 20/31 para resultado real).
- [x] T14 Testes/build reais registrados em 20.
- [ ] T15 Inspeção visual renderizada vs. referências — não executada nesta rodada (ver limitações).
- [ ] T16 E2E, CI, PostgreSQL isolado, hardening S2/S3, Audit — fora do escopo autorizado ou bloqueados.
