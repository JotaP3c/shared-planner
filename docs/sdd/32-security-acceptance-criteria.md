# 32 — Critérios de aceite de segurança

## 1. Convenções

Estes critérios validam a [especificação de segurança](29-security-spec.md). Cada cenário deve ser automatizado quando tecnicamente razoável. Evidências manuais não podem conter senha, hash, JWT, segredo ou conteúdo pessoal/financeiro real.

Estados:

- `AUTOMATABLE`: deve virar teste automatizado;
- `MANUAL`: validação de ambiente ou processo;
- `PENDING`: depende de questão aberta e não pode receber `PASS` antes da decisão.

Para cenários de recurso invisível, 404 pode ser preferível a 403 para reduzir enumeração, desde que seja consistente e nenhum dado seja retornado.

## 2. Autenticação e JWT

### `SAC-AUTH-001` — JWT ausente (`AUTOMATABLE`, PASS integrado)

```gherkin
Scenario Outline: Endpoint protegido rejeita requisição sem JWT
  Given uma requisição sem header Authorization
  When o cliente chama <endpoint>
  Then a resposta deve ser 401
  And nenhum dado protegido deve ser retornado

Examples:
  | endpoint |
  | GET /api/auth/me |
  | GET /api/calendars |
  | GET /api/events/search?term=ab |
  | GET /api/audit-logs |
```

Rastreia `SEC-AUTH-001`.

### `SAC-AUTH-002` — JWT inválido ou adulterado (`AUTOMATABLE`, PASS parcial integrado)

```gherkin
Scenario Outline: Decoder rejeita token não confiável
  Given um token <kind>
  When o token é enviado a GET /api/auth/me
  Then a resposta deve ser 401
  And o controller não deve ser executado

Examples:
  | kind |
  | com assinatura adulterada |
  | assinado por outra chave |
  | com alg none |
  | com algoritmo diferente de HS256 |
  | malformado |
```

Assinatura adulterada/malformada está coberta no integrado; exemplos `alg=none` e algoritmo alternativo continuam na matriz de expansão. Rastreia `SEC-JWT-001` e `SEC-JWT-002`.

### `SAC-AUTH-003` — JWT expirado (`AUTOMATABLE`, PASS integrado)

```gherkin
Scenario: Token expirado não autentica
  Given um JWT corretamente assinado cujo exp está no passado
  When o token é enviado a um endpoint protegido
  Then a resposta deve ser 401
  And nenhum dado protegido deve ser retornado
```

Rastreia `SEC-JWT-002`.

### `SAC-AUTH-004` — issuer e audience (`AUTOMATABLE`, issuer PASS; audience TARGET)

```gherkin
Scenario Outline: Claims de origem incorretos são rejeitados
  Given um JWT corretamente assinado com <claim> incorreto
  When o token é enviado a um endpoint protegido
  Then a resposta deve ser 401

Examples:
  | claim |
  | issuer |
  | audience quando exigida pela configuração aprovada |
```

Issuer incorreto é rejeitado e coberto no integrado. Audience permanece condicionada à decisão/configuração aprovada. Rastreia `SEC-JWT-003`.

### `SAC-AUTH-005` — usuário desativado com token existente (`AUTOMATABLE`, PASS integrado)

```gherkin
Scenario: Desativação revoga acesso funcional
  Given um usuário ativo com JWT válido já emitido
  And um ADMIN desativa esse usuário
  When o usuário chama qualquer endpoint protegido com o token anterior
  Then a operação deve ser negada
  And nenhum dado protegido deve ser retornado
```

Rastreia `SEC-AUTH-002` e `SEC-JWT-006`.

### `SAC-AUTH-006` — abuso de login (`AUTOMATABLE`, TARGET)

```gherkin
Scenario: Tentativas repetidas são limitadas sem registrar credencial
  Given várias tentativas inválidas contra a mesma identidade ou origem
  When o limite configurado é excedido
  Then novas tentativas devem ser temporariamente limitadas
  And a resposta não deve confirmar se o e-mail existe
  And o evento de segurança não deve conter a senha
```

