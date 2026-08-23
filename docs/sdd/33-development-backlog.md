# 33 — Backlog de desenvolvimento

Atualizado em 2026-08-22. Este backlog deriva da auditoria funcional e de segurança, não da facilidade aparente de implementação. Os IDs são estáveis e cada item deve manter rastreabilidade até spec, regra, critério de aceite, implementação, teste e validação.

## Política de priorização

| Prioridade | Significado |
|---|---|
| P0 | Integridade/perda de dados, segurança crítica ou aplicação bloqueada. |
| P1 | Regra de negócio crítica ou segurança alta. |
| P2 | Funcionalidade importante ou segurança média. |
| P3 | Melhoria secundária ou segurança baixa. |
| P4 | Cosmético e dívida técnica de baixo impacto. |

Ordem obrigatória:

1. P0 de integridade.
2. S0 e S1 de segurança.
3. P1 de regras/bugs e testes negativos correspondentes.
4. Primeira feature completa.
5. Demais backend/frontend, testes, UX e dívida.

Estado após validação multi-repositório: `S0 = 0` e `S1 = 0`. Os dois S1, o fallback JWT conhecido e o finding de dependências foram encerrados; loopback, validação/integridade e cobertura receberam mitigação parcial. Finance foi entregue depois do gate, sincronizado e revalidado nos standalones. Riscos S2/S3 permanecem no backlog.

## SECURITY

| ID | Prioridade | Finding | Trabalho e critério de saída | Estado |
|---|---:|---|---|---|
| BLG-SEC-001 | P1 | SEC-FIND-001 — EventResponse expunha amount e pagamento a VIEWER/EDITOR. | Projeção por capacidade e omissão dos cinco campos; contract tests backend e UI redigida. | DONE — S1 CLOSED e sincronizado |
| BLG-SEC-002 | P1 | SEC-FIND-002 — ex-membro listava e decidia pendência SHARED. | Fila e approve/reject revalidam membership atual; teste negativo preserva evento/status. | DONE — S1 CLOSED e sincronizado |
| BLG-SEC-003 | P2 | SEC-FIND-003 — credenciais públicas de seed e portas locais amplas. | Loopback é default via `BIND_ADDRESS`; ainda separar/impedir seeds em ambiente compartilhado e documentar rotação. | PARTIAL — S2 OPEN |
| BLG-SEC-004 | P2 | SEC-FIND-004 — segredo JWT de desenvolvimento versionado. | Fallback removido; secret externo mínimo e issuer validados. Secret store/rotação seguem como hardening geral. | DONE — S2 CLOSED e sincronizado |
| BLG-SEC-005 | P2 | SEC-FIND-005 — dependências npm vulneráveis na baseline. | Angular 21.2.21 atualizado deliberadamente, sem fix forçado/major; `npm ci` e audits runtime/completo passam com 0 vulnerabilidades. | DONE — S2 CLOSED e sincronizado |
| BLG-SEC-006 | P2 | SEC-FIND-006 — usuário runtime do PostgreSQL reutiliza bootstrap. | Separar owner/migration de usuário da aplicação e aplicar privilégio mínimo; validar conexão/migrations/runtime. | OPEN — S2 |
| BLG-SEC-007 | P2 | SEC-FIND-007 — JWT em localStorage. | Registrar decisão arquitetural; preferir cookie HttpOnly/Secure/SameSite quando backend suportar ou aplicar mitigação explícita com CSP, TTL curto e revisão XSS. | NEEDS_DECISION — S2 |
| BLG-SEC-008 | P2 | SEC-FIND-008 — headers de segurança e TLS não definidos para produção. | Especificar HTTPS e configurar CSP, frame-ancestors, nosniff, Referrer-Policy e HSTS no ponto correto de terminação; validar por ambiente. | OPEN — S2 |
| BLG-SEC-009 | P2 | SEC-FIND-009 — sem rate limit e política de senha suficiente. | Definir limites de login, resposta 429 e política compatível com contas existentes; não introduzir enumeração. | OPEN — S2 |
| BLG-SEC-010 | P2 | SEC-FIND-010 — auditoria sem retenção/máscara. | Resolver Q-006, proibir secrets/Authorization/JWT em snapshot e testar minimização/retention. | NEEDS_DECISION — S2 |
| BLG-SEC-011 | P2 | SEC-FIND-011 — ACL local dos arquivos sensíveis requer hardening. | Restringir ACL de .env, volumes/backups e credenciais ao usuário/serviço necessários; documentar verificação Windows. | OPEN — S2 |
| BLG-SEC-012 | P2 | SEC-FIND-012 — cobertura/monitoramento de segurança insuficientes. | Negativos críticos agora cobertos em 16 testes backend/31 frontend; ainda automatizar CI/E2E/concorrência e eventos defensivos sem secrets. | PARTIAL — S2 OPEN |
| BLG-SEC-013 | P3 | SEC-FIND-013 — validações de input/JWT incompletas. | `@Digits`, segredo/duração e issuer foram reforçados; ainda alinhar limites texto/body, audience e boundary tests. | PARTIAL — S3 OPEN |
| BLG-SEC-014 | P3 | SEC-FIND-014 — supply chain sem gate reproduzível. | Fixar política de atualização, audit/scan em CI, SBOM quando adotado e revisão de imagens base. | OPEN — S3 |
| BLG-SEC-015 | P3 | SEC-FIND-015 — constraints e backup/restore incompletos. | Integridade financeira no serviço está coberta; ainda adicionar invariantes DB possíveis, backup, retenção e restore testado. | PARTIAL — S3 OPEN |
| BLG-SEC-016 | P3 | SEC-FIND-016 — proxy SSR sem hardening operacional. | Restringir destino, headers hop-by-hop, limites, timeouts e tratamento seguro de erro; testar proxy e SSR. | OPEN — S3 |
| BLG-SEC-017 | P2 | SEC-FIND-017 — política de edição ampla do alvo SHARED. | Resolver Q-004 e implementar a matriz aprovada de atores, campos e reaprovação; não inventar a política nesta execução. | NEEDS_DECISION — S2 |

