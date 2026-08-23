# 18 — Plano de implementação e estabilização

## Linha funcional

### Phase 0 — Decisões de produto

Resolver Q-001–Q-006; fechar BR-EVT-004, matriz TARGET e transições SHARED/PAY. Risco alto: mudanças de autorização podem bloquear usos atuais.

### Phase 1 — Domínio e banco funcional

Se aprovado, modelar owner/responsável/serviço e invariantes; criar migrations posteriores a V7, nunca reescrever a baseline PostgreSQL aplicada. Aceites: AC-PERSONAL-002 e AC-CLIENT-001.

### Phase 2 — Backend/autorização

Centralizar política própria/terceiro, remover ambiguidades SHARED e separar permissão de pagamento se decidido. O cancelamento persistente já foi implementado e testado.

### Phase 3 — Frontend operacional

Gestão de membros e Finance foram concluídos no integrado. O interceptor e a navegação Finance agora respeitam origem/capacidade. Próximas unidades: users, audit, estados assíncronos remanescentes e guards/menus ainda não cobertos.

### Phase 4 — Automação

Expandir testes unitários, integração, repository e E2E, priorizando autorização, consentimento, dinheiro e auditoria.

## Linha de infraestrutura multi-repositório

### Phase I — PostgreSQL e containerização — concluída

- PostgreSQL 17.11 operacional.
- Flyway V1–V7 aplicado.
- Dados migrados e validados: 6/4/10/11/11.
- Docker engine operacional após habilitação de NX Mode e SVM Mode.

### Phase II — Separação física — concluída

- Manter monorepo como contexto integrado e fonte SDD.
- Manter backend e frontend deployable diretamente nas raízes standalone.
- Preservar cada `.git`; proibir metadata Git aninhada.

### Phase III — Sincronização e Compose — concluída

1. Sincronizar código/configuração sem copiar artefatos ou `.git`.
2. Executar o verificador de paridade por caminho relativo e hash.
3. Renderizar o Compose e comprovar os contextos standalone.
4. Construir cada Dockerfile a partir da raiz standalone.
5. Subir a stack e executar saúde, login e regressão mínima.

Resultado histórico da Phase III: paridade backend `80/80` e frontend `74/74` após exclusões normativas, stack saudável e regressão mínima aprovada. Após o incremento integrado de 2026-08-22, a sincronização oficial foi repetida e confirmou paridade backend `84/84` e frontend `76/76`; as suítes standalone passaram com 16 testes backend e 31 frontend, o build SSR concluiu com 9 rotas e os audits npm runtime/completo retornaram zero vulnerabilidades. A stack reconstruída a partir dos standalones permaneceu com os três serviços `healthy`, portas em loopback e regressão HTTP/autorização aprovada.

### Phase IV — Acesso local — concluída

- Login API dos seis usuários de desenvolvimento: confirmado.
- Perfil PostgreSQL/DBeaver: documentado sem senha real.
- Login real pelo frontend no Edge headless: confirmado, com carregamento do calendário.
- Conexão real pelo DBeaver 26.1.5: confirmada com driver PostgreSQL 42.7.13 por sessões TCP e `pg_stat_activity`; senha não salva.

### Phase V — Commits — concluída nesta entrega

Todos os gates técnicos anteriores passaram. Backend e frontend receberam commits independentes e seus SHAs foram verificados. O commit da integração/SDD é o commit que contém este relatório; seu SHA é reportado no handoff, pois não pode ser autorreferenciado. Nenhum push faz parte desta entrega.

## Próxima ação

Prosseguir com a página administrativa de usuários, mantendo o gate S0/S1 zerado, e depois atacar Audit e os itens S2/S3 e P1 restantes. Q-004 e Q-005 devem ser decididas antes de qualquer mudança na política CURRENT correspondente.
