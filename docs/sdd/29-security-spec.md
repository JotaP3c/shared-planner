# 29 — Especificação de segurança

## 1. Objetivo e escopo

Este documento define os controles de segurança do Shared Planner para frontend, API Spring Boot, PostgreSQL, Docker e repositórios Git. Ele transforma a auditoria defensiva em requisitos rastreáveis sem confundir comportamento existente com comportamento aprovado.

As palavras **DEVE**, **NÃO DEVE** e **SOMENTE** são normativas. **CURRENT** descreve evidência encontrada em 2026-08-22; **TARGET** descreve o controle exigido. **NEEDS_DECISION** identifica uma regra que não pode ser fechada sem decisão de produto.

Dependências principais:

- [03-business-rules.md](03-business-rules.md);
- [04-permissions.md](04-permissions.md);
- [10-payment-spec.md](10-payment-spec.md);
- [11-api-contracts.md](11-api-contracts.md);
- [14-audit-spec.md](14-audit-spec.md);
- [16-test-strategy.md](16-test-strategy.md);
- [99-open-questions.md](99-open-questions.md).

## 2. Fronteiras de confiança

```text
Browser não confiável
        |
        | HTTPS em produção
        v
Frontend / reverse proxy
        |
        | Bearer JWT + JSON
        v
Backend Spring Boot
        |
        | conexão autenticada e com privilégio mínimo
        v
PostgreSQL
```

Entradas de usuário, IDs, claims JWT, headers, parâmetros, arquivos de ambiente e conteúdo recuperado do banco são dados não confiáveis até validação. Ocultar controles no frontend não substitui autorização no backend.

## 3. Classificação de dados

| Classe | Exemplos | Proteção mínima |
|---|---|---|
| `PUBLIC` | resposta mínima de health, documentação pública | integridade e ausência de detalhes internos |
| `INTERNAL` | IDs técnicos, roles, configuração não secreta, métricas operacionais | autenticação quando aplicável e minimização |
| `PERSONAL_DATA` | e-mail, nome, cliente, pessoa, descrição e agenda | acesso por recurso, minimização, TLS e retenção definida |
| `FINANCIAL_DATA` | `amount`, `receivedAmount`, status/método/data de pagamento e totais | capacidade financeira ou de pagamento aprovada, TLS e auditoria |
| `AUTHENTICATION_SECRET` | senha, hash, JWT, segredo JWT e credenciais do banco | nunca retornar ou registrar; armazenar somente em mecanismo apropriado |
| `AUDIT_DATA` | ator, ação, snapshots, datas e identificadores | acesso administrativo, integridade, minimização e retenção |

## 4. Estado atual verificado

| Área | CURRENT | Estado de segurança |
|---|---|---|
| Autenticação | login e `/api/auth/me`; BCrypt; bearer JWT; usuário ativo é consultado no banco | parcial: regressão integrada cobre JWT ausente/inválido/expirado e usuário inativo; ainda não há rate limit ou logout/revogação server-side |
| Autorização por recurso | calendário, evento, membro, financeiro, usuários e auditoria possuem verificações centrais | os dois achados S1 foram corrigidos no integrado; Q-003, Q-004 e Q-005 permanecem abertas |
| Respostas | controllers usam DTOs, não retornam `passwordHash` e omitem campos financeiros de `EventResponse` sem capacidade; acesso financeiro é resolvido uma vez por request/calendar | redação e ausência de N+1 validadas nos três repositórios; minimização mais ampla continua TARGET |
| JWT | HS256 explícito; assinatura, expiração, issuer `shared-planner-api`, usuário ativo e configuração mínima do segredo são validados | parcial: audience, rotação/revogação e rejeição de placeholders conhecidos continuam TARGET |
| CORS/CSRF | CORS não é aberto; CSRF desabilitado; autenticação atual usa header bearer, não cookie | aceitável para arquitetura atual, condicionado à manutenção dessas premissas |
| Banco | JPA parametrizado, Flyway, constraints básicas e invariantes financeiras reforçadas no serviço | parcial: runtime/Flyway usa o superuser criado por `POSTGRES_USER`; constraints financeiras no banco continuam incompletas |
| Segredos | `.env` ignorado; dev/prod exigem variáveis; exemplo contém placeholders; segredo JWT vazio ou menor que 32 caracteres falha na validação | parcial: não há secret store/rotação nem rejeição de todo placeholder conhecido |
| Auditoria | operações principais geram snapshots e acesso é administrativo | parcial: sem autenticação/login, política de retenção, mascaramento ou imutabilidade em banco |
| Dependências | versões centralizadas pelo Spring Boot; advisories recentes revisados conceitualmente | parcial: sem scanner Maven automatizado e sem gate contínuo |
| Testes | integrado e standalones validados com 16 testes backend e 31 testes frontend; inclui JWT negativo, BOLA, autorização/redação financeira, revogação SHARED, owner, pagamento e Finance | cobertura ainda parcial: faltam CI, concorrência, rate limit, observabilidade e E2E completo |

