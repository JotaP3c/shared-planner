# 31 — Security Audit Report

## 1. Sumário executivo

Auditoria defensiva realizada em 2026-08-22 sobre:

- C:\git\shared-planner;
- C:\git\shared-planner-backend;
- C:\git\shared-planner-frontend.

Resultado:

| Prioridade | Severidade | Abertos após validação multi-repositório | Situação |
|---|---|---:|---|
| S0 | CRITICAL | 0 | atendido |
| S1 | HIGH | 0 | 2 achados encerrados e revalidados nos standalones |
| S2 | MEDIUM | 9 | 2 encerrados; riscos restantes no backlog prioritário |
| S3 | LOW | 4 | hardening; 2 parcialmente mitigados |
| S4 | INFORMATIONAL | controles positivos abaixo | acompanhar |

Os dois S1 da baseline — exposição de dados financeiros em respostas de evento e ausência de revogação das pendências SHARED após a remoção do alvo — foram corrigidos no monorepo, sincronizados e revalidados nos dois standalones. A política de edição ampla do alvo é um risco separado, classificado como S2/NEEDS_DECISION porque depende da Q-004. O gate para continuar a próxima feature foi atendido (`S0 = 0`, `S1 = 0`), mas os riscos S2/S3 mantêm o projeto em postura NEEDS HARDENING e não pronto para produção.

## 2. Método e limitações

Foram inspecionados código, DTOs, controllers, serviços, repositories, migrations, Dockerfiles, Compose, arquivos de configuração, lockfile, Git, documentação SDD e testes existentes.

Validações read-only:

- três worktrees limpos e alinhados com origin/main no início da auditoria;
- remotes públicos confirmados;
- sync oficial final PASS: backend 84/84 e frontend 76/76;
- docker compose config --quiet: PASS;
- .env ignorado e não presente no histórico;
- scan histórico de padrões de alta confiança sem private keys/tokens encontrados;
- lockfile npm v3, 611 entradas, integridade presente e URLs HTTPS do registry oficial.

Baseline de dependências fornecida pela execução coordenada:

- npm audit total: 28 ocorrências;
- uma critical somente em dependência de desenvolvimento;
- runtime: nove ocorrências, sendo sete high, uma moderate e uma low.

Severidade do advisory não equivale automaticamente ao risco explorável da aplicação. Após triagem e atualização deliberada dentro da linha Angular 21.2.21, sem `npm audit fix` e sem major, `npm ci` instalou 505 pacotes e tanto `npm audit --omit=dev` quanto o audit completo retornaram 0 vulnerabilidades.

Na validação posterior das correções integradas, a suíte backend passou com 16 testes, a suíte frontend com 31 testes em 12 arquivos e o build frontend com 9 rotas prerenderizadas e 4 avisos de budget CSS. Não houve teste ofensivo, fuzzing, exposição de valores secretos nem validação produtiva; a execução não substitui os gates S2/S3.

## 3. Inventário de exposição das APIs

Foram revisadas as 25 operações públicas declaradas pelos oito controllers. A coluna “Exposto?” distingue a baseline do contrato validado nos três repositórios em 2026-08-22.

