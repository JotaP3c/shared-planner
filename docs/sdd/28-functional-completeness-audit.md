# 28 — Auditoria de completude funcional

Atualizado em 2026-08-22. Este documento confronta o estado executável encontrado nos repositórios de integração, backend e frontend com as regras e critérios existentes em docs/sdd. Ele não promove comportamento CURRENT a requisito TARGET e não resolve questões de produto em aberto.

## Escopo e método

Foram analisados estaticamente controllers, DTOs, services, autorização, entidades, repositories, migrations Flyway, rotas, guards, interceptor, services e páginas Angular. Também foram consideradas as evidências de runtime registradas nos relatórios SDD anteriores.

A situação geral de uma linha segue a Definition of Done estrita:

| Estado | Uso nesta auditoria |
|---|---|
| **IMPLEMENTED** | Spec, regras, camadas necessárias, autorização, validação e evidência de teste/regressão estão presentes. |
| **PARTIALLY_IMPLEMENTED** | Há implementação útil, mas falta pelo menos uma camada, estado, validação, teste ou revisão de segurança necessária. |
| **NOT_IMPLEMENTED** | Existe no máximo rota, scaffold ou contrato sem fluxo funcional. |
| **BROKEN** | O fluxo existe, mas um defeito confirmado produz resultado incorreto, estado inválido ou feedback enganoso. |
| **SPEC_CONFLICT** | O CURRENT contradiz requisito TARGET já registrado. |
| **NEEDS_DECISION** | O comportamento correto depende de decisão de produto ainda aberta. |

Prioridades: P0 bloqueia a aplicação, ameaça integridade ou pode causar perda/corrupção de dados; P1 cobre segurança alta ou regra crítica; P2 é funcionalidade importante; P3 é melhoria secundária; P4 é dívida técnica ou cosmética.

## Baseline de evidência

- Backend integrado e standalone: `mvnw clean test` PASS, com 16 testes automatizados cobrindo context/cancelamento, JWT, BOLA, papéis, redação financeira e resolução de acesso sem N+1, revogação SHARED, owner, contrato de usuário, precisão/integridade de pagamento e resumo Finance.
- Frontend integrado e standalone: `npm.cmd test -- --watch=false` PASS, com 31 testes em 12 arquivos, incluindo Finance, interceptor, sessão, menu por capacidade e evento financeiro redigido.
- Build frontend SSR: PASS, 9 rotas prerenderizadas e quatro warnings de budget SCSS.
- Dependências frontend: a baseline de 2026-08-21 registrou 28 ocorrências. Angular 21.2.21 e transitivos compatíveis foram atualizados deliberadamente, sem `npm audit fix`/major; `npm ci` passou no integrado e standalone, e os audits runtime/completo retornam 0 vulnerabilidades.
- PostgreSQL: Flyway V1–V7, constraints estruturais e dados transferidos já foram validados na fase de infraestrutura.
- Paridade final: backend standalone/integrado 84/84 e frontend standalone/integrado 76/76 arquivos comparáveis, ambos PASS em 2026-08-22.
- Docker: Compose renderizado, imagens reconstruídas a partir dos standalones e três serviços `healthy`; portas em loopback, health direto/proxy, login e regressão mínima de autenticação/autorização PASS.

## Matriz de completude