## 5. Requisitos de autenticação

| ID | Estado | Requisito | Verificação |
|---|---|---|---|
| `SEC-AUTH-001` | CURRENT + TARGET | Somente `GET /api/health` e `POST /api/auth/login` podem ser públicos. Toda outra API DEVE exigir autenticação válida. | testes de integração sem token em todos os grupos de rota |
| `SEC-AUTH-002` | CURRENT + TARGET | Usuário inexistente ou inativo NÃO DEVE obter nem continuar usando acesso funcional. A resposta pública não deve facilitar enumeração de contas. | login e token previamente emitido para usuário desativado |
| `SEC-AUTH-003` | CURRENT + TARGET | Senhas DEVEM ser armazenadas exclusivamente como hash de senha adaptativo. Senha e hash NÃO DEVEM aparecer em DTO, erro, log ou audit trail. | teste de contrato e busca estática |
| `SEC-AUTH-004` | TARGET | Login exposto DEVE possuir limitação de tentativas por identidade e origem, observabilidade de falhas e recuperação segura, sem bloquear indefinidamente uma vítima. | teste de throttling e revisão de logs |
| `SEC-AUTH-005` | TARGET | O ciclo de sessão DEVE definir logout, expiração e resposta a token comprometido. Revogação pode ser alcançada por TTL curto, versão de sessão/token ou denylist documentada. | cenários de logout, expiração e desativação |
| `SEC-AUTH-006` | TARGET | Contas e credenciais públicas de seed DEVEM existir somente em ambiente local descartável e não podem ficar alcançáveis por interfaces de rede não intencionais. | validação de perfil, bind e processo de deploy |
| `SEC-AUTH-007` | TARGET | Política de senha DEVE impor comprimento adequado, limite máximo compatível com BCrypt e impedir credenciais triviais em ambientes não descartáveis. | Bean Validation e testes de limites |

## 6. Requisitos de autorização

