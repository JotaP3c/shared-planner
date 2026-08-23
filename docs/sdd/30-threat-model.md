# 30 — Threat Model

## 1. Objetivo e escopo

Este documento modela ameaças ao Shared Planner no estado observado em 2026-08-22. O escopo inclui:

- navegador e frontend Angular com SSR em Express;
- API Spring Boot protegida por bearer JWT;
- PostgreSQL e dados persistidos;
- Docker Compose, imagens e variáveis de ambiente;
- logs funcionais e trilha de auditoria;
- estação Windows e arquivos locais;
- os três repositórios Git e sua cadeia de dependências.

O ambiente Compose atual é de desenvolvimento local. As portas publicadas usam loopback por padrão, mas HTTP local, credenciais de seed e defaults de desenvolvimento não são automaticamente aceitáveis em produção. Requisitos produtivos, especialmente HTTPS, isolamento de rede, rotação de credenciais, observabilidade e backup, são tratados como gates separados.

## 2. Arquitetura e fluxos de confiança

~~~mermaid
flowchart LR
    U[Browser / User] -->|HTTP local; HTTPS obrigatório em produção| F[Angular SSR / Express]
    F -->|Proxy same-origin /api| B[Spring Boot API]
    B -->|JDBC| P[(PostgreSQL)]

    F -. lê configuração de runtime .-> E[Environment variables]
    B -. lê credenciais e segredo JWT .-> E
    B -->|audit snapshots| P

    G[Git repositories] --> D[Docker build contexts]
    N[npm / Maven registries] --> D
    D --> C[Docker images / Compose]
    C --> F
    C --> B
    C --> P

    B --> L[Application logs]
    F --> L
~~~

Fluxo principal:

~~~text
Browser
  ↓ HTTP local / HTTPS em produção
Frontend Angular SSR / Express
  ↓ REST JSON + Authorization: Bearer JWT
Backend Spring Boot
  ↓ JDBC
PostgreSQL
~~~

O JWT é emitido pelo backend após autenticação e armazenado no localStorage do navegador. O interceptor integrado adiciona o token somente a `/api` same-origin, preserva um `Authorization` explícito, encerra a sessão em 401 e a preserva em 403/outros erros. O backend valida assinatura HS256, expiração, issuer e usuário ativo; os serviços consultam os vínculos atuais de calendário para as decisões finas de autorização.

## 3. Assets

| ID | Asset | Classificação | Impacto principal |
|---|---|---|---|
| AST-001 | Senha em trânsito durante login | AUTHENTICATION_SECRET | tomada de conta |
| AST-002 | Hashes BCrypt | AUTHENTICATION_SECRET | cracking offline e tomada de conta |
| AST-003 | JWT bearer | AUTHENTICATION_SECRET | impersonação até expirar |
| AST-004 | Segredo de assinatura JWT | AUTHENTICATION_SECRET | emissão arbitrária de tokens |
| AST-005 | Credenciais PostgreSQL | AUTHENTICATION_SECRET | leitura, alteração ou destruição do banco |
| AST-006 | E-mail e nome completo | PERSONAL_DATA | privacidade, phishing e enumeração |
| AST-007 | Nome de cliente/pessoa e descrições | PERSONAL_DATA | exposição de agenda e contexto profissional/pessoal |
| AST-008 | Horários e participação em eventos | PERSONAL_DATA | exposição de rotina e relacionamentos |
| AST-009 | Valores, recebimentos, método e estado de pagamento | FINANCIAL_DATA | perda de confidencialidade e fraude |
| AST-010 | Audit logs, oldValue e newValue | PERSONAL_DATA / FINANCIAL_DATA | histórico sensível e retenção excessiva |
| AST-011 | Código-fonte, specs e manifests | INTERNAL, exceto conteúdo publicado | integridade da aplicação e supply chain |
| AST-012 | Imagens, lockfiles e migrations | INTERNAL | execução reproduzível e integridade do runtime |
| AST-013 | Documentação geral e placeholders | PUBLIC | orientação de uso; não pode conter segredo real |

## 4. Actors