## BUG

| ID | Prioridade | Problema | Critério de aceite | Estado |
|---|---:|---|---|---|
| BLG-BUG-001 | P0 | Editar tipo/amount de evento podia preservar pagamento incoerente. | Serviço rejeita/reconcilia mudanças incompatíveis e regressão cobre redução/troca de tipo; matriz completa de status e constraints DB segue em BLG-TEST-001/SEC-015. | FIXED e sincronizado; cobertura complementar OPEN |
| BLG-BUG-002 | P1 | Owner podia ser rebaixado por POST/PUT de membro. | Toda API preserva owner como ADMIN; POST e PUT retornam 400 e não alteram vínculo. | CLOSED e sincronizado |
| BLG-BUG-003 | P1 | Ex-membro referenciado como alvo podia aprovar/rejeitar SHARED. | Membership atual é revalidada; remoção invalida fila/ação sem apagar histórico. | CLOSED e sincronizado |
| BLG-BUG-004 | P1 | Calendário converte falhas de eventos/pendências em listas vazias. | Falha total é erro visível; falha parcial é identificada sem afirmar agenda vazia; retry preserva filtro. | OPEN |
| BLG-BUG-005 | P2 | Respostas antigas de calendário podem sobrescrever período/filtro recente e liberar loading cedo. | switchMap/cancelamento ou request-id garante latest-wins; loading representa requests ativos; teste assíncrono. | OPEN |
| BLG-BUG-006 | P2 | Página de membros mistura loading e respostas entre calendários. | Seleção limpa/identifica estado, resposta antiga não atualiza calendário novo e erro não mantém lista enganosa. | OPEN |
| BLG-BUG-007 | P3 | Busca pode exibir resposta do termo anterior antes do próximo debounce. | Toda mudança invalida request anterior; resultado sempre corresponde ao termo atual. | OPEN |
| BLG-BUG-008 | P3 | Pending mostra empty durante loading e usa um único actionEventId para ações concorrentes. | Estados são mutuamente exclusivos; ações ficam bloqueadas por item até conclusão e erros são preservados. | OPEN |

## BUSINESS RULE