| ID | Estado | Requisito | Verificação |
|---|---|---|---|
| `SEC-AUTHZ-001` | CURRENT + TARGET | Toda autorização DEVE ser aplicada no backend e negar por padrão. A decisão deve considerar ator, ação, recurso e vínculo atual, não apenas autenticação. | matriz negativa por role e recurso |
| `SEC-AUTHZ-002` | CURRENT + TARGET | Trocar `calendarId` não pode revelar calendário, eventos, membros, finanças ou auditoria sem vínculo/capacidade autorizados. | testes BOLA com calendário visível, invisível e inexistente |
| `SEC-AUTHZ-003` | CURRENT + TARGET | Trocar `eventId` não pode permitir leitura, edição, cancelamento ou pagamento de evento fora do escopo autorizado. | testes BOLA por operação |
| `SEC-AUTHZ-004` | CURRENT + TARGET | `memberId` DEVE pertencer ao `calendarId` autorizado. O owner não pode ser removido nem rebaixado de `ADMIN`. | IDs cruzados e cenários de remoção/rebaixamento do owner |
| `SEC-AUTHZ-005` | CURRENT + TARGET | Usuários são administrados somente por `ADMIN` global; auditoria global somente por `ADMIN` global e auditoria de calendário somente pela capacidade aprovada. | testes 403/404 por role |
| `SEC-AUTHZ-006` | CURRENT + TARGET | Campos `FINANCIAL_DATA` NÃO DEVEM ser retornados a ator sem capacidade financeira ou de pagamento aprovada, mesmo quando ele pode visualizar o evento. O integrado aplica projeção por capacidade e omissão JSON. | testes de contrato por capacidade |
| `SEC-AUTHZ-007` | CURRENT + TARGET | Remover um usuário do calendário DEVE revogar imediatamente listagem, leitura e decisão de pendências SHARED daquele calendário. A implementação sincronizada revalida o vínculo na fila e em approve/reject; eventual política futura de cancelamento/reatribuição exige decisão própria. | remoção seguida de listagem/approve/reject |
| `SEC-AUTHZ-008` | NEEDS_DECISION — Q-004 | Quem pode editar evento SHARED, quais campos e quais transições reabrem aprovação DEVEM ser decididos em Q-004. Até a decisão, nenhuma ampliação silenciosa da permissão atual é permitida e o risco deve permanecer aberto. | critério pendente vinculado a Q-004 |
| `SEC-AUTHZ-009` | NEEDS_DECISION — Q-005 | A capacidade de alterar pagamento DEVE ser definida em Q-005. A implementação futura não pode inferir que visualizar finanças, criar evento ou editar conteúdo concede automaticamente essa capacidade. | critério pendente vinculado a Q-005 |
| `SEC-AUTHZ-010` | NEEDS_DECISION — Q-003 | O bypass de `ADMIN` global sobre autoria e consentimento DEVE permanecer documentado até Q-003 definir seu alcance. | matriz específica de ADMIN |

## 7. Requisitos de proteção de dados e API

| ID | Estado | Requisito | Verificação |
|---|---|---|---|
| `SEC-DATA-001` | TARGET | Cada campo de resposta DEVE possuir finalidade e classe de sensibilidade. Campos sem consumidor legítimo devem ser removidos. | inventário endpoint/campo/ator |
| `SEC-DATA-002` | CURRENT + TARGET | Nenhuma resposta pode conter senha, hash, segredo JWT, credencial do banco, variável de ambiente ou header de autorização. | testes JSON recursivos e revisão estática |
| `SEC-DATA-003` | TARGET | Dados pessoais de membros e eventos DEVEM ser limitados ao menor conjunto necessário para a ação autorizada. Listas e buscas podem usar DTO mais restrito que detalhes. | contrato por endpoint |
| `SEC-DATA-004` | NEEDS_DECISION — Q-006 | Retenção, mascaramento, exportação e descarte de snapshots de auditoria DEVEM ser definidos antes de produção. | política aprovada e teste de retenção |
| `SEC-DATA-005` | TARGET | Backups e exports com dados pessoais/financeiros DEVEM ser protegidos, ter acesso controlado e possuir teste de restauração sem divulgar conteúdo. | procedimento operacional |
| `SEC-API-001` | CURRENT + TARGET | Controllers DEVEM aceitar e retornar DTOs de allowlist; entidades JPA não podem ser usadas como contrato público. | revisão estática |
| `SEC-API-002` | TARGET | Erros DEVEM seguir envelope consistente e não expor stack trace, SQL, caminho, classe interna, segredo ou metadata do banco. | testes de 400/401/403/404/409/500 |
| `SEC-API-003` | TARGET | Respostas 401, 403 e 404 DEVEM ser semanticamente consistentes sem confirmar existência de recurso invisível. | testes diferenciais de ID inexistente/invisível |
| `SEC-API-004` | TARGET | Endpoints de coleção, busca e auditoria DEVEM impor limites; corpo e campos de texto DEVEM ter tamanho máximo coerente com o banco. | testes de limites e configuração HTTP |
| `SEC-API-005` | CURRENT + TARGET | Health público DEVE retornar somente estado mínimo e não revelar versão, banco, ambiente ou stack. | teste de contrato de health |

## 8. Requisitos JWT