| Endpoint | Campo | Sensibilidade | Necessário? | Exposto? | Ação |
|---|---|---|---|---|---|
| GET `/api/health` | estado mínimo | PUBLIC | sim | sim | manter sem versão, banco ou ambiente |
| POST `/api/auth/login` request | `email`, `password` | PERSONAL_DATA / AUTHENTICATION_SECRET | sim | entrada somente | exigir TLS produtivo; nunca logar |
| POST `/api/auth/login` response | `accessToken`, `tokenType` | AUTHENTICATION_SECRET / INTERNAL | sim | sim ao autenticado | não persistir em log/URL; revisar estratégia de storage |
| GET `/api/auth/me` | `id`, `fullName`, `email`, `role`, `active`, timestamps | INTERNAL / PERSONAL_DATA | sim para a própria sessão | sim | contract test sem senha/hash |
| GET/POST/PUT `/api/users` | ID, nome, e-mail, role, active, timestamps | INTERNAL / PERSONAL_DATA | sim para ADMIN | sim | manter ADMIN-only; senha/hash nunca na resposta |
| POST `/api/users` request | `password` | AUTHENTICATION_SECRET | sim | entrada somente | BCrypt; limites; nunca auditar valor/hash |
| GET/POST `/api/calendars` | ID, nome, `ownerEmail`, memberRole/capacidade | INTERNAL / PERSONAL_DATA | sim ao ator autorizado | sim | manter filtragem por vínculo; revisar minimização de ownerEmail |
| GET/POST/PUT/DELETE `/api/calendars/{id}/members` | IDs, e-mail, nome, role, createdAt | INTERNAL / PERSONAL_DATA | sim para gestão; leitura ampla deve ser justificada | sim a membro visível | manter BOLA; considerar projeção mínima para não-admin |
| GET/POST/PUT `/api/events` e GET `/api/events/{id}` | IDs/e-mails de atores, título, nomes, descrições e horários | INTERNAL / PERSONAL_DATA | sim ao membro visível | sim | manter autorização por recurso e minimização por uso |
| mesmos endpoints de evento | `amount`, `paymentStatus`, `paymentMethod`, `receivedAmount`, `paidAt` | FINANCIAL_DATA | somente capacidade financeira/pagamento | baseline: sim para qualquer membro; integrado: omitidos sem capacidade | SEC-FIND-001 encerrado com projeção e contract test |
| GET `/api/events/search` | IDs, calendário, atores, título, nomes e horários | INTERNAL / PERSONAL_DATA | parcialmente, para navegação | sim ao membro visível | revisar e remover campos sem consumidor legítimo |
| GET `/api/events/pending-approvals` | evento e alvo | PERSONAL_DATA; FINANCIAL_DATA se aplicável | sim ao alvo atual; ADMIN global | integrado revalida membership atual e aplica redação | SEC-FIND-002 encerrado; manter regressão |
| POST `/api/events/{id}/approve|reject` | `EventResponse` | PERSONAL_DATA / FINANCIAL_DATA | sim ao alvo atual | integrado revalida membership antes da decisão | SEC-FIND-002 encerrado; manter regressão |
| PUT `/api/events/{id}/payment` | status, método, recebido e data | FINANCIAL_DATA | sim à capacidade de pagamento aprovada | sim ao editor CURRENT | Q-005; manter autorização backend e auditoria |
| GET `/api/events/client-revenue` | total e quantidade por período | FINANCIAL_DATA | sim ao financeiro | sim somente autorizado | manter BR-FIN-003 e teste 403 |
| GET `/api/finance/summary` | esperado, recebido, pendente e contagens | FINANCIAL_DATA | sim ao financeiro | sim somente autorizado | manter BR-FIN-003 e teste 403/contrato |
| GET `/api/audit-logs` | IDs, ator, resumo, old/new e timestamp | AUDIT_DATA / PERSONAL_DATA / FINANCIAL_DATA | sim ao administrador autorizado | sim | Q-006: retenção, máscara e projeção mínima |
| respostas de erro | status/detail e metadata HTTP | INTERNAL | mensagem controlada | sem stack por default observado | padronizar envelope e testar 400/401/403/404/500 |

Mass assignment: nenhum controller aceita entidade JPA diretamente. Requests são DTOs allowlist; `createdBy`, owner, `approvedBy` e campos de auditoria não são controlados diretamente pelo cliente. `role`, `eventType` e pagamento são aceitos somente em DTOs específicos, mas dependem das autorizações e invariantes documentadas.

## 4. Escala

- S0 CRITICAL: exploração provável com impacto catastrófico ou comprometimento sistêmico imediato.
- S1 HIGH: quebra relevante de autorização, confidencialidade ou integridade que deve ser encerrada antes de features comuns.
- S2 MEDIUM: risco real com precondições adicionais ou impacto limitado.
- S3 LOW: hardening, defesa em profundidade ou risco operacional restrito.
- S4 INFORMATIONAL: controle positivo, observação ou risco aceito documentado.

## 5. Findings

### SEC-FIND-001

**Title:** Dados financeiros expostos a membros sem capacidade financeira

**Severity:** S1 HIGH

**OWASP:** A01 Broken Access Control

**Affected component:** backend de eventos e contratos REST

**Evidence:**

- backend/src/main/java/com/sharedplanner/config/AuthorizationService.java:30-36
- backend/src/main/java/com/sharedplanner/event/EventService.java:115-122
- backend/src/main/java/com/sharedplanner/event/EventService.java:214-218
- backend/src/main/java/com/sharedplanner/event/EventResponse.java:20-24
- backend/src/main/java/com/sharedplanner/calendar/CalendarMemberRole.java:25-27

**Expected security control:** campos FINANCIAL_DATA devem ser retornados somente a usuários com capacidade financeira explicitamente autorizada.

**Baseline behavior:** qualquer membro que pudesse visualizar o calendário, inclusive VIEWER e EDITOR, recebia amount, paymentStatus, paymentMethod, receivedAmount e paidAt no EventResponse.

**Remediação validada:** o integrado resolve `AuthorizationService.EventFinancialAccess` uma vez por request/calendar, usa cache por `calendarId` nas pendências, projeta `EventResponse` por ator e omite os cinco campos quando não há capacidade. Isso evita o N+1 introduzido por uma checagem por evento. O frontend trata a ausência como redação e também omite o bloco e os controles de pagamento.