Rastreia `SEC-AUTH-004` e `SEC-LOG-002`.

### `SAC-AUTH-007` — segredo JWT inválido (`AUTOMATABLE`, CURRENT parcial + TARGET)

```gherkin
Scenario Outline: Produção falha fechada com segredo JWT inseguro
  Given o perfil de produção com APP_JWT_SECRET <condition>
  When a aplicação inicia
  Then o startup deve falhar com mensagem não sensível

Examples:
  | condition |
  | ausente |
  | vazio |
  | menor que o mínimo aprovado |
  | igual ao placeholder conhecido |
  | igual ao segredo público de desenvolvimento |
```

Ausência/vazio/mínimo de 32 caracteres e duração positiva são validados na configuração integrada; rejeição de todo placeholder conhecido e secret store continuam TARGET. Rastreia `SEC-JWT-004` e `SEC-SECRETS-002`.

## 3. Autorização por recurso

### `SAC-AUTHZ-001` — calendário invisível (`AUTOMATABLE`)

```gherkin
Scenario Outline: Trocar calendarId não concede acesso
  Given um USER autenticado que não é membro do calendário A
  When ele chama <operation> usando o ID do calendário A
  Then a resposta deve ser 403 ou 404 conforme o contrato
  And nenhum nome, membro, evento, total ou audit log de A deve ser retornado

Examples:
  | operation |
  | GET /api/events no intervalo |
  | GET /api/calendars/{id}/members |
  | GET /api/finance/summary |
  | GET /api/events/client-revenue |
  | GET /api/audit-logs |
```

Rastreia `SEC-AUTHZ-001` e `SEC-AUTHZ-002`.

### `SAC-AUTHZ-002` — evento de outro calendário (`AUTOMATABLE`)

```gherkin
Scenario Outline: Trocar eventId não concede operação
  Given um usuário sem acesso ao calendário do evento A
  When ele chama <operation> com eventId de A
  Then a resposta deve ser 403 ou 404 conforme o contrato
  And nenhum campo do evento deve ser retornado
  And o evento não deve ser alterado

Examples:
  | operation |
  | GET /api/events/{eventId} |
  | PUT /api/events/{eventId} |
  | DELETE /api/events/{eventId} |
  | PUT /api/events/{eventId}/payment |
  | POST /api/events/{eventId}/approve |
  | POST /api/events/{eventId}/reject |
```

Rastreia `SEC-AUTHZ-003`.

### `SAC-AUTHZ-003` — membro cruzado (`AUTOMATABLE`)

```gherkin
Scenario Outline: memberId deve pertencer ao calendarId
  Given um calendar ADMIN autorizado no calendário A
  And um membro M pertencente somente ao calendário B
  When o ADMIN tenta <operation> em /api/calendars/A/members/M
  Then a resposta deve ser 404
  And o membro M não deve ser alterado

Examples:
  | operation |
  | PUT para alterar role |
  | DELETE para remover |
```

Rastreia `SEC-AUTHZ-004`.

### `SAC-AUTHZ-004` — proteção do owner (`AUTOMATABLE`, PASS integrado)

```gherkin
Scenario: Owner não pode ser removido
  Given o vínculo do owner de um calendário
  When um administrador tenta removê-lo
  Then a resposta deve ser 400
  And o vínculo e o owner devem permanecer inalterados
```

```gherkin
Scenario Outline: Owner não pode ser rebaixado de ADMIN
  Given o vínculo ADMIN do owner de um calendário
  When um administrador tenta definir <role> por update ou upsert
  Then a resposta deve ser 400
  And o vínculo do owner deve permanecer ADMIN

Examples:
  | role |
  | VIEWER |
  | EDITOR |
  | FINANCE |
```

Update e upsert de rebaixamento estão cobertos no integrado. Rastreia `SEC-AUTHZ-004`.

### `SAC-AUTHZ-005` — endpoints administrativos (`AUTOMATABLE`)