| ID | Ator | Confiança | Capacidades relevantes |
|---|---|---|---|
| ACT-001 | Usuário anônimo | não confiável | health, login e tráfego até o frontend |
| ACT-002 | Usuário autenticado global USER | parcialmente confiável | recursos dos calendários aos quais pertence |
| ACT-003 | Membro VIEWER | parcialmente confiável | leitura de calendário e eventos |
| ACT-004 | Membro EDITOR | parcialmente confiável | criação e edição autorizada de eventos |
| ACT-005 | Membro FINANCE | privilegiado por domínio | consulta financeira do calendário |
| ACT-006 | Calendar ADMIN | privilegiado por calendário | eventos, membros, financeiro e auditoria do calendário |
| ACT-007 | Global ADMIN | altamente privilegiado | usuários e bypass CURRENT de calendários |
| ACT-008 | Usuário local do Windows | não confiável entre contas | leitura/modificação conforme ACL do workspace |
| ACT-009 | Maintainer Git | privilegiado | código, specs, dependências e releases |
| ACT-010 | Registry npm/Maven e fornecedor de imagem | externo | artefatos consumidos no build |
| ACT-011 | Operador PostgreSQL/DBeaver | privilegiado | acesso direto ao banco e aos dados persistidos |
| ACT-012 | Processo/container comprometido | hostil | movimentação lateral por rede, ambiente e volume |

## 5. Trust boundaries

| ID | Boundary | Dados que atravessam | Controles existentes | Riscos residuais |
|---|---|---|---|---|
| TB-001 | Browser → Frontend | credenciais de login, JWT, eventos | same-origin, Angular escaping | HTTP local, token em localStorage, CSP ausente |
| TB-002 | Frontend → Backend | bearer JWT e JSON | proxy /api, Spring Security | proxy manual, headers e timeouts incompletos |
| TB-003 | Backend → PostgreSQL | credenciais, PII, financeiro, auditoria | JDBC/JPA, rede Compose | papel DB excessivo e ausência de TLS DB produtivo |
| TB-004 | Host Windows → Docker | portas, volume e ambiente | Docker isolation, usuários não root e bind `127.0.0.1` por padrão | alteração consciente de `BIND_ADDRESS`, seeds previsíveis e secrets no ambiente |
| TB-005 | Arquivos locais → Processos | .env e configuração | Git ignore e .dockerignore | ACL local ampla e adulteração de configuração |
| TB-006 | Git/registries → Build | código, pacotes e imagens | lockfile npm, npm ci, HTTPS, multi-stage | tags mutáveis, wrapper sem checksum e ausência de CI |
| TB-007 | Aplicação → Logs/auditoria | identidade, ações e snapshots | acesso de auditoria no backend | retenção, mascaramento e imutabilidade indefinidos |
| TB-008 | Monorepo → Standalones | código implantável | sync por hash e validação de topologia | erro operacional se o gate de sync for ignorado |

## 6. Entry points

| ID | Entry point | Autenticação esperada | Dados sensíveis |
|---|---|---|---|
| EP-001 | GET /api/health | público | nenhum esperado |
| EP-002 | POST /api/auth/login | público | senha de entrada e JWT de saída |
| EP-003 | GET /api/auth/me | JWT | identidade e papel |
| EP-004 | /api/users | JWT + global ADMIN | dados pessoais e papéis |
| EP-005 | /api/calendars e members | JWT + autorização por recurso | membros, e-mails e papéis |
| EP-006 | /api/events | JWT + autorização por calendário/evento | agenda, PII e campos financeiros |
| EP-007 | approve/reject/pending | JWT + usuário solicitado | consentimento SHARED |
| EP-008 | /api/finance e client-revenue | JWT + capacidade financeira | agregados financeiros |
| EP-009 | /api/audit-logs | JWT + ADMIN autorizado | histórico pessoal/financeiro |
| EP-010 | Frontend SSR e arquivos estáticos | público | conteúdo da aplicação |
| EP-011 | Proxy SSR /api | público até autenticação do backend | headers, bodies e tokens |
| EP-012 | PostgreSQL publicado no host | credencial DB | banco completo |
| EP-013 | .env e configuração local | ACL do sistema operacional | segredos e endpoints |
| EP-014 | Git clone/pull e sync | credencial Git/ACL local | integridade do código |
| EP-015 | npm/Maven/Docker registries | confiança externa | dependências e imagens |

## 7. Sensitive data handling