**Risk:** exposição de receita, recebimentos e método de pagamento a usuários sem autorização financeira.

**Exploit precondition:** atacante autenticado e membro visível do calendário; não precisa possuir papel FINANCE.

**Recommended remediation:** definir autorização de campo; usar DTO sanitizado para membros sem capacidade financeira ou endpoint financeiro separado. Não confiar em ocultação no frontend.

**Test:** chamar lista e detalhe como VIEWER/EDITOR e confirmar ausência de valores financeiros; repetir como Calendar ADMIN/FINANCE e confirmar dados necessários.

**Status:** CLOSED — integrado e standalones validados em 2026-08-22; regressão backend/frontend PASS e paridade 84/84, 76/76.

### SEC-FIND-002

**Title:** Ex-membro continua listando e decidindo pendência SHARED

**Severity:** S1 HIGH

**OWASP:** A01 Broken Access Control

**Affected component:** autorização e fila de eventos SHARED

**Evidence:**

- backend/src/main/java/com/sharedplanner/event/EventService.java — `listPendingApprovals` e `ensureApprovalTarget`
- backend/src/main/java/com/sharedplanner/calendar/CalendarService.java — `removeMember`
- backend/src/main/java/com/sharedplanner/calendar/CalendarMemberRepository.java
- docs/sdd/08-shared-event-spec.md
- docs/sdd/29-security-spec.md — `SEC-AUTHZ-007`

**Expected security control:** somente o alvo que permanece usuário ativo e membro atual do calendário pode listar, aprovar ou rejeitar a pendência. A remoção do vínculo deve revogar o acesso imediatamente.

**Baseline behavior:** a fila não administrativa filtrava apenas `approvalRequestedFrom.email`; approve/reject conferiam somente status e e-mail do alvo.

**Remediação validada:** a consulta da fila exige membership atual e approve/reject revalidam o vínculo antes de alterar o evento. A remoção preserva evento/histórico, mas revoga listagem e decisão.

**Risk:** uma autorização explicitamente revogada continua permitindo acesso à pendência e uma decisão que altera o estado do evento.

**Exploit precondition:** usuário autenticado era o alvo de um SHARED pendente e foi removido do calendário antes de decidir.

**Recommended remediation:** filtrar a fila pela associação atual e revalidar o vínculo de calendário em approve/reject, preservando o evento e o histórico. A política para cancelar ou reatribuir a pendência continua sendo decisão de produto separada.

**Test:** remover o alvo do calendário, confirmar que o item desaparece da fila e que approve/reject são negados sem alterar o status.

**Status:** CLOSED — integrado e standalones validados em 2026-08-22; teste negativo de remoção seguido de listagem/approve/reject PASS. Q-004 permanece separada.

### SEC-FIND-003

**Title:** Credenciais públicas de desenvolvimento combinadas com portas publicadas amplamente

**Severity:** S2 MEDIUM

**OWASP:** A05 Security Misconfiguration / A07 Authentication Failures

**Affected component:** Docker Compose, seeds e acesso local

**Evidence:**

- compose.yaml:11-12
- compose.yaml:35-36
- compose.yaml:57-58
- docs/sdd/27-local-access-and-test-credentials-spec.md:5-19
- docs/database/seed-dev-data.sql:25-73
- docs/database/seed-malu-jotape.sql:29-49

**Expected security control:** credenciais previsíveis devem existir somente em ambiente local isolado; portas locais devem usar loopback quando acesso externo não é requerido.

**Baseline behavior:** frontend, backend e PostgreSQL eram publicados sem endereço de bind explícito. Usuários/hashes de seed e a credencial local correspondente são públicos por design.

**Remediação parcial validada:** `compose.yaml` publica os três serviços em `${BIND_ADDRESS:-127.0.0.1}`. A exposição acidental à LAN foi reduzida, mas seeds previsíveis, alteração manual do bind e a separação de perfil ainda exigem controle.

**Risk:** acesso por outro host da rede a contas de desenvolvimento conhecidas; exposição de PII de fixtures.

**Exploit precondition:** stack em execução, porta alcançável pela rede e seed ainda ativo.

**Recommended remediation restante:** separar perfil seed, impedir seed em ambiente compartilhado, usar identidades fictícias e exigir rotação antes de qualquer exposição. Manter loopback como default.

**Test:** de outro host, portas locais não são alcançáveis; profile de produção não cria usuários de seed; credencial pública não autentica fora do ambiente local aprovado.

**Status:** PARTIALLY MITIGATED — S2 OPEN