```gherkin
Scenario Outline: Usuário sem capacidade administrativa é negado
  Given um usuário autenticado sem a capacidade exigida
  When ele chama <endpoint>
  Then a resposta deve ser 403 ou 404 conforme o contrato
  And nenhum dado administrativo deve ser retornado

Examples:
  | endpoint |
  | GET /api/users |
  | POST /api/users |
  | PUT /api/users/{userId} |
  | POST /api/calendars/{calendarId}/members |
  | PUT /api/calendars/{calendarId}/members/{memberId} |
  | DELETE /api/calendars/{calendarId}/members/{memberId} |
  | GET /api/audit-logs |
```

Rastreia `SEC-AUTHZ-005`.

### `SAC-AUTHZ-006` — endpoint financeiro (`AUTOMATABLE`)

```gherkin
Scenario Outline: Papel sem finanças não recebe resumo
  Given um membro com papel <role> e sem capacidade financeira aprovada
  When ele chama GET /api/finance/summary para seu calendário
  Then a resposta deve ser 403
  And nenhum valor financeiro deve ser retornado

Examples:
  | role |
  | VIEWER |
  | EDITOR |
```

Rastreia `SEC-AUTHZ-006`.

### `SAC-AUTHZ-007` — redação financeira em eventos (`AUTOMATABLE`, PASS integrado)

```gherkin
Scenario Outline: Visualização de evento não implica acesso financeiro
  Given um membro que pode visualizar o evento
  And esse membro não possui capacidade financeira ou de pagamento aprovada
  When ele chama <endpoint>
  Then a resposta não deve conter amount
  And a resposta não deve conter receivedAmount
  And a resposta não deve conter paymentStatus
  And a resposta não deve conter paymentMethod
  And a resposta não deve conter paidAt

Examples:
  | endpoint |
  | GET /api/events no intervalo |
  | GET /api/events/{eventId} |
  | GET /api/events/pending-approvals |
```

Ausência/presença por capacidade foi validada no backend e a UI omite dados/controles quando o contrato vem redigido. Quem possui capacidade de pagamento continua dependente de Q-005. Rastreia `SEC-AUTHZ-006` e `SEC-DATA-001`.

### `SAC-AUTHZ-008` — membro SHARED revogado (`AUTOMATABLE`, PASS multi-repositório)

```gherkin
Scenario: Remoção do calendário revoga uma pendência SHARED
  Given um usuário ativo é alvo de aprovação de um evento SHARED no calendário A
  And um administrador remove esse usuário do calendário A
  When o usuário lista suas pendências
  Then o evento de A não deve ser retornado
  When o usuário tenta aprovar ou rejeitar o evento pelo ID
  Then a resposta deve ser 403 ou 404 conforme o contrato
  And o status do evento deve permanecer inalterado
  And nenhum detalhe do evento deve ser retornado
```

Rastreia `SEC-AUTHZ-007`.

### `SAC-AUTHZ-009` — edição SHARED (`PENDING`, Q-004)

```gherkin
Scenario: Política de edição SHARED segue a decisão aprovada
  Given Q-004 foi resolvida com atores, campos e transições permitidos
  When criador, alvo, calendar ADMIN e global ADMIN tentam editar cada estado SHARED
  Then somente a matriz aprovada deve ser aceita
  And mudança material deve seguir a regra aprovada de nova autorização
```

Este cenário não recebe `PASS` antes de Q-004. Rastreia `SEC-AUTHZ-008`.

### `SAC-AUTHZ-010` — alteração de pagamento (`PENDING`, Q-005)

```gherkin
Scenario: Política de alteração de pagamento segue a decisão aprovada
  Given Q-005 definiu a capacidade de pagamento
  When ADMIN, FINANCE, EDITOR, VIEWER e autor tentam alterar um CLIENT
  Then somente os atores aprovados devem receber sucesso
  And os demais devem receber 403 sem valores financeiros
```

Este cenário não recebe `PASS` antes de Q-005. Rastreia `SEC-AUTHZ-009`.