| ID | Funcionalidade | Backend | Frontend | Banco | Testes | Status | Prioridade |
|---|---|---|---|---|---|---|---|
| FCA-AUTH-001 | Login e perfil autenticado | POST /auth/login, GET /auth/me, BCrypt e JWT HS256 implementados em SecurityConfig, AuthController e JwtService. | Login envia credenciais, persiste token e navega ao calendário; login-page.ts:20-43 e auth.service.ts:28-46. | users.password_hash, papel e ativo em V1; e-mail case-insensitive em V7. | Login real dos seis usuários foi validado anteriormente; não há teste automatizado de login/me. | **PARTIALLY_IMPLEMENTED** | P1 |
| FCA-AUTH-002 | Endpoint protegido, JWT inválido/expirado e usuário inativo | Resource Server fixa HS256, valida assinatura/tempo/issuer e confirma `sub` em usuário ativo. | Interceptor same-origin trata 401 uma vez e preserva sessão em 403/500; guard continua apenas como UX. | Flag active persistida; nenhuma denylist/revogação. | Integração cobre missing, malformed, expired, wrong issuer e usuário desativado; frontend cobre 401/403. | **IMPLEMENTED** | P1 |
| FCA-AUTH-003 | Logout e encerramento de sessão | Não existe logout/revogação server-side; JWT permanece válido até expirar. | Logout local e 401 limpam token/usuário e navegam idempotentemente; falhas não-401 preservam a sessão. rememberMe continua ignorado. | Não aplicável ao modelo atual. | Testes cobrem 401 concorrente e preservação em 403/500; revogação server-side permanece fora do modelo CURRENT. | **PARTIALLY_IMPLEMENTED** | P2 |
| FCA-AUTH-004 | Proteção contra abuso e rastreio de autenticação | Sem rate limit/lockout e sem auditoria de login, falha ou logout. | Mensagem de credencial inválida não enumera usuário. | Audit log não recebe eventos de autenticação. | Nenhum teste de abuso. | **NOT_IMPLEMENTED** | P1 |
| FCA-USER-001 | Listar, criar, editar, ativar, desativar e atribuir papel | Endpoints ADMIN-only e autoproteção implementados em UserService:38-119; UserResponse não expõe hash. | UserService só cria/edita e não lista; user.service.ts:14-20. | V1/V5/V7 suportam identidade, papel, ativo, autoria e unicidade. | Checklist manual; nenhuma automação de autorização/validação. | **PARTIALLY_IMPLEMENTED** | P2 |
| FCA-USER-002 | Tela /admin/users | API backend disponível. | Rota existe, mas o componente é scaffold users-page works!; não há loading, empty, mensagens nem CRUD. | Estrutura disponível. | Apenas teste should create. | **NOT_IMPLEMENTED** | P2 |
| FCA-USER-003 | Validação administrativa de usuário | Bean Validation cobre blank, e-mail, senha mínima e papel; faltam limites coerentes para todos os campos e política de senha completa; CreateUserRequest:8-22. | Não há formulário funcional. | Limites de coluna podem rejeitar entrada longa de forma tardia. | Sem testes negativos automatizados. | **PARTIALLY_IMPLEMENTED** | P2 |
| FCA-CAL-001 | Listagem e visibilidade de calendários | Não-admin recebe somente vínculos; ADMIN recebe todos; resposta contém memberRole e canCreateEvents; CalendarService:66-80. | Calendários são selecionáveis, coloridos e combinados no FullCalendar; calendar-page.ts:86-166. | Calendários, owner e vínculo único em V2. | Validação manual anterior; sem matriz automatizada de papéis. | **PARTIALLY_IMPLEMENTED** | P2 |
| FCA-CAL-002 | Criação de calendário | Endpoint existe, restrito a ADMIN global; criador vira owner/ADMIN e há auditoria. | CalendarService.create existe, mas não há fluxo/tela. | V2/V5 persistem owner e autoria. | Sem teste automatizado. | **PARTIALLY_IMPLEMENTED** | P2 |
| FCA-CAL-003 | Separar visibilidade de permissão de criação | Backend calcula capacidade; ADMIN/EDITOR criam, FINANCE/VIEWER não; AuthorizationService:80-90. | Botão e seletor usam canCreateEvents; calendar-page.ts:157-161,439-447. | Papel contextual persistido. | Sem matriz automatizada completa. | **PARTIALLY_IMPLEMENTED** | P1 |
| FCA-MEMBER-001 | Listar membros | API valida visibilidade e ordena membros; CalendarService:103-109. | /members lista por calendário com loading e empty básicos. | V2 garante vínculo único e FKs. | Um teste frontend cobre carga básica; nenhum teste backend. | **PARTIALLY_IMPLEMENTED** | P2 |
| FCA-MEMBER-002 | Adicionar, alterar papel e remover membro | CRUD, filtro de memberId pelo calendário e auditoria implementados; CalendarService:82-169. | Fluxos conectados; ações só aparecem para global/calendar ADMIN. | V2/V4/V5 suportam papéis e autoria. | Integração cobre `memberId` de outro calendário e a proteção do owner; CRUD, matriz completa de papéis e demais 403 ainda não possuem cobertura automatizada. | **PARTIALLY_IMPLEMENTED** | P2 |
| FCA-MEMBER-003 | Preservar autoridade do owner | DELETE bloqueia remoção e POST/PUT rejeitam downgrade via `ensureOwnerRemainsAdmin`. | UI oculta mudança/remoção do owner. | Não há constraint DB equivalente; serviço preserva a invariável. | Integração cobre update e upsert do owner. | **IMPLEMENTED** | P1 |
| FCA-EVT-001 | Mês, semana, dia, intervalo e múltiplos calendários | API lista por sobreposição de intervalo e visibilidade. | FullCalendar suporta as três visões, período, múltipla seleção, cores, legenda e filtro de tipo. | Eventos possuem início/fim e FK de calendário em V2. | Apenas smoke test da página. | **PARTIALLY_IMPLEMENTED** | P2 |
| FCA-EVT-002 | Busca global de eventos visíveis | Busca limita termo/quantidade, exclui cancelados e respeita calendários visíveis. | Debounce, loading/error/empty e navegação existem; resposta anterior pode aparecer até o próximo debounce; app-shell.ts:73-97,162-184. | Consulta usa eventos/calendários persistidos. | Regressão API manual; sem automação frontend/backend. | **PARTIALLY_IMPLEMENTED** | P2 |
| FCA-EVT-003 | Evento CLIENT | Backend exige cliente, serviço, valor não negativo e período; cria SCHEDULED/PENDING. | CRUD e detalhe existem, mas UI não exige workDescription e depende do 400 backend; calendar-page.ts:64-76,519-621. | Campos, valor e checks em V2/V3. | Sem matriz CLIENT automatizada. | **PARTIALLY_IMPLEMENTED** | P2 |
| FCA-EVT-004 | Evento PERSONAL e autoria própria | CURRENT exige personName, mas aceita texto arbitrário e criação comum em calendário de terceiro. | Formulário permite qualquer personName; não há identidade estruturada do responsável. | person_name é texto, sem FK de responsável. | Sem teste; Q-001/Q-002 abertas. | **SPEC_CONFLICT** | P1 |
| FCA-EVT-005 | Criar SHARED e solicitar consentimento | Exige outro usuário ativo e membro; nasce PENDING_APPROVAL. | Formulário/detalhe existem; UI só valida e-mail não vazio, deixando self/member/active ao backend. | FKs de alvo/aprovador em V2. | Checklist manual; sem automação negativa. | **PARTIALLY_IMPLEMENTED** | P1 |
| FCA-EVT-006 | Editar SHARED e reabrir aprovação | CURRENT permite calendar ADMIN, autor EDITOR e alvo SHARED com capacidade de criação; edição recalcula PENDING. A política correta de atores/campos/transições permanece na Q-004 e no SEC-FIND-017. | canEditEvent espelha CURRENT e formulário edita todos os campos; calendar-page.ts:474-621,859-892. | Estado e atores persistidos. | Sem matriz automatizada; Q-004 aberta. | **NEEDS_DECISION** | P1 |
| FCA-EVT-007 | Cancelar preservando histórico | DELETE transiciona para CANCELLED, audita e bloqueia novas mudanças. | UI confirma, recarrega e não oferece edição/pagamento para CANCELLED. | Linha e status preservados. | Teste backend integrado e teste frontend de ação terminal. | **IMPLEMENTED** | P2 |
| FCA-PEND-001 | Listar pendências | ADMIN vê todas; demais veem as destinadas ao próprio e-mail. | Painel e /pending conectados, com refresh; empty também aparece durante loading inicial. | Estado/alvo persistidos. | Integração cobre a fila vazia após revogação do alvo; listagem positiva e visão ADMIN ainda não possuem automação. | **PARTIALLY_IMPLEMENTED** | P2 |
| FCA-PEND-002 | Aprovar e reprovar como alvo | Backend exige status pendente e ator alvo; atualiza status/aprovador e audita. | Painel, detalhe e página validam alvo/status antes de exibir ações. | Status e approved_by persistidos. | Integração cobre ator incorreto e alvo revogado; faltam sucesso, evento já processado e concorrência. | **PARTIALLY_IMPLEMENTED** | P1 |
| FCA-PEND-003 | Revogar decisão ao perder vínculo | Fila exige associação atual e approve/reject revalidam o vínculo do alvo; evento/histórico permanecem. | Backend nega a ação mesmo com UI/cache antigo; frontend não é autoridade. | FK mantém alvo histórico após remover calendar_members. | Integração cobre fila, approve e reject após remoção. | **IMPLEMENTED** | P1 |
| FCA-PAY-001 | Atualizar PENDING, PARTIALLY_PAID, PAID e REFUNDED | Valida CLIENT, precisão e coerência do snapshot; audita. | Formulário calcula defaults, valida, trata erro e só aparece quando o contrato financeiro está presente. | V3 persiste status, método, recebido e data; check impede negativo. | Integração cobre precisão inválida e usa snapshots em fixtures, mas ainda não exercita `updatePayment` em toda a matriz PENDING/PARTIALLY_PAID/PAID/REFUNDED. | **PARTIALLY_IMPLEMENTED** | P1 |
| FCA-PAY-002 | Manter pagamento coerente ao editar tipo/valor | Evento com histórico não-PENDING rejeita mudança de tipo/amount; conversão ainda PENDING limpa snapshot e campos incompatíveis. | UI consome a validação backend e oculta controles sem capacidade. | V3 mantém checks básicos; invariável cross-field é garantida transacionalmente no serviço. | Quatro testes de integridade cobrem bloqueios, edição permitida, conversão e reabertura SHARED. | **IMPLEMENTED** | P0 |
| FCA-PAY-003 | Capacidade para alterar pagamento | CURRENT reutiliza permissão de editar evento. | Botão usa canEditEvent, coerente com CURRENT. | Não aplicável. | Sem teste de papéis financeiros; Q-005 aberta. | **NEEDS_DECISION** | P1 |
| FCA-FIN-001 | Resumo por intervalo customizado | /api/finance/summary calcula expected, received, pending e todas as contagens com autorização. | FinancePage consome CalendarService + FinanceService, seleciona calendário autorizado e renderiza oito métricas/estados. | Query agrega apenas CLIENT não CANCELLED. | Integração valida agregação/intervalo e componente valida request/render/error/empty. | **IMPLEMENTED** | P2 |
| FCA-FIN-002 | Receita DAILY, WEEKLY, BIWEEKLY e MONTHLY | Presets/ranges civis e summary inclusivo implementados. | DAILY/WEEKLY/BIWEEKLY/MONTHLY/CUSTOM calculam datas civis sem conversão UTC. | Agregação usa starts_at. | Componente cobre limites de todos os períodos; backend cobre resumo e período inválido. | **IMPLEMENTED** | P2 |
| FCA-FIN-003 | Minimização de dados financeiros por papel | EventResponse omite os cinco campos sem capacidade; `EventFinancialAccess` preserva capacidades CURRENT e é resolvido uma vez por request/calendar, com cache por `calendarId` nas pendências. | Detalhe, formulário e botão de pagamento dependem da presença do contrato financeiro. | Dados continuam no agregado Event, protegidos na projeção. | Integração testa ausência/presença por papel; unitário verifica resolução única/ownership; componente testa CLIENT redigido. | **IMPLEMENTED** | P1 |
| FCA-FIN-004 | Tela /finance | Contrato de resumo pronto. | Página funcional, responsiva/acessível, com loading/error/empty/no-access/retry; menu contém somente Resumo de receitas e aparece por capacidade. | Receita disponível; despesas continuam fora do modelo. | Sete testes de Finance + teste de navegação por capacidade. | **IMPLEMENTED** | P2 |
| FCA-AUD-001 | Registrar operações relevantes | Eventos, pagamentos, aprovações, membros e usuários geram logs; login/logout não. | Não há visualização funcional. | V6 cria log, índices e snapshots. | Checklist manual; sem automação por operação. | **PARTIALLY_IMPLEMENTED** | P2 |
| FCA-AUD-002 | Consultar auditoria e restringir acesso | ADMIN global consulta tudo; calendar ADMIN consulta com calendarId; filtros básicos/limit implementados. | AuditService.search existe; /audit é scaffold. | Consulta e índices em V6. | Integração cobre 403 para ator sem permissão; sucesso, filtros e contrato da resposta permanecem sem automação. | **PARTIALLY_IMPLEMENTED** | P2 |
| FCA-AUD-003 | Retenção e minimização de snapshots | Snapshots textuais são gravados sem política de retenção/máscara. | Não aplicável enquanto página não existe. | old_value/new_value são TEXT sem retenção automática. | Sem teste contra secrets/dados excessivos; Q-006 aberta. | **NEEDS_DECISION** | P2 |
| FCA-UI-001 | Rotas e navegação por papel/capacidade | Backend permanece autoridade por recurso. | Finance é ocultado sem capacidade e rota direta trata no-access; Users/Audit ainda não possuem guard fino completo. | Não aplicável. | AppShell cobre menu Finance; matriz global de rotas continua pendente. | **PARTIALLY_IMPLEMENTED** | P1 |
| FCA-UI-002 | Erro, loading e empty confiáveis | APIs retornam status coerentes, sem envelope único. | Calendário converte falhas em listas vazias e tem races; membros tem loading/race; pending mostra empty durante loading. | Não aplicável. | Sem testes de estados assíncronos. | **BROKEN** | P1 |
| FCA-UI-003 | Configurações | Não há contrato aprovado. | /settings é scaffold. | Não há modelo. | Apenas teste should create. | **NEEDS_DECISION** | P3 |
| FCA-UI-004 | Conta, convite e tema anunciados | Não há endpoints aprovados para Google, cadastro, reset, convite em tempo real ou tema. | Controles são visuais e sem ação; rememberMe também não altera persistência. | Sem suporte específico. | Sem testes. | **NOT_IMPLEMENTED** | P3 |
| FCA-DATA-001 | Persistência e integridade estrutural | JPA/Flyway e runtime PostgreSQL validados. | Consumo transparente pelas APIs. | V1–V7 cobrem os agregados; faltam invariantes cross-field de pagamento/owner. | Flyway real e persistência validados na fase de infraestrutura. | **PARTIALLY_IMPLEMENTED** | P1 |
| FCA-OPS-001 | Health e stack local | GET /api/health público implementado. | Proxy /api e SSR validados. | PostgreSQL possui healthcheck. | Stack healthy e HTTP 200 validados anteriormente. | **IMPLEMENTED** | P3 |
| FCA-REPO-001 | Paridade multi-repositório | Backend standalone/integrado sem divergência normativa em 84/84 arquivos. | Frontend standalone/integrado sem divergência normativa em 76/76 arquivos. | Não aplicável. | Verificador oficial por caminho relativo e SHA-256 PASS. | **IMPLEMENTED** | P3 |
| FCA-TEST-001 | Cobertura funcional, negativa e de segurança | 16 testes: context/cancelamento, segurança, autorização financeira, Finance e integridade financeira. | 31 testes em 12 arquivos: Finance, auth/interceptor, nav, redação e fluxos anteriores. | PostgreSQL real segue validado; hardening novo usa H2 integrado e ainda pede regressão PostgreSQL/DB privileges. | Matriz negativa crítica aumentou; E2E, CI, auditoria e concorrência permanecem incompletos. | **PARTIALLY_IMPLEMENTED** | P1 |