| ID | Estado | Requisito | Verificação |
|---|---|---|---|
| `SEC-JWT-001` | CURRENT + TARGET | Somente o algoritmo explicitamente aprovado pode ser aceito. Tokens `alg=none`, com algoritmo diferente ou assinatura adulterada DEVEM ser rejeitados. | testes de decoder/filtro |
| `SEC-JWT-002` | CURRENT + TARGET | Assinatura, `exp` e `nbf`, quando presente, DEVEM ser validados antes do controller. Token expirado não pode acessar API. | testes com relógio controlado |
| `SEC-JWT-003` | CURRENT (`iss`) + TARGET (`aud`) | `iss` DEVE ser validado contra o emissor esperado; o integrado valida `shared-planner-api`. A necessidade de `aud` DEVE ser definida e, quando configurada, validada. | tokens com issuer incorreto; audience após decisão |
| `SEC-JWT-004` | CURRENT parcial + TARGET | O integrado exige segredo HS256 externo, não vazio e com no mínimo 32 caracteres. Entropia, secret store, rotação e rejeição de valores conhecidos/placeholder continuam TARGET. | teste de startup por configuração e revisão operacional |
| `SEC-JWT-005` | TARGET | TTL DEVE ser limitado por ambiente. Rotação de chave e resposta a comprometimento DEVEM ser documentadas sem imprimir tokens. | revisão de configuração e runbook |
| `SEC-JWT-006` | CURRENT + TARGET | O `sub` identifica o usuário, mas roles/capacidades sensíveis DEVEM ser confirmadas em estado confiável atual; claims obsoletas não podem manter privilégio. | mudança de role/active com token existente |

## 9. Logs e auditoria

| ID | Estado | Requisito | Verificação |
|---|---|---|---|
| `SEC-LOG-001` | CURRENT + TARGET | Senhas, hashes, JWT, Authorization, segredo JWT e credenciais do banco NÃO DEVEM aparecer em logs ou snapshots. | captura de logs e busca automatizada |
| `SEC-LOG-002` | TARGET | Sucesso/falha de autenticação, throttling e negação administrativa relevante DEVEM gerar evento seguro com timestamp e correlação, sem registrar credencial. | teste de observabilidade |
| `SEC-LOG-003` | CURRENT + TARGET | Mudança de usuário, calendário, membro, evento, aprovação e pagamento DEVE ser auditada atomicamente com a operação. | integração por ação e rollback |
| `SEC-LOG-004` | TARGET | Campos controlados pelo usuário em logs/auditoria DEVEM ser normalizados para impedir injeção de quebra de linha ou conteúdo enganoso. | testes com caracteres de controle |
| `SEC-LOG-005` | NEEDS_DECISION — Q-006 | Acesso, imutabilidade, retenção e minimização do audit trail DEVEM ser fechados por Q-006. | critérios após decisão |

## 10. Banco de dados

| ID | Estado | Requisito | Verificação |
|---|---|---|---|
| `SEC-DB-001` | CURRENT + TARGET | Toda consulta com entrada externa DEVE usar parâmetros/prepared statements. SQL/JPQL não pode ser concatenado com entrada. | revisão estática e teste de payload literal |
| `SEC-DB-002` | TARGET | A aplicação runtime NÃO DEVE conectar como superuser, owner amplo ou role capaz de criar roles/databases. Migrações devem usar role separada quando exigirem DDL. | consulta a `pg_roles` e teste de privilégios |
| `SEC-DB-003` | CURRENT parcial + TARGET | Invariantes críticas de período, enums, escala e coerência financeira DEVEM ser protegidas na aplicação e, quando viável, por constraints no banco. O integrado valida escala e impede que edição preserve pagamento incompatível; constraints adicionais continuam TARGET. | testes de serviço e migration test em PostgreSQL real |
| `SEC-DB-004` | CURRENT local + TARGET produção | O Compose integrado vincula PostgreSQL, backend e frontend a `127.0.0.1` por padrão via `BIND_ADDRESS`. Produção não deve publicar o banco diretamente à Internet. | inspeção de Compose/rede e configuração de deploy |
| `SEC-DB-005` | TARGET | Credenciais do banco DEVEM ser distintas por ambiente, rotacionáveis e não compartilhadas com conta humana de administração. | revisão de roles e secrets |
| `SEC-DB-006` | TARGET | Alterações concorrentes de aprovação, pagamento e membership DEVEM detectar conflito, evitando estado de último escritor silencioso. | testes concorrentes/optimistic locking |