### SEC-FIND-004

**Title:** Segredo JWT público no perfil de desenvolvimento

**Severity:** S2 MEDIUM

**OWASP:** A02 Cryptographic Failures / A05 Security Misconfiguration

**Affected component:** backend profile dev e autenticação JWT

**Evidence:**

- backend/src/main/resources/application-dev.properties:13
- backend/src/main/java/com/sharedplanner/config/SecurityConfig.java:61-72
- backend/src/main/java/com/sharedplanner/auth/JwtService.java:38-48

**Expected security control:** segredo de assinatura deve ser imprevisível, externo ao Git e único por ambiente.

**Baseline behavior:** o perfil dev possuía fallback versionado e conhecido.

**Remediação validada:** o fallback foi removido de `application-dev.properties`; `JwtProperties` exige secret externo não vazio, com mínimo de 32 caracteres, e duração positiva. O decoder valida o issuer `shared-planner-api`.

**Risk:** se o backend dev estiver acessível, alguém que conheça o fallback pode forjar bearer token para a identidade de usuário ativo.

**Exploit precondition:** profile dev ativo, fallback não substituído, porta alcançável e e-mail de usuário ativo conhecido.

**Recommended hardening restante:** usar secret store e rotação por ambiente; rejeitar valores conhecidos/placeholder além do mínimo estrutural; manter somente valor específico de teste no profile test.

**Test:** aplicação dev sem segredo externo falha de forma segura ou gera segredo efêmero não reutilizado; token assinado com o antigo fallback é rejeitado.

**Status:** CLOSED — fallback conhecido removido e revalidado nos três repositórios em 2026-08-22. Rotação/secret store permanecem requisitos gerais, sem reabrir este finding específico.

### SEC-FIND-005

**Title:** Vulnerabilidades npm runtime exigem triagem e remediação controlada

**Severity:** S2 MEDIUM

**OWASP:** A06 Vulnerable and Outdated Components

**Affected component:** frontend Angular SSR e dependências transitivas

**Evidence:**

- frontend/package.json:14-41
- frontend/package-lock.json
- baseline npm audit: 28 total; uma critical dev-only; runtime nove, com sete high, uma moderate e uma low
- docs/sdd/21-development-progress.md:47-50

**Expected security control:** nenhuma vulnerabilidade runtime alta alcançável sem mitigação ou risco aceito; updates devem preservar regressão.

**Baseline behavior:** havia 28 ocorrências no audit completo e nove no conjunto runtime.

**Remediação validada:** dependências runtime/SSR/build/CLI/compiler-cli foram atualizadas deliberadamente para Angular 21.2.21 e transitivos compatíveis, sem `npm audit fix` e sem major. `npm ci` PASS com 505 pacotes; `npm audit --omit=dev` e o audit completo retornam 0 vulnerabilidades.

**Risk:** uma dependência SSR/runtime vulnerável pode afetar disponibilidade, confidencialidade ou integridade conforme advisory e caminho executado.

**Exploit precondition:** depende da vulnerabilidade, da versão empacotada e da alcançabilidade no fluxo SSR/Express.

**Recommended maintenance:** manter lockfile, auditoria recorrente e atualização revisada; nunca executar `audit fix --force` automaticamente.

**Test:** npm audit de produção sem high/critical não aceitos; build SSR, testes e regressão do proxy após cada atualização.

**Status:** CLOSED — integrado e standalone validados em 2026-08-22; audit runtime e completo = 0, com testes/build preservados.

### SEC-FIND-006

**Title:** Runtime reutiliza o superuser de bootstrap PostgreSQL

**Severity:** S2 MEDIUM

**OWASP:** A05 Security Misconfiguration

**Affected component:** PostgreSQL e datasource backend

**Evidence:**

- compose.yaml:8-10
- compose.yaml:30-32
- ausência de migration/grants para papel de aplicação separado

**Expected security control:** papel de runtime deve possuir somente CONNECT/USAGE e DML necessárias; migration/bootstrap deve ser separado.

**Current behavior:** POSTGRES_USER cria o superuser de bootstrap na imagem oficial e a mesma identidade é injetada em SPRING_DATASOURCE_USERNAME. Não há papel de runtime segregado nem evidência de privilégio mínimo.

**Risk:** comprometimento do backend amplia impacto sobre schema, dados e usuários do banco.

**Exploit precondition:** execução arbitrária ou extração da credencial no backend/container.

**Recommended remediation:** criar papel owner/migration e papel runtime; revogar CREATE/DROP e privilégios desnecessários; manter PostgreSQL fora de rede pública.

**Test:** runtime executa funcionalidades normais, mas falha ao criar/drop table, alterar roles ou acessar bancos não autorizados; Flyway usa credencial apropriada.