| ID | Prioridade | Decisão/regra | Saída esperada | Estado |
|---|---:|---|---|---|
| BLG-BR-001 | P1 | Q-001 — o que é agenda própria. | Definição aprovada, regra BR-EVT-004 atualizada e impacto em autorização/dados/UI/migração. | NEEDS_DECISION |
| BLG-BR-002 | P1 | Q-002 — responsável como User ou texto. | Modelo e contrato definem responsibleUser, default e tipos aplicáveis. | NEEDS_DECISION |
| BLG-BR-003 | P1 | Q-003 — alcance do bypass ADMIN. | Matriz explicita leitura, administração, autoria e eventual impersonação auditada. | NEEDS_DECISION |
| BLG-BR-004 | P1 | Q-004 — edição/reaprovação SHARED. | Campos/atores/transições definidos e SEC-FIND-017 encerrado por implementação e testes da política aprovada. | NEEDS_DECISION |
| BLG-BR-005 | P1 | Q-005 — capacidade para alterar pagamento. | Matriz decide FINANCE versus autoria e backend/frontend usam a mesma capacidade. | NEEDS_DECISION |
| BLG-BR-006 | P2 | Q-006 — retenção e minimização de auditoria. | Prazo, mascaramento, exportação, acesso e descarte aprovados. | NEEDS_DECISION |
| BLG-BR-007 | P3 | Settings. | Definir objetivo e critérios ou remover rota até haver requisito; não inventar opções. | NEEDS_DECISION |

## BACKEND

| ID | Prioridade | Entrega | Critério de saída | Estado |
|---|---:|---|---|---|
| BLG-BE-001 | P0 | Garantir invariantes de pagamento também em EventService.update e no banco onde possível. | Regra de serviço e regressão implementadas; constraints adicionais seguem no backlog. | IMPLEMENTED parcial |
| BLG-BE-002 | P1 | Criar resposta/projeção de evento por capacidade financeira. | Satisfazer BLG-SEC-001 sem quebrar calendário para VIEWER/EDITOR. | DONE e sincronizado |
| BLG-BE-003 | P1 | Revalidar vínculo atual na fila e decisão SHARED. | Satisfazer BLG-SEC-002 e BLG-BUG-003 sem antecipar Q-004. | DONE e sincronizado |
| BLG-BE-004 | P1 | Preservar owner ADMIN em todas as mutações de membro. | Satisfazer BLG-BUG-002. | DONE e sincronizado |
| BLG-BE-005 | P1 | Endurecer autenticação: JWT, rate limit, eventos de segurança e respostas consistentes. | JWT issuer/config/ativos concluídos; rate limit e eventos seguros continuam. | PARTIAL |
| BLG-BE-006 | P2 | Completar limites de DTO e padronizar contrato de erro seguro. | Precisão financeira concluída; limites restantes e envelope de erro continuam. | PARTIAL |
| BLG-BE-007 | P2 | Completar consulta de auditoria após decisão. | Filtros aprovados, paginação/limite e autorização possuem testes. | OPEN |
| BLG-BE-008 | P2 | Preparar contrato Finance estável para a primeira feature. | Summary e presets documentados, campos minimizados e contratos testados. | DONE e sincronizado |

## FRONTEND

| ID | Prioridade | Entrega | Critério de saída | Estado |
|---|---:|---|---|---|
| BLG-FE-001 | P1 | Limitar Bearer a requests /api confiáveis e tratar 401/403. | 401 limpa sessão uma vez; 403/500 preservam sessão; chamada externa nunca recebe token; Authorization explícito é preservado. | DONE e sincronizado |
| BLG-FE-002 | P1 | Guards e navegação por papel/capacidade. | Finance reflete capacidade e acesso direto tem UX correta; Users/Audit ainda exigem revisão própria. | PARTIAL |
| BLG-FE-003 | P2 | Implementar Finance como primeira feature após os gates. | Resumo/receitas, períodos, estados, autorização, acessibilidade e testes; sem despesas/relatórios inventados. | DONE e sincronizado |
| BLG-FE-004 | P2 | Implementar Admin Users. | List/create/edit/active/role, validação, loading, empty, erro, sucesso, autoproteção e testes. | OPEN |
| BLG-FE-005 | P2 | Implementar Audit. | Lista autorizada, filtros aprovados, loading/empty/error, snapshots tratados com minimização e testes. | OPEN |
| BLG-FE-006 | P2 | Corrigir estados assíncronos de calendar/pending/members/search. | Satisfazer BLG-BUG-004 a BLG-BUG-008. | OPEN |
| BLG-FE-007 | P2 | Completar validação de eventos. | CLIENT exige workDescription; trim do título; e-mail SHARED válido; erros de campo e backend coerentes. | OPEN |
| BLG-FE-008 | P3 | Implementar criação de calendário para ADMIN ou remover expectativa da UI. | Fluxo segue BR-CAL-002, autorização backend e testes. | OPEN |
| BLG-FE-009 | P3 | Settings somente após BLG-BR-007. | Nenhuma implementação sem spec aprovada. | NEEDS_DECISION |