| Classe | Exemplos | Armazenamento atual | Regra mínima |
|---|---|---|---|
| PUBLIC | README, licença, placeholders | Git | não conter segredo real |
| INTERNAL | topologia, manifests, migrations | Git e imagens | revisão e integridade de supply chain |
| PERSONAL_DATA | e-mail, nome, agenda, cliente, descrição | PostgreSQL, respostas e auditoria | mínimo necessário, autorização e retenção |
| AUTHENTICATION_SECRET | senha, JWT, segredo JWT, senha DB | request, localStorage, ambiente e banco hash | nunca logar/versionar; rotação e acesso mínimo |
| FINANCIAL_DATA | amount, receivedAmount, paymentStatus, paymentMethod | PostgreSQL, API e auditoria | autorização de campo e trilha de alteração |

Controles confirmados:

- senha persistida como BCrypt, não reversível;
- DTOs de resposta de usuário não retornam senha ou hash;
- JWT usa HS256 explícito e valida expiração, issuer e usuário ativo; configuração exige segredo externo com mínimo de 32 caracteres;
- .env real é ignorado e não foi encontrado no histórico Git;
- Dockerfiles e .dockerignore não copiam .env para as imagens;
- queries observadas usam Spring Data/JPA com parâmetros;
- não foram encontrados sinks Angular como innerHTML ou bypassSecurityTrust;
- autorização por recurso existe para calendários, membros, eventos, financeiro e auditoria.
- respostas de evento omitem dados financeiros sem capacidade e a revogação de membership SHARED é revalidada na fila e nas decisões;
- o Compose integrado publica serviços em `127.0.0.1` por padrão.

## 8. Threats

| ID | Threat | Asset | Boundary | Controle atual | Residual risk | Finding |
|---|---|---|---|---|---|---|
| THR-001 | membro sem capacidade financeira lê valores por EventResponse | AST-009 | TB-002 | projeção por capacidade e omissão dos cinco campos financeiros | mitigado e validado nos três repositórios; prevenir regressão | SEC-FIND-001 — CLOSED |
| THR-002 | ex-membro continua listando e decidindo pendência SHARED | AST-007/008 | TB-002 | vínculo atual revalidado na fila e em approve/reject | mitigado nos três repositórios; política de edição Q-004 é risco separado | SEC-FIND-002 — CLOSED |
| THR-003 | conta de seed conhecida é usada por máquina da rede | AST-001/006 | TB-001/TB-004 | bind `127.0.0.1` por padrão e finalidade local documentada | seeds previsíveis e possível alteração de `BIND_ADDRESS` | SEC-FIND-003 — PARTIAL |
| THR-004 | segredo JWT de desenvolvimento permite token forjado | AST-003/004 | TB-002/TB-005 | fallback conhecido removido; secret externo com mínimo de 32 caracteres | rotação, secret store e detecção de todo placeholder continuam TARGET | SEC-FIND-004 — CLOSED para o fallback |
| THR-005 | dependência vulnerável é alcançável no runtime | AST-011/012 | TB-006 | lockfile, `npm ci` e atualização deliberada para Angular 21.2.21 | audit runtime e completo atuais retornam 0; manter verificação recorrente | SEC-FIND-005 — CLOSED |
| THR-006 | comprometimento do backend concede privilégio amplo no DB | AST-005-010 | TB-003 | credencial por ambiente | runtime reutiliza o superuser de bootstrap criado por POSTGRES_USER | SEC-FIND-006 |
| THR-007 | XSS futuro extrai bearer token | AST-003 | TB-001 | escaping Angular | localStorage e CSP ausente | SEC-FIND-007 |
| THR-008 | clickjacking, leak de referrer ou script não autorizado | AST-003/006-010 | TB-001 | alguns defaults Spring | SSR sem política explícita | SEC-FIND-008 |
| THR-009 | brute force ou credential stuffing no login | AST-001 | TB-001/TB-002 | BCrypt e usuário ativo | sem rate limit/lockout | SEC-FIND-009 |
| THR-010 | auditoria acumula PII/financeiro indefinidamente | AST-010 | TB-007 | acesso restrito a ADMIN | sem retenção/máscara/imutabilidade | SEC-FIND-010 |
| THR-011 | outro usuário local lê ou adultera .env/código | AST-004/005/011 | TB-005 | arquivo ignorado | ACL herdada ampla | SEC-FIND-011 |
| THR-012 | ataque não é detectado ou regressão de authz chega ao main | todos | TB-002/TB-006/TB-007 | 16 testes backend e 31 frontend cobrem negativos críticos; auditoria funcional parcial | sem CI/gate contínuo, eventos seguros de login e E2E completo | SEC-FIND-012 — PARTIAL |
| THR-013 | payload extremo causa erro/consumo ou estado inválido | AST-006-010 | TB-002 | Bean Validation, segredo/duração JWT e precisão de `receivedAmount` reforçados | limites de texto/body/audience ainda incompletos | SEC-FIND-013 — PARTIAL |
| THR-014 | artefato ou imagem muda sem revisão | AST-011/012 | TB-006 | HTTPS e lock npm | tags mutáveis e checksum ausente | SEC-FIND-014 |
| THR-015 | acesso direto/import gera estado financeiro inválido ou perda | AST-006-010 | TB-003 | FKs/CHECKs e integridade financeira no serviço com regressão | constraints adicionais no banco, backup e restore incompletos | SEC-FIND-015 — PARTIAL |
| THR-016 | proxy SSR fica preso ou propaga headers indevidos | AST-003/011 | TB-002 | target controlado por ambiente | proxy manual sem timeout/filtro explícito | SEC-FIND-016 |
| THR-017 | approver SHARED modifica conteúdo/estado de evento de terceiro | AST-007/008/009 | TB-002 | ensureApprovalTarget só nos endpoints de decisão | política de edição depende de Q-004 | SEC-FIND-017 |