**Status:** OPEN

### SEC-FIND-007

**Title:** Bearer JWT persistido em localStorage

**Severity:** S2 MEDIUM

**OWASP:** A02 Cryptographic Failures

**Affected component:** frontend authentication

**Evidence:**

- frontend/src/app/core/auth/auth.service.ts:23
- frontend/src/app/core/auth/auth.service.ts:54-72
- frontend/src/app/core/auth/auth.interceptor.ts:16-27

**Expected security control:** token deve ficar inacessível ao código injetado ou o risco XSS deve ser reduzido por controles fortes e validade mínima.

**Current behavior:** JWT permanece no localStorage e é lido pelo JavaScript para compor Authorization.

**Risk:** qualquer XSS executado na origem pode exfiltrar e reutilizar o token.

**Exploit precondition:** execução de JavaScript não confiável na origem ou extensão comprometida. Nenhum sink Angular perigoso foi encontrado nesta revisão.

**Recommended remediation:** decisão arquitetural entre token apenas em memória/renovação ou cookie HttpOnly Secure SameSite; se cookie for escolhido, redesenhar CSRF. Aplicar CSP e reduzir lifetime.

**Test:** teste de logout/expiração; CSP bloqueia script não autorizado; estratégia selecionada não expõe token a código de página ou introduz CSRF.

**Status:** NEEDS_DECISION

### SEC-FIND-008

**Title:** Headers de segurança e requisito TLS não aplicados no frontend SSR

**Severity:** S2 MEDIUM

**OWASP:** A02 Cryptographic Failures / A05 Security Misconfiguration

**Affected component:** Express SSR e deploy

**Evidence:**

- frontend/src/server.ts:15-63
- compose.yaml:57-58
- ausência de CSP, frame-ancestors, Referrer-Policy e Permissions-Policy explícitos

**Expected security control:** HTTPS obrigatório em produção e headers coerentes com os assets/SSR; HSTS somente sob TLS.

**Current behavior:** HTTP é apropriado ao desenvolvimento local, mas não existe enforcement produtivo nem política explícita no Express.

**Risk:** interceptação em produção, clickjacking, maior impacto de XSS e vazamento por referrer.

**Exploit precondition:** deploy sem reverse proxy seguro ou resposta SSR acessível sem headers.

**Recommended remediation:** definir terminação TLS, redirect HTTP→HTTPS e headers por ambiente; começar CSP em report-only e ajustar sources reais.

**Test:** inspeção automatizada de headers em produção/staging; HTTP redireciona; CSP não quebra SSR/assets; HSTS ausente no HTTP local e presente somente no HTTPS.

**Status:** OPEN

### SEC-FIND-009

**Title:** Login sem rate limit, lockout ou telemetria de falhas

**Severity:** S2 MEDIUM

**OWASP:** A07 Identification and Authentication Failures / A09 Logging and Monitoring Failures

**Affected component:** POST /api/auth/login

**Evidence:**

- backend/src/main/java/com/sharedplanner/config/SecurityConfig.java:35-37
- backend/src/main/java/com/sharedplanner/auth/AuthController.java:22-30
- backend/src/main/java/com/sharedplanner/user/CreateUserRequest.java:16-18
- ausência de handler/throttling de autenticação

**Expected security control:** tentativas limitadas por identidade/IP, resposta uniforme, senha adequada e evento de segurança sem segredo.

**Current behavior:** endpoint público autentica sem limitação; senha criada tem mínimo seis e nenhum máximo.

**Risk:** brute force, credential stuffing e consumo de BCrypt.

**Exploit precondition:** endpoint alcançável.

**Recommended remediation:** rate limit com janela/retardo progressivo, política de senha e máximo seguro, monitoramento e proteção contra enumeração.

**Test:** sequência acima do limite retorna 429 sem revelar existência do usuário; senha nunca aparece em logs; recuperação após janela funciona.

**Status:** OPEN

### SEC-FIND-010

**Title:** Audit logs armazenam PII e dados financeiros sem governança de retenção

**Severity:** S2 MEDIUM

**OWASP:** A04 Insecure Design / A09 Logging and Monitoring Failures

**Affected component:** audit_logs e API de auditoria

**Evidence:**

- backend/src/main/java/com/sharedplanner/event/EventService.java:603-621
- backend/src/main/java/com/sharedplanner/audit/AuditService.java:32-51
- backend/src/main/java/com/sharedplanner/audit/AuditLogResponse.java:12-16
- docs/sdd/14-audit-spec.md:14
- docs/sdd/99-open-questions.md:25

**Expected security control:** minimização, retenção, acesso, integridade e descarte definidos por classe de dado.