## 4. Contratos, dados e validação

### `SAC-DATA-001` — senha e hash ausentes (`AUTOMATABLE`)

```gherkin
Scenario Outline: API de usuário nunca retorna segredo de autenticação
  Given um ator autorizado chama <endpoint>
  When a resposta JSON é produzida
  Then nenhum objeto deve conter password
  And nenhum objeto deve conter passwordHash
  And nenhum objeto deve conter credencial ou segredo JWT

Examples:
  | endpoint |
  | GET /api/auth/me |
  | GET /api/users |
  | POST /api/users |
  | PUT /api/users/{userId} |
```

Rastreia `SEC-AUTH-003` e `SEC-DATA-002`.

### `SAC-DATA-002` — erro seguro (`AUTOMATABLE`)

```gherkin
Scenario Outline: Erro não revela implementação
  Given uma requisição que provoca <error>
  When a API responde
  Then o corpo deve seguir o envelope de erro aprovado
  And não deve conter stack trace
  And não deve conter SQL, classe Java, caminho de arquivo ou metadata do banco
  And não deve conter senha, token ou variável de ambiente

Examples:
  | error |
  | validação 400 |
  | autenticação 401 |
  | autorização 403 |
  | recurso 404 |
  | conflito 409 |
  | falha interna controlada 500 |
```

Rastreia `SEC-API-002` e `SEC-API-003`.

### `SAC-DATA-003` — limites de texto (`AUTOMATABLE`, TARGET)

```gherkin
Scenario Outline: Campo textual respeita limite no backend
  Given um payload com <field> acima do máximo especificado
  When a API recebe o payload
  Then a resposta deve ser 400
  And nenhuma linha deve ser persistida ou alterada

Examples:
  | field |
  | fullName |
  | email |
  | title |
  | clientName |
  | personName |
  | description |
  | workDescription |
  | approvalRequestedFromEmail |
```

Rastreia `SEC-API-004`, `SEC-INPUT-001` e `SEC-INPUT-002`.

### `SAC-DATA-004` — precisão e coerência financeira (`AUTOMATABLE`, CURRENT parcial + TARGET)

```gherkin
Scenario Outline: Snapshot financeiro inconsistente é rejeitado
  Given um evento CLIENT de amount 100.00 com pagamento coerente
  When o cliente tenta <change>
  Then a resposta deve ser 400 ou 409 conforme o contrato
  And amount, receivedAmount e paymentStatus persistidos devem permanecer coerentes
  And pendingAmount nunca deve ficar negativo por essa alteração

Examples:
  | change |
  | registrar receivedAmount com mais de duas casas decimais |
  | reduzir amount abaixo do receivedAmount |
  | mudar eventType preservando pagamento incompatível |
  | marcar PARTIALLY_PAID com valor que arredonda para zero |
  | marcar PARTIALLY_PAID com valor que arredonda para amount |
```

O integrado cobre precisão inválida e as alterações comuns que reduziriam amount ou preservariam pagamento em tipo incompatível. A matriz completa de transições de pagamento, constraints PostgreSQL equivalentes e concorrência continuam pendentes. Rastreia `SEC-INPUT-003` e `SEC-DB-003`.

### `SAC-DATA-005` — audit trail sem segredos (`AUTOMATABLE`)

```gherkin
Scenario: Operações críticas não colocam segredos na auditoria
  Given login, criação de usuário e operações mutáveis são exercitados com valores sentinela
  When logs internos e audit_logs são inspecionados
  Then senha, hash, JWT, Authorization e credenciais do banco não devem aparecer
  And as operações de negócio exigidas devem possuir ator, ação e timestamp
```

Rastreia `SEC-LOG-001`, `SEC-LOG-002` e `SEC-LOG-003`.

### `SAC-DATA-006` — health mínimo (`AUTOMATABLE`)

```gherkin
Scenario: Health público não expõe detalhes
  When um cliente anônimo chama GET /api/health
  Then a resposta deve ser 200 quando a política de saúde for satisfeita
  And não deve conter versão, stack, banco, variável de ambiente ou credencial
```