## Síntese por módulo

- Autenticação: JWT/issuer/usuário ativo e 401/403 foram endurecidos e testados; rate limit, telemetria e estratégia de revogação permanecem.
- Calendário e eventos: principal UI operacional; confiabilidade assíncrona, validações e decisões de autoria/consentimento impedem completude.
- Membros: CRUD e invariável do owner operacionais; corrida de estado da página ainda é dívida.
- Pagamentos: snapshot e edição posterior protegidos; Q-005 continua aberta para a política futura de capacidade.
- Financeiro: cálculo, minimização de contrato e página de resumo de receitas estão implementados e testados.
- Usuários e auditoria: backend presente e páginas ausentes.
- Settings: sem requisito aprovado; não deve ser inventado.

## Gates para continuar features

1. Gate multi-repositório concluído: FCA-PAY-002, FCA-MEMBER-003, FCA-PEND-003 e SEC-FIND-001/002 possuem regressão; S0 = 0 e S1 = 0.
2. Finance foi entregue como primeira unidade funcional no escopo de receitas.
3. Paridade e regressão dos standalones foram repetidas; antes de release produtivo ainda são necessários os hardenings S2/S3, CI/E2E e os gates de ambiente alvo.
4. Continuar FCA-UI-002, E2E/CI, S2/S3 e funcionalidades Users/Audit sem reabrir S0/S1.

## Limites e decisões abertas

- Q-001/Q-002: agenda própria e identidade responsável.
- Q-003: alcance do bypass ADMIN.
- Q-004: edição e reaprovação de SHARED.
- Q-005: capacidade para alterar pagamento.
- Q-006: retenção e minimização de auditoria.

Essas questões não autorizam preservar comportamento inseguro: consentimento, minimização de dados, integridade financeira e tratamento de sessão podem ser endurecidos sem inventar o modelo de produto pendente.