**Current behavior:** snapshots incluem identidade e valores financeiros; não há prazo, máscara, purge ou imutabilidade em banco. Não foram encontrados senha, JWT ou segredo nos snapshots atuais.

**Risk:** exposição histórica ampla, crescimento indefinido e conflito de privacidade.

**Exploit precondition:** acesso ADMIN à auditoria, comprometimento do banco ou backup.

**Recommended remediation:** decidir retenção; trocar strings por schema mínimo; mascarar campos desnecessários; impedir update/delete pelo papel runtime; auditar acesso/exportação.

**Test:** snapshots nunca contêm segredo; purge respeita prazo e legal hold; usuário sem papel recebe 403; papel runtime não altera linha antiga.

**Status:** NEEDS_DECISION

### SEC-FIND-011

**Title:** ACL local ampla protege insuficientemente .env e código

**Severity:** S2 MEDIUM

**OWASP:** A05 Security Misconfiguration / A08 Software and Data Integrity Failures

**Affected component:** filesystem Windows

**Evidence:**

- ACL observada no workspace e .env: BUILTIN/Usuários com leitura e Usuários autenticados com modificação
- .gitignore:27-29 protege versionamento, não acesso local

**Expected security control:** somente proprietário atual, Administradores e SYSTEM devem ler secrets e alterar código, salvo colaboração local intencional.

**Current behavior:** permissões herdadas permitem leitura e modificação por outras identidades autenticadas da máquina.

**Risk:** leitura de segredos, adulteração de configuração/código e perda de integridade Git.

**Exploit precondition:** acesso a outra conta local autenticada.

**Recommended remediation:** revisar proprietário e herança de C:\git; aplicar ACL mínima ao workspace e mais restrita ao .env; não usar safe.directory como substituto de ACL.

**Test:** usuário local não autorizado não lê/escreve .env nem repositório; usuário atual, Administradores e SYSTEM continuam operacionais.

**Status:** OPEN

### SEC-FIND-012

**Title:** Cobertura e monitoramento de segurança insuficientes

**Severity:** S2 MEDIUM

**OWASP:** A09 Security Logging and Monitoring Failures

**Affected component:** backend tests, frontend tests, CI e observabilidade

**Evidence:**

- backend integrado e standalone: 16 testes, incluindo JWT ausente/inválido/expirado, usuário inativo, BOLA, owner, revogação SHARED, autorização/redação financeira, integridade e Finance
- frontend integrado: 31 testes em 12 arquivos, incluindo interceptor, sessão, redação financeira, navegação e Finance
- ausência de `.github/workflows` nos três repositórios
- ausência de logging seguro de sucesso/falha de autenticação no código

**Expected security control:** matriz negativa automatizada, gate de CI e eventos de segurança úteis sem dados sensíveis.

**Current behavior:** a regressão integrada cobre os negativos de maior prioridade e a auditoria de negócio existe. Ainda faltam execução obrigatória em CI, E2E crítico, concorrência/rate limit e telemetria segura de autenticação/abuso.

**Risk:** regressões de autorização chegam ao main e ataques não são percebidos.

**Exploit precondition:** mudança de código ou tentativa de abuso; não exige comprometimento prévio.

**Recommended remediation restante:** executar as suítes em CI obrigatório, ampliar matrizes por papel/recurso, concorrência e E2E; adicionar logs estruturados de falha/sucesso sem senha, token ou Authorization.

**Test:** suite negativa passa no CI; logs contêm outcome/correlation ID e nunca secret; regra quebrada bloqueia merge.

**Status:** PARTIALLY MITIGATED — S2 OPEN

### SEC-FIND-013

**Title:** Limites de input e validação JWT incompletos

**Severity:** S3 LOW

**OWASP:** A05 Security Misconfiguration / A07 Authentication Failures

**Affected component:** DTOs e JwtProperties

**Evidence:**

- backend/src/main/java/com/sharedplanner/auth/LoginRequest.java:8-13
- backend/src/main/java/com/sharedplanner/user/CreateUserRequest.java:9-18
- backend/src/main/java/com/sharedplanner/event/CreateEventRequest.java:30-44
- backend/src/main/java/com/sharedplanner/event/UpdatePaymentRequest.java:15-16
- backend/src/main/java/com/sharedplanner/auth/JwtProperties.java:5-8

**Expected security control:** limites coerentes com DB/domínio e configuração JWT validada fail-fast.

**Baseline behavior:** login/nome/e-mail/descrições possuíam máximos incompletos; `receivedAmount` não tinha `@Digits`; segredo, issuer e duração JWT não possuíam validação explícita.