Rastreia `SEC-API-005`.

## 5. HTTP, CORS e CSRF

### `SAC-HTTP-001` — HTTPS em produção (`MANUAL` + `AUTOMATABLE` no deploy)

```gherkin
Scenario: Boundary público de produção exige TLS
  Given o ambiente de produção publicado
  When o cliente tenta acessar a aplicação por HTTP
  Then a conexão deve ser redirecionada com segurança para HTTPS ou rejeitada
  And credencial ou conteúdo sensível nunca deve trafegar em HTTP
  When o cliente acessa por HTTPS
  Then o certificado deve ser válido para o host
  And HSTS deve ser emitido conforme a política aprovada
```

Rastreia `SEC-HTTP-001` e `SEC-HTTP-002`.

### `SAC-HTTP-002` — CORS allowlist (`AUTOMATABLE`)

```gherkin
Scenario Outline: CORS diferencia origem aprovada e não aprovada
  Given uma requisição preflight da origem <origin>
  When ela solicita método e headers permitidos
  Then o backend deve <result>
  And nunca deve combinar Access-Control-Allow-Origin wildcard com credentials true

Examples:
  | origin | result |
  | origem configurada para o ambiente | retornar somente a allowlist necessária |
  | origem não configurada | omitir autorização CORS e impedir leitura pelo browser |
```

Rastreia `SEC-HTTP-004`.

### `SAC-HTTP-003` — premissa CSRF (`AUTOMATABLE` + revisão arquitetural)

```gherkin
Scenario: Autenticação atual não usa credencial automática do browser
  Given o fluxo de login atual
  When a sessão é estabelecida e APIs são chamadas
  Then o backend não deve emitir cookie de autenticação
  And o token deve ser aceito somente no header Authorization bearer
  And uma requisição cross-site sem esse header não deve autenticar
```

```gherkin
Scenario: Migração futura para cookie reabre proteção CSRF
  Given uma proposta para autenticar por cookie
  When a arquitetura é revisada
  Then a mudança não pode ser aprovada sem proteção CSRF, atributos de cookie e testes correspondentes
```

Rastreia `SEC-HTTP-005`.

### `SAC-HTTP-004` — headers de segurança (`AUTOMATABLE`, TARGET)

```gherkin
Scenario: Resposta publicada contém headers coerentes
  Given a aplicação acessada pelo boundary de produção
  When frontend e API respondem
  Then X-Content-Type-Options deve impedir sniffing
  And framing deve ser negado salvo origem explicitamente aprovada
  And Referrer-Policy deve limitar vazamento
  And o frontend deve possuir Content-Security-Policy testada
```

Rastreia `SEC-HTTP-003` e `SEC-FRONT-002`.

## 6. Banco de dados

### `SAC-DB-001` — privilégio mínimo (`AUTOMATABLE` em PostgreSQL real, TARGET)

```gherkin
Scenario: Role runtime não é administrativa
  Given o PostgreSQL inicializado com roles separadas
  When os atributos e privilégios da role runtime são consultados
  Then rolsuper deve ser false
  And rolcreaterole deve ser false
  And rolcreatedb deve ser false
  And a role não deve ser owner do cluster nem de objetos fora do escopo necessário
  And CRUD necessário da aplicação deve continuar funcionando
```

```gherkin
Scenario: Role runtime não executa migration administrativa
  Given uma migration que exige DDL
  When a role runtime tenta aplicá-la
  Then a operação deve ser negada
  And a role de migration aprovada deve conseguir aplicá-la
```

Rastreia `SEC-DB-002` e `SEC-DB-005`.

### `SAC-DB-002` — SQL injection (`AUTOMATABLE` + revisão estática)

```gherkin
Scenario Outline: Entrada permanece parâmetro de consulta
  Given um usuário autorizado informa <input> contendo metacaracteres SQL
  When o endpoint executa a busca
  Then a entrada deve ser tratada como valor literal
  And a consulta não deve alterar estrutura, autorização ou dados
  And nenhum erro SQL interno deve ser retornado

Examples:
  | input |
  | termo de busca |
  | e-mail |
  | filtro de auditoria |
```