## 11. HTTP, CORS e CSRF

| ID | Estado | Requisito | Verificação |
|---|---|---|---|
| `SEC-HTTP-001` | TARGET | Todo tráfego cliente → aplicação em produção DEVE usar HTTPS/TLS. HTTP local pode existir somente para desenvolvimento documentado. | teste no boundary público |
| `SEC-HTTP-002` | TARGET | Reverse proxy e backend DEVEM tratar forwarded headers somente de proxies confiáveis e emitir HSTS quando a requisição externa for HTTPS. | teste de deploy |
| `SEC-HTTP-003` | TARGET | Respostas frontend/API DEVEM possuir headers adequados ao contexto, incluindo `nosniff`, proteção contra framing e política de referrer; CSP deve ser definida no frontend. | teste de headers |
| `SEC-HTTP-004` | CURRENT + TARGET | CORS DEVE negar por padrão. Se cross-origin for necessário, origens, métodos e headers devem ser allowlist por ambiente; wildcard com credenciais é proibido. | preflight permitido e negado |
| `SEC-HTTP-005` | CURRENT + TARGET | CSRF desabilitado é aceitável somente enquanto autenticação usar exclusivamente bearer header não enviado automaticamente pelo browser. Migrar para cookie exige reabrir esta decisão e habilitar proteção apropriada. | teste de ausência de cookie e revisão arquitetural |

## 12. Segredos e configuração

| ID | Estado | Requisito | Verificação |
|---|---|---|---|
| `SEC-SECRETS-001` | CURRENT + TARGET | `.env`, chaves, tokens e credenciais reais NÃO DEVEM ser versionados. `.env.example` contém somente placeholders inequívocos. | `git ls-files`, `git check-ignore` e secret scan |
| `SEC-SECRETS-002` | TARGET | Perfil de produção DEVE falhar fechado se variável obrigatória estiver ausente, vazia, fraca ou igual ao placeholder conhecido. | testes de startup |
| `SEC-SECRETS-003` | TARGET | Segredos NÃO DEVEM aparecer em linha de comando persistida, relatório, screenshot, telemetry ou output de CI. | revisão de scripts/pipeline |
| `SEC-SECRETS-004` | TARGET | Deve existir procedimento de rotação e revogação para JWT e banco, com atualização coordenada e sem commit do valor. | runbook testado |

## 13. Validação de entrada e integridade

| ID | Estado | Requisito | Verificação |
|---|---|---|---|
| `SEC-INPUT-001` | CURRENT + TARGET | IDs, enums, e-mails, nomes, títulos, datas, valores, limites e buscas DEVEM ser validados no backend. | testes válidos, limites e tipos inválidos |
| `SEC-INPUT-002` | TARGET | Todo texto persistido DEVE ter máximo explícito coerente com banco e uso; validação deve ocorrer antes da persistência. | Bean Validation e teste de boundary |
| `SEC-INPUT-003` | CURRENT parcial + TARGET | `amount` e `receivedAmount` DEVEM respeitar precisão/escala e nunca formar estado financeiro incoerente. O integrado valida `receivedAmount` e rejeita/reconcilia alterações incompatíveis; constraint equivalente no banco continua TARGET. | testes parametrizados e constraint real |
| `SEC-INPUT-004` | CURRENT + TARGET | `endsAt` DEVE ser posterior a `startsAt`; intervalos financeiros DEVEM ser válidos e limitados para impedir abuso. | testes de período e intervalo excessivo |
| `SEC-INPUT-005` | TARGET | Duplicidade e conflito concorrente DEVEM resultar em resposta controlada, não em 500 ou sobrescrita silenciosa. | testes de unicidade e concorrência |

## 14. Dependências e supply chain