**Remediação parcial validada:** `receivedAmount` recebeu precisão/escala; `JwtProperties` valida segredo mínimo e duração positiva; o decoder valida issuer. Limites de texto/body e a decisão/validação de audience continuam pendentes.

**Risk:** erros 500/DB, consumo desnecessário e configuração criptográfica fraca por acidente.

**Exploit precondition:** payload extremo ou configuração inválida.

**Recommended remediation restante:** completar `@Size` e body limit, uniformizar `ProblemDetail`, decidir audience e manter boundary tests.

**Test:** boundary tests retornam 400; configuração inválida impede startup; token com issuer errado é rejeitado.

**Status:** PARTIALLY MITIGATED — S3 OPEN

### SEC-FIND-014

**Title:** Supply chain não fixa todos os artefatos nem possui gate automatizado

**Severity:** S3 LOW

**OWASP:** A08 Software and Data Integrity Failures

**Affected component:** Docker, Maven Wrapper e Git

**Evidence:**

- compose.yaml:5
- backend/Dockerfile:1,8
- frontend/Dockerfile:1,8
- backend/.mvn/wrapper/maven-wrapper.properties:1-3
- ausência de distributionSha256Sum e de automação Dependabot/Renovate

**Expected security control:** builds reproduzíveis, origem validada, atualização revisada e artefatos rastreáveis.

**Current behavior:** npm usa lock/integrity e HTTPS, mas imagens usam tags mutáveis, Maven Wrapper não fixa checksum e não há CI de dependências.

**Risk:** mudança inesperada ou comprometimento de artefato consumido no build.

**Exploit precondition:** registry/upstream comprometido, tag alterada ou download adulterado.

**Recommended remediation:** registrar digests, adicionar checksum Maven, gerar SBOM, habilitar updates revisados e scan em CI. Manter atualização periódica para não congelar CVEs.

**Test:** build falha com checksum/digest divergente; SBOM corresponde à imagem; PR de dependência executa testes.

**Status:** OPEN

### SEC-FIND-015

**Title:** Invariantes financeiras e recuperação do PostgreSQL são incompletas

**Severity:** S3 LOW

**OWASP:** A04 Insecure Design / A05 Security Misconfiguration

**Affected component:** migrations e operação PostgreSQL

**Evidence:**

- backend/src/main/resources/db/migration/V1__create_users_table.sql:4
- backend/src/main/resources/db/migration/V2__create_calendar_event_tables.sql:20-31
- backend/src/main/resources/db/migration/V3__add_payment_fields_to_events.sql:2-6
- README.md:295

**Expected security control:** invariantes críticas em profundidade e backup/restore testados.

**Baseline behavior:** existiam PK/FK, período e mínimos monetários; enums, `receivedAmount <= amount` e combinações de pagamento dependiam da aplicação. O volume persistente não possuía procedimento de backup.

**Remediação parcial validada:** o serviço rejeita alteração de tipo/amount após sair de PENDING, normaliza campos incompatíveis e valida a precisão de `receivedAmount`; regressões de integridade passam. Constraints equivalentes no banco e procedimento de backup/restore continuam ausentes.

**Risk:** import/acesso direto pode produzir estado inválido; falha de volume pode causar perda de dados.

**Exploit precondition:** acesso DB/migration, bug de aplicação ou falha operacional.

**Recommended remediation:** novas migrations para CHECKs aprovados; nunca reescrever V1–V7; definir pg_dump, proteção, retenção e restore drill.

**Test:** DB rejeita enums/valores inconsistentes; restore em banco vazio preserva contagens, FKs, Flyway e autenticação.

**Status:** PARTIALLY MITIGATED — S3 OPEN

### SEC-FIND-016

**Title:** Proxy SSR manual carece de limites e política explícita de headers

**Severity:** S3 LOW

**OWASP:** A05 Security Misconfiguration

**Affected component:** frontend/src/server.ts

**Evidence:**

- frontend/src/server.ts:18-39

**Expected security control:** proxy deve limitar tempo/body, filtrar hop-by-hop headers e produzir erro genérico.

**Current behavior:** target vem de variável operacional, portanto não há SSRF user-controlled confirmado; entretanto headers de request/response são copiados e não existe timeout explícito.

**Risk:** conexão pendurada, consumo de recursos ou comportamento inesperado com headers.

**Exploit precondition:** cliente alcança o frontend e provoca resposta/conexão anômala; backend permanece destino confiável.

**Recommended remediation:** usar proxy mantido ou implementar allowlist de protocolo/host, timeout, abort, body cap e remoção de hop-by-hop headers.

**Test:** timeout encerra request; payload acima do limite é rejeitado; headers Connection/Transfer-Encoding não são propagados indevidamente; BACKEND_URL inválido falha no startup.