Rastreia `SEC-DB-001`.

### `SAC-DB-003` — exposição de rede (`MANUAL`, PASS configuração local + TARGET produção)

```gherkin
Scenario: PostgreSQL não fica exposto além do ambiente pretendido
  Given a stack de desenvolvimento iniciada
  When as portas publicadas são inspecionadas
  Then PostgreSQL deve estar vinculado somente à interface local necessária
  And a documentação deve alertar que produção não publica a porta do banco
```

`compose.yaml` usa `${BIND_ADDRESS:-127.0.0.1}` para PostgreSQL, backend e frontend; a validação de deploy produtivo continua separada. Rastreia `SEC-DB-004` e `SEC-AUTH-006`.

### `SAC-DB-004` — concorrência de aprovação (`AUTOMATABLE`, TARGET)

```gherkin
Scenario: Aprovar e rejeitar simultaneamente não produz dois sucessos
  Given um evento SHARED em PENDING_APPROVAL
  When duas transações concorrentes tentam aprovar e rejeitar
  Then somente uma transição deve ser persistida
  And a outra operação deve receber conflito controlado
  And a auditoria deve refletir somente a transição efetiva
```

Rastreia `SEC-DB-006`.

## 7. Segredos e dependências

### `SAC-SECRETS-001` — repositório sem segredo (`AUTOMATABLE`)

```gherkin
Scenario: Somente templates de configuração são versionados
  Given todos os arquivos rastreados nos três repositórios
  When secret scan e inspeção de nomes são executados
  Then nenhum .env real, chave privada, token, senha ou segredo deve ser encontrado
  And .env deve estar ignorado
  And .env.example deve conter somente placeholders
```

Rastreia `SEC-SECRETS-001` e `SEC-SECRETS-003`.

### `SAC-SECRETS-002` — rotação (`MANUAL`, TARGET)

```gherkin
Scenario: Segredo comprometido pode ser rotacionado
  Given suspeita de comprometimento do segredo JWT ou do banco
  When o runbook de rotação é executado
  Then o valor anterior deve deixar de conceder novo acesso
  And nenhum valor deve ser incluído em Git, output de CI ou relatório
  And a aplicação deve recuperar operação com o novo segredo
```

Rastreia `SEC-SECRETS-004` e `SEC-JWT-005`.

### `SAC-DEP-001` — gate de dependências (`AUTOMATABLE`, PASS pontual integrado + TARGET contínuo)

```gherkin
Scenario: Dependências vulneráveis são triadas antes da entrega
  Given manifests e lockfiles atuais
  When scanners aprovados consultam advisories atuais
  Then cada finding deve registrar pacote, versão, severidade e aplicabilidade
  And nenhuma vulnerabilidade aplicável S0 ou S1 pode permanecer aberta
  And exceção deve possuir risco aceito, controle compensatório, responsável e prazo
```

Execução de 2026-08-22: Angular 21.2.21, `npm ci` PASS com 505 pacotes e audits runtime/completo com 0 vulnerabilidades. Automação contínua ainda é TARGET. Rastreia `SEC-DEP-001`, `SEC-DEP-002` e `SEC-DEP-003`.

### `SAC-DEP-002` — atualização segura (`AUTOMATABLE` + revisão, PASS integrado)

```gherkin
Scenario: Atualização de segurança preserva compatibilidade
  Given uma versão corrigida de dependência ou imagem
  When a atualização é proposta
  Then não deve ser usado upgrade major ou fix forçado sem revisão
  And backend, frontend, integração e containers afetados devem passar regressão
  And suppressions devem ser específicas e justificadas
```

Atualização foi deliberada, sem `npm audit fix`, sem major, e preservou 31 testes/build. Rastreia `SEC-DEP-004` e `SEC-DEP-005`.

## 8. Frontend