## TEST

| ID | Prioridade | Suíte | Casos mínimos | Estado |
|---|---:|---|---|---|
| BLG-TEST-001 | P0 | Regressão de integridade de pagamento. | Redução de amount/troca de tipo cobertas; falta matriz de `updatePayment` em todos os status, rollback/auditoria e constraints reais. | PARTIAL |
| BLG-TEST-002 | P1 | Negativos de SEC-FIND-001. | VIEWER/EDITOR sem campos; papéis/autoria aprovados com contrato financeiro; UI redigida. | DONE e sincronizado |
| BLG-TEST-003 | P1 | Negativos de SEC-FIND-002. | Alvo removido deixa de listar e recebe negação em approve/reject; status permanece pendente. | DONE e sincronizado |
| BLG-TEST-004 | P1 | Autenticação e sessão. | Ausente, adulterado, expirado, issuer incorreto, inativo, 401/403/500 cobertos; logout/rate limit/matriz alg continuam. | PARTIAL |
| BLG-TEST-005 | P1 | BOLA/matriz de autorização. | Calendário, evento, membro e papéis críticos cobertos; ampliar matriz completa/userId/auditoria. | PARTIAL |
| BLG-TEST-006 | P1 | Owner e revogação SHARED. | POST/PUT owner e remoção/decisão cobertos; concorrência permanece. | PARTIAL |
| BLG-TEST-007 | P2 | Estados Angular. | Finance cobre loading/error/empty/no-access/retry e invalidação de filtros; calendar/pending/members/search continuam. | PARTIAL |
| BLG-TEST-008 | P2 | Finance. | BR-FIN-001–003, períodos civis/custom, autorização, contratos, erro/empty e renderização. | DONE e sincronizado |
| BLG-TEST-009 | P2 | E2E crítico. | login→calendar→evento→SHARED→aprovação e CLIENT→pagamento→Finance. | OPEN |
| BLG-TEST-010 | P2 | Auditoria e exposição. | Ausência de senha/hash em contratos coberta; operações/retention/segredos em logs continuam. | PARTIAL |

## TECHNICAL DEBT

| ID | Prioridade | Item | Critério de saída |
|---|---:|---|---|
| BLG-TD-001 | P2 | Triagem controlada das dependências npm. | DONE nos dois contextos: Angular 21.2.21, `npm ci`, audits 0 e regressão; manter recorrente e nunca executar audit fix --force automaticamente. |
| BLG-TD-002 | P3 | Automatizar paridade dos repositórios em CI/check local. | Divergência backend/frontend falha antes de release; .git, build e secrets permanecem excluídos. |
| BLG-TD-003 | P3 | Centralizar mapeamento de erros e capacidades no frontend. | Menos duplicação sem transformar frontend em autoridade. |
| BLG-TD-004 | P4 | Reduzir warnings de budget SCSS. | Quatro estilos ficam abaixo do budget acordado ou budget é justificado/documentado. |
| BLG-TD-005 | P4 | Melhorar legibilidade de MembersPage e normalizar textos pt-BR. | Código não fica comprimido em linhas únicas e UI usa acentuação consistente. |
| BLG-TD-006 | P4 | Rever metadados HTML e acessibilidade básica. | lang pt-BR, títulos, foco de modal e anúncios de loading/erro validados. |
| BLG-TD-007 | P1 | Evitar N+1 na redação financeira de listas/pending. | DONE e sincronizado: `EventFinancialAccess` é resolvido uma vez por request/calendar e cacheado por `calendarId`; teste unitário e integração preservam autoria/capacidade. |

## UX