**Status:** OPEN

### SEC-FIND-017

**Title:** Política de edição ampla do alvo SHARED não está definida

**Severity:** S2 MEDIUM

**OWASP:** A01 Broken Access Control / A04 Insecure Design

**Affected component:** autorização e máquina de estados de eventos SHARED

**Evidence:**

- backend/src/main/java/com/sharedplanner/config/AuthorizationService.java — `ensureCanEditEvent`
- backend/src/main/java/com/sharedplanner/event/EventService.java — `update` e `approvalUserForUpdate`
- docs/sdd/08-shared-event-spec.md
- docs/sdd/99-open-questions.md — Q-004

**Expected security control:** atores, campos editáveis e transições que exigem nova aprovação devem ser definidos explicitamente antes de restringir ou ampliar a política.

**Current behavior:** o alvo SHARED com papel Calendar ADMIN ou EDITOR pode usar o update genérico para alterar integralmente evento criado por terceiro, inclusive tipo e destinatário. A Q-004 registra que o comportamento correto ainda não foi aprovado.

**Risk:** quebra de expectativa de autoria e consentimento, com possível alteração material do compromisso por um ator cujo poder não está claro.

**Exploit precondition:** usuário autenticado é `approvalRequestedFrom` e possui papel que pode criar eventos no calendário.

**Recommended remediation:** resolver Q-004 e então implementar allowlist de atores/campos/transições, reaprovação material e controle de concorrência. Até lá, não ampliar silenciosamente a permissão CURRENT.

**Test:** matriz aprovada de criador, alvo, Calendar ADMIN e Global ADMIN em cada estado; alterações materiais reabrem consentimento conforme a decisão.

**Status:** NEEDS_DECISION

## 6. Controles positivos

- BCrypt é usado para persistência de senha.
- UserResponse não retorna password ou passwordHash.
- Controllers aceitam DTOs, não entidades JPA diretamente.
- JWT fixa HS256, valida issuer/expiração/usuário ativo e exige configuração mínima de segredo/duração.
- CSRF desabilitado é coerente com bearer explícito atual; deve ser revisto se houver cookie.
- CORS wildcard não foi encontrado; fluxo normal é same-origin.
- Queries customizadas observadas usam parâmetros; nenhuma concatenação SQL insegura foi encontrada.
- Nenhum innerHTML, eval, DomSanitizer ou bypassSecurityTrust foi encontrado.
- Autorização por recurso bloqueia casos IDOR; redação financeira e revogação SHARED encerraram as duas exceções S1 da baseline.
- .env está ignorado, customizado localmente e ausente do histórico Git.
- Dockerfiles são multi-stage, runtimes usam usuário não root e .dockerignore exclui secrets.
- Lockfile npm contém integrity, usa HTTPS no registry esperado e os audits atualizados no integrado e standalone retornam 0 vulnerabilidades.
- Compose possui healthchecks, volume persistente e bind de loopback por padrão.
- Sync multi-repositório final está íntegro em 84/84 arquivos backend e 76/76 frontend.

## 7. Priorização

Gate concluído e revalidado nos três repositórios:

1. SEC-FIND-001 — autorização de campos financeiros: CLOSED;
2. SEC-FIND-002 — revogação do vínculo em pendências SHARED: CLOSED;
3. SEC-FIND-004 — fallback JWT conhecido: CLOSED;
4. SEC-FIND-005 — dependências vulneráveis da baseline: CLOSED, audit atual = 0;
5. testes negativos correspondentes: PASS no conjunto de 16 backend e 31 frontend.

Próximas prioridades abertas:

1. SEC-FIND-003 — concluir isolamento de seeds, preservando loopback como default;
2. SEC-FIND-006 — menor privilégio PostgreSQL;
3. SEC-FIND-007 e 008 — sessão, CSP, headers e TLS;
4. SEC-FIND-009 — proteção de login;
5. SEC-FIND-010 e 011 — retenção e ACL;
6. SEC-FIND-012 — CI, E2E e observabilidade;
7. SEC-FIND-017 — resolver Q-004 antes de mudar a política de edição SHARED.

S3 deve entrar no hardening antes de produção.

## 8. Gate de saída

O gate de segurança para continuar uma feature comum é:

~~~text
S0 = 0
S1 = 0
testes negativos dos controles corrigidos = PASS
nenhum segredo real versionado
baseline de dependências registrada e triada
~~~

Status atual:

~~~text
S0 = 0
S1 = 0
Security posture = NEEDS HARDENING
Ready for next common feature = YES
Ready for production = NO
Standalone sync/revalidation = PASS (backend 84/84; frontend 76/76)
~~~