| ID | Estado | Requisito | Verificação |
|---|---|---|---|
| `SEC-DEP-001` | TARGET | Backend e frontend DEVEM manter inventário reproduzível de dependências e versões bloqueadas. | lockfile/SBOM ou dependency tree arquivado |
| `SEC-DEP-002` | TARGET | Dependências DEVEM ser verificadas regularmente contra advisories atuais por ferramenta segura e atualizada. | gate Maven/npm e revisão de aplicabilidade |
| `SEC-DEP-003` | TARGET | Vulnerabilidade aplicável S0/S1 bloqueia entrega até correção ou aceitação explícita de risco com prazo e compensação. | relatório de scan + triagem |
| `SEC-DEP-004` | TARGET | Correção automática destrutiva, major upgrade ou suppressão ampla não pode ser aplicada sem análise de compatibilidade e regressão. | revisão de mudança |
| `SEC-DEP-005` | TARGET | Imagens de container DEVEM usar versão suportada e processo de atualização; digest deve ser considerado para release reproduzível. | inspeção das imagens e scan |

## 15. Requisitos do frontend

| ID | Estado | Requisito | Verificação |
|---|---|---|---|
| `SEC-FRONT-001` | CURRENT + TARGET | Guard, menu e botão servem à UX; autorização real permanece no backend. Chamada manual não pode ampliar acesso. | E2E + chamada direta |
| `SEC-FRONT-002` | CURRENT RISK + TARGET | Token atualmente persistido em `localStorage`, portanto qualquer XSS no mesmo origin pode lê-lo. O risco DEVE ser reduzido com ausência de DOM inseguro, CSP, TTL limitado e decisão arquitetural documentada antes de produção. Cookie não pode ser adotado sem reavaliar CSRF. | revisão XSS/CSP/token |
| `SEC-FRONT-003` | CURRENT + TARGET | Conteúdo de título, descrição, cliente, pessoa e auditoria DEVE ser renderizado com escaping; bypass de sanitização exige justificativa e teste. | busca estática e payload de regressão benigno |
| `SEC-FRONT-004` | CURRENT + TARGET | O interceptor integrado anexa bearer somente a `/api` same-origin e não sobrescreve `Authorization` explícito. Respostas 401 encerram a sessão de forma idempotente; 403 e demais erros preservam a sessão. | testes de interceptor/fluxo |
| `SEC-FRONT-005` | TARGET | Dados pessoais/financeiros e tokens NÃO DEVEM ser persistidos em storage, analytics, URL ou console além do estritamente definido. | inspeção de storage/log/network |
| `SEC-FRONT-006` | TARGET | Produção DEVE usar mesma origem ou CORS allowlisted e HTTPS; URL de backend não pode permitir downgrade silencioso para HTTP. | configuração e E2E de deploy |

## 16. Decisões explicitamente não tomadas

- **Q-004 permanece aberta:** este documento não decide se o alvo SHARED pode editar, quais campos pode alterar ou quando a aprovação reabre.
- **Q-005 permanece aberta:** este documento não decide se pagamento pertence a `FINANCE`, ao autor do evento, a ambos ou a uma capacidade nova.
- **Q-006 permanece aberta:** este documento exige decisão de retenção/minimização, mas não escolhe prazo.

Enquanto essas decisões estiverem abertas, nenhuma funcionalidade afetada pode ser declarada segura ou completamente implementada apenas porque o comportamento CURRENT funciona.

## 17. Gate de segurança

Antes de continuar features comuns:

```text
S0 OPEN = 0
S1 OPEN = 0
```

Exceção exige risco aceito explicitamente, responsável, controle compensatório e prazo. O gate deve usar os critérios de [32-security-acceptance-criteria.md](32-security-acceptance-criteria.md) e registrar evidência sem incluir dados sensíveis.

Validação multi-repositório de 2026-08-22: `S0 OPEN = 0` e `S1 OPEN = 0`. Os achados de redação financeira e revogação SHARED foram encerrados com regressão no integrado e nos standalones; a paridade oficial é 84/84 arquivos backend e 76/76 frontend. Riscos S2/S3 e as decisões Q-004/Q-005 continuam abertos.