## 9. OWASP applicability

| Categoria | Classificação | Justificativa |
|---|---|---|
| A01 Broken Access Control | APPLICABLE | os dois S1 foram mitigados no integrado; Q-003/Q-004/Q-005 e cobertura ampliada continuam relevantes |
| A02 Cryptographic Failures | APPLICABLE | bearer no localStorage, rotação/secret store e TLS produtivo pendentes; fallback JWT conhecido foi removido |
| A03 Injection | REVIEWED, sem finding confirmado | repositories usam parâmetros; nenhum sink SQL/DOM perigoso foi encontrado |
| A04 Insecure Design | APPLICABLE | consentimento SHARED, pagamento e retenção possuem decisões abertas |
| A05 Security Misconfiguration | APPLICABLE | portas, headers, DB role e ACL |
| A06 Vulnerable Components | APPLICABLE / CURRENT CLEAN | baseline possuía ocorrências; audit runtime e completo atuais retornam 0 após atualização revisada |
| A07 Authentication Failures | APPLICABLE | ausência de throttling e política de senha limitada |
| A08 Software and Data Integrity Failures | APPLICABLE | tags mutáveis, checksum/CI ausentes |
| A09 Logging and Monitoring Failures | APPLICABLE | login/falhas não monitorados e auditoria sem governança |
| A10 SSRF | NOT CURRENTLY APPLICABLE | BACKEND_URL é configuração operacional, não entrada do usuário |

CSRF não é finding no modelo atual porque o JWT é enviado explicitamente em Authorization e não por cookie automático. Se a sessão migrar para cookie, a análise deve ser refeita. CORS wildcard não foi encontrado; o fluxo normal é same-origin via proxy.

## 10. Residual risks e production gates

Antes de produção:

1. manter SEC-FIND-001 e SEC-FIND-002 fechados por regressão e sincronizar/revalidar os standalones;
2. remover seeds/credenciais previsíveis antes de produção e definir rotação das contas reais;
3. exigir HTTPS na borda e conexão protegida aos serviços internos conforme ambiente;
4. separar papéis PostgreSQL de migration e runtime;
5. definir estratégia de token, CSP e headers;
6. manter auditoria recorrente e atualização revisada de dependências; o finding da baseline está encerrado;
7. definir retenção, minimização, backup e restore;
8. executar os 16 testes backend e 31 frontend em CI, ampliar E2E e adicionar gates de dependências;
9. restringir portas, filesystem e secrets ao menor privilégio;
10. repetir o threat model quando houver cookie, upload, integrações externas, notificações ou deploy público.

Estado residual atual após validação multi-repositório: `S0 OPEN = 0` e `S1 OPEN = 0`; os riscos S2/S3 acima permanecem. O conjunto é adequado apenas para desenvolvimento controlado e não está aprovado para produção. Q-004 e Q-005 permanecem abertas; integrado e standalones estão sincronizados e revalidados.