| ID | Prioridade | Item | Critério de saída |
|---|---:|---|---|
| BLG-UX-001 | P2 | Estados loading, empty, erro parcial, retry e acesso negado. | Cada página distingue os estados e não apresenta falha como ausência de dados. |
| BLG-UX-002 | P2 | Explicar permissões sem substituir segurança backend. | Ações indisponíveis ficam ocultas/desabilitadas com motivo; 403 é compreensível. |
| BLG-UX-003 | P3 | Remover ou marcar recursos fictícios. | Google, cadastro, reset, rememberMe, convite, tema, Despesas e Relatórios não parecem funcionais sem spec/implementação. |
| BLG-UX-004 | P3 | Avaliar eventos que atravessam dias. | Decidir requisito; se aceito, formulário representa datas distintas e possui teste. |
| BLG-UX-005 | P3 | Feedback de sucesso e confirmação consistente. | Create/edit/payment/member/approval comunicam conclusão e impedem submissão duplicada. |

## Plano de execução

### Gate 0 — integridade e segurança

- [x] Núcleo do BLG-BUG-001 corrigido e regressão de update comum aprovada; expansão da matriz de pagamentos permanece em BLG-TEST-001.
- [x] SEC-FIND-001 fechado por BLG-SEC-001/BLG-BE-002/BLG-TEST-002 e revalidado nos standalones.
- [x] SEC-FIND-002 fechado por BLG-SEC-002/BLG-BE-003/BLG-TEST-003; Q-004 permanece separada em SEC-FIND-017.
- [x] `S0 = 0` e `S1 = 0` confirmados em 16 testes backend e 31 frontend.

### Gate 1 — P1 funcional

- [x] Owner protegido contra rebaixamento em update e upsert; remoção continua proibida.
- [x] Revogação de vínculo SHARED definida e testada sem decidir Q-004.
- [x] Sessão/interceptor 401/403 e navegação Finance por capacidade corrigidos; guards de Users/Audit permanecem em BLG-FE-002.
- [ ] Falha de carregamento não aparece como lista vazia.

### Unidade funcional concluída e sincronizada — Finance

Finance foi implementada como primeira feature após o gate porque BR-FIN-001–003, AC-FIN-001–003, queries e endpoints já existiam. O incremento fechou segurança de dados, integridade principal, UI e testes sem criar despesas ou relatórios fora da spec; depois foi sincronizado e revalidado nos standalones.

Escopo fechado:

1. calendário selecionável somente quando o usuário possui capacidade financeira;
2. presets DAILY, WEEKLY, BIWEEKLY e MONTHLY pelo contrato existente;
3. intervalo customizado pelo summary;
4. cards expectedAmount, receivedAmount, pendingAmount, appointmentCount, paidCount, pendingCount, partiallyPaidCount e refundedCount;
5. loading, empty, erro, retry e 403;
6. responsividade e acessibilidade básica;
7. testes de componente, service/contract, autorização e regressão financeira;
8. navegação Finance apenas quando autorizada.

Fora deste incremento: despesas, comissões, parcelamento, múltiplas moedas, relatórios genéricos, exportação e integrações externas.

Critérios de conclusão:

- [x] Spec e regras continuam coerentes, sem alterar CURRENT para justificar código.
- [x] BLG-SEC-001 e o núcleo do BLG-BUG-001 estão fechados nos três repositórios.
- [x] Backend e frontend standalone/integrado permanecem em paridade (84/84 e 76/76).
- [x] Testes backend (16), frontend (31), contratos e build (9 rotas) passam.
- [x] VIEWER/EDITOR sem capacidade não recebem dados financeiros.
- [x] ADMIN/FINANCE autorizados obtêm totais corretos dentro do vínculo exigido.
- [x] CLIENT entra; PERSONAL, SHARED e CANCELLED não entram no resumo.
- [x] O incremento não expõe secret nem dado financeiro a ator sem capacidade; erros Finance têm estado controlado.

Paridade multi-repositório, suítes standalone e runtime Docker foram revalidados; Finance está concluída no escopo de receitas definido pela spec.

## Definition of Done

Uma unidade só passa a IMPLEMENTED quando:

- [ ] spec e business rules estão aprovadas;
- [ ] critérios de aceite estão rastreados;
- [ ] backend valida e autoriza por recurso;
- [ ] contrato retorna somente dados necessários;
- [ ] frontend valida e trata loading, empty, erro e sucesso;
- [ ] testes positivos, negativos, autorização e regressão passam;
- [ ] segurança foi revisada e S0/S1 permanecem zerados;
- [ ] documentação e matriz de completude foram atualizadas;
- [ ] paridade multi-repositório foi verificada;
- [ ] build e runtime relevante foram validados.