### `SAC-FRONT-001` — frontend não concede autorização (`AUTOMATABLE`)

```gherkin
Scenario: Chamada manual continua negada
  Given uma ação está oculta por role no frontend
  And o usuário não possui autorização no backend
  When ele envia manualmente a mesma chamada HTTP
  Then o backend deve responder 403 ou 404 conforme o contrato
  And nenhum dado deve ser alterado
```

Rastreia `SEC-FRONT-001`.

### `SAC-FRONT-002` — token e XSS (`AUTOMATABLE` + revisão, TARGET)

```gherkin
Scenario: Conteúdo de usuário não vira HTML executável
  Given título, descrição, cliente, pessoa ou audit summary com markup sentinela benigno
  When o conteúdo é exibido em cada tela consumidora
  Then ele deve ser tratado como texto
  And nenhum script, handler ou URL ativa deve ser criado
  And não deve existir bypass de sanitização sem justificativa e teste dedicado
```

```gherkin
Scenario: Risco do token persistente é controlado
  Given a estratégia atual de localStorage
  When a revisão de release é executada
  Then TTL, CSP, superfícies XSS e logout devem possuir evidência
  And a estratégia não pode migrar para cookie sem reavaliar CSRF
```

Rastreia `SEC-FRONT-002` e `SEC-FRONT-003`.

### `SAC-FRONT-003` — 401 e 403 (`AUTOMATABLE`, PASS integrado)

```gherkin
Scenario Outline: Cliente trata negação sem vazar dados
  Given uma chamada autenticada retorna <status>
  When o interceptor e a tela processam a resposta
  Then o comportamento deve ser <behavior>
  And nenhum detalhe interno deve ser mostrado ou registrado

Examples:
  | status | behavior |
  | 401 | limpar estado autenticado e direcionar para login |
  | 403 | preservar sessão e informar falta de permissão |
```

Os testes também confirmam que bearer só é anexado a `/api` same-origin, um `Authorization` explícito não é sobrescrito e 500 preserva a sessão. Rastreia `SEC-FRONT-004`.

### `SAC-FRONT-004` — storage e URL (`AUTOMATABLE`, TARGET)

```gherkin
Scenario: Dados sensíveis não ficam em superfícies persistentes
  Given os fluxos de evento, pagamento, financeiro e auditoria foram usados
  When storage, URL, console e telemetry são inspecionados
  Then dados pessoais e financeiros não devem ser persistidos sem requisito explícito
  And JWT não deve aparecer em URL, console ou analytics
```

Rastreia `SEC-FRONT-005`.

## 9. Gate de aceite

Uma entrega de feature só pode declarar segurança concluída quando:

- todos os critérios aplicáveis possuem evidência reproduzível;
- cenários negativos executam, não apenas o caminho feliz;
- `S0 OPEN = 0` e `S1 OPEN = 0`, salvo risco formalmente aceito;
- critérios `PENDING` continuam visíveis e não são marcados como aprovados;
- testes não registram valores sensíveis;
- PostgreSQL real complementa H2 para migrations, constraints e privilégios;
- a mesma regressão relevante passa no backend standalone e na integração.

### Registro de execução multi-repositório — 2026-08-22

- `S0 OPEN = 0` e `S1 OPEN = 0`;
- backend: 16 testes PASS;
- frontend: 31 testes em 12 arquivos PASS;
- build frontend: PASS, 9 rotas prerenderizadas, 4 avisos de budget CSS;
- dependências frontend: `npm ci` PASS no integrado e standalone, audit runtime e completo = 0;
- Q-004 e Q-005 permanecem `PENDING`, sem decisão implícita;
- riscos S2/S3 permanecem rastreados;
- paridade oficial: backend 84/84 e frontend 76/76;
- as mesmas suítes passaram nos standalones: backend 16 testes e frontend 31 testes em 12 arquivos;
- stack reconstruída a partir dos standalones: três serviços saudáveis em loopback, health direto/proxy e regressão de autenticação/autorização PASS.
