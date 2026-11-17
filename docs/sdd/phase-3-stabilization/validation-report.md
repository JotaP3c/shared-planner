# Fase 3.0 — Estabilização crítica

Continuação da auditoria de 17/11/2026; não houve nova auditoria geral do backlog.
Escopo: integridade financeira, autenticação/autorização, concorrência PostgreSQL,
jornada HTTP integrada e dependências. Design System e catálogo de produtos/serviços
não foram alterados. Sem commits ou pushes.

## Integridade financeira

V13 adiciona `ck_events_financial_state`, sem UPDATE/DELETE de eventos:

- CLIENT exige valor e recebido não superior ao valor, além da constraint anterior de não negativo.
- PENDING exige recebido zero e paid_at nulo.
- PARTIALLY_PAID exige recebido positivo e inferior ao valor, método e data.
- PAID exige recebido igual ao valor, método e data (inclui valor zero).
- REFUNDED conserva a semântica existente de recebido líquido zero; histórico segue na auditoria.
- PERSONAL/SHARED não podem carregar pagamento: estado PENDING, recebido zero, método/data nulos.
- CANCELLED não apaga recebimentos anteriores. O serviço continua negando mutações financeiras posteriores.

A migration cria a constraint NOT VALID e valida na mesma transação. Legado incompatível
faz a aplicação abortar atomicamente, preservando os dados; não existe correção silenciosa.
PENDING continua permitindo mudanças de valor conforme o contrato atual. Não foi criada
uma política nova de ledger, estorno parcial ou alteração do histórico (BR-PAY-003).

Locks pessimistas já existentes foram preservados e exercitados com transações separadas:
pagamento × redução de valor, pagamento × cancelamento, dois snapshots de pagamento,
proteção do owner e desativação cruzada de administradores. Dois pagamentos substituem
o snapshot, não somam incrementos: ambos são auditados e o estado final corresponde a
uma ordem serial válida. Um teste observa `pg_stat_activity.wait_event_type='Lock'`
enquanto uma requisição HTTP aguarda o commit de outra transação.

## Autenticação e autorização

- Login limitado por IP do socket, dez tentativas por 60 segundos por padrão.
  Configuração: `app.login-rate-limit.attempts` / `app.login-rate-limit.window-seconds`
  (variáveis Spring `APP_LOGIN_RATE_LIMIT_ATTEMPTS` / `APP_LOGIN_RATE_LIMIT_WINDOW_SECONDS`).
- Janela concorrente sincronizada, até 10.000 clientes ativos, descarte por expiração,
  resposta 429 genérica e Retry-After. X-Forwarded-For não é confiado; outros endpoints
  não gastam esse orçamento. Teste concorrente prova três admitidos em oito tentativas
  para limite três; HTTP real prova 429 e health ainda acessível.
- A tela de login distingue429 de credencial inválida, libera o estado de envio e
  informa em português para aguardar. Não há retry automático nem alteração visual/DS.
- Limite é por processo: proxy/NAT compartilha IP e múltiplas instâncias não compartilham
  contador. Ajuste de topologia/distribuição é hardening operacional, não uma garantia inventada.
- Falhas de autenticação emitem apenas tipo de evento; bloqueio emite evento uma vez
  por janela. LoginRequest/LoginResponse ocultam credenciais/JWT em toString, preservando
  JSON. Testes verificam que principal, senha, token e mensagem da exceção não vazam.
- DispatcherType.ERROR é permitido somente para preservar o status MVC original no
  dispatch interno. Requests normais protegidos continuam exigindo JWT; login malformado
  agora preserva 400, credencial inválida retorna 401 e recurso negado 403/404.
- O teste de aprovação × remoção revelou 400 por estado já decidido antes de validar
  o vínculo revogado. A autorização foi antecipada à checagem de estado: após remoção,
  aprovar/rejeitar nega acesso sem revelar a situação do evento. Uma operação sobreposta
  pode concluir se autorizada antes da revogação; chamadas posteriores com o mesmo token
  são negadas. Consenso, papéis, grants e compatibilidade LEGACY permanecem iguais.
- Testes cobrem token adulterado, ausência de token, conta desativada com token antigo,
  BOLA/financeiro/Excel/usuários/auditoria, revogação, owner e último administrador.
  Políticas de sessão/logout global e decisões de produto abertas não foram alteradas.

## PostgreSQL, backup e legado

PostgreSQL 17.11 isolado em 127.0.0.1:54629. Bancos permitidos por guardas dos testes:
`audit_migration_test`, `phase3_stabilization_test` e destino de restore
`phase3_backup_restore`. Nenhum teste destrutivo aceita shared_planner ou porta 5432.
Limpeza TRUNCATE ocorre exclusivamente no banco sintético phase3_stabilization_test.

Antes das migrations: pg_dump custom, catálogo pg_restore e SHA256 em diretório privado.
O helper cria novos backups antes de upgrades de schema. Backups de V12 com registros
sintéticos válidos e inválidos são restaurados em outro banco e conferidos por valores
e versão Flyway. Teste comprova conservação de legado válido e rollback da V13 sobre
estado inválido, mantendo V12 e o valor original incompatível. V1–V13 e repetição sem
novas migrations são exercitados em PostgreSQL, não inferidos a partir do H2.

Também foi feito backup preventivo do desenvolvimento local usando o script existente,
antes da sincronização dos fontes. Snapshot: 158.725 bytes, 116 entradas no catálogo,
SHA256 em metadata privada. Preflight somente leitura: V12, 372 eventos e zero estados
incompatíveis com V13. Nenhuma migration/correção foi aplicada por esta entrega ao banco
local em uso; nenhuma linha real foi alterada. Esse preflight não substitui backup fresco
e nova verificação caso haja escrita antes de uma aplicação futura.

## Jornada integrada

Spring Boot em porta aleatória + HttpClient real + PostgreSQL + Flyway:
login → listar calendário pessoal → criar CLIENT de 100 → confirmar → receber 40 →
Finance com 100 previsto/40 recebido/60 pendente → baixar XLSX e ler os mesmos números
com Apache POI, quatro abas e três gráficos nativos. A mesma URL é negada a terceiro.
SHARED é criado, aprovado e rejeitado; remoção de membro e aprovação são sobrepostas,
e o token antigo perde a capacidade após revogação. Não há mocks HTTP nessa jornada.

É integração de API/servidor/banco. O smoke Playwright separado usa fixtures e não é
chamado de E2E browser integrado; este último e o gate CI seguem em BLG-TEST-009.

## Dependências

Consultas atuais ao registry npm e `npm explain` foram preservadas em JSON privado.
Sem audit fix --force, override incompatível ou troca major de pacote direto.

| Pacote/cadeia | Antes → depois | Resultado |
|---|---|---|
| Angular build/CLI/SSR | 21.2.29 → 21.2.30 | Patch na linha existente |
| Vitest e módulos próprios | 4.1.6 → 4.1.12 | Mesmo major; regressão executada |
| baseline-browser-mapping | 2.10.29 → 2.11.38 | Faixa compatível |
| brace-expansion | 5.0.9 → 5.0.13 | Patch |
| browserslist | 4.28.2 → 4.29.6 | Mesmo major |
| fast-uri | 3.1.5 → 3.1.9 | Patch |
| hono / @hono/node-server | 4.13.3 → 4.13.19 / 2.1.1 → 2.1.9 | Faixas compatíveis |
| ip-address / undici transitivo | 10.5.0 → 10.7.6 / 6.28.0 → 6.29.1 | Faixas compatíveis |
| source-map-js | 1.2.1 → 1.2.2 | Patch |
| @parcel/watcher | 2.5.6 → 2.5.1 | Resolução compatível escolhida pelo audit fix sem force; mudança explícita no lock |

Auditoria completa: **38 → 29 entradas** (15 altas, 14 moderadas, zero críticas).
Auditoria runtime: **zero → zero**. Entradas transitivas/metavulnerabilidades não são
29 falhas independentes da aplicação. Restam três causas diretas:

| Causa | Caminhos reais relevantes | Versão corrigida / impedimento |
|---|---|---|
| glob 13.0.7 | CLI → pacote/@npmcli/package-json ou cacache → glob | Advisory até 14.0.1; registry 14.0.6 disponível, fora dos ranges ^13 dos pais |
| minimatch 10.2.6 | CLI → glob, ignore-walk ou @tufjs/models → minimatch | Corrigido a partir de 11.0.1; registry 11.0.9, fora dos ranges ^10 atuais |
| picomatch 2.3.2/4.0.4 | micromatch → 2.3.2; Angular build/core, Vite, Vitest, tinyglobby → 4.0.4 | Advisory inclui até 4.0.7; registry latest 4.0.7 nesta consulta; core/build fixam 4.0.4 |

Referências dos advisories: [glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4),
[minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249),
[picomatch](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).
Não foi aceito o downgrade sugerido para Angular CLI16.2.0. SEC-005 permanece aberto
como BUG com mitigação parcial; não se declara audit completo limpo. A correção residual
exige atualização dos pais ou compatibilidade dedicada aprovada, sem forçar majors aqui.

O npm10.9 instalado e o npm11.3 declarado falharam no resolvedor `edgesOut`. A proposta
de lock foi gerada em diretório privado com npm11.21.2 e aplicada com npm ci reproduzível.
Nenhuma instalação global foi modificada. O servidor Angular deste checkout precisou
ser parado para liberar esbuild.exe no Windows e foi reiniciado após os builds.

## Validação final

| Verificação executada | Resultado |
|---|---|
| `mvnw.cmd clean test` com os dois opt-ins PostgreSQL | **166 testes, zero falhas/erros/skips** |
| PostgreSQL real dentro da suíte completa | 13 testes: duas migrations/legado/restore e11 de HTTP/concorrência; PostgreSQL 17.11 |
| Autenticação local/observabilidade | Quatro testes unitários adicionais, incluindo limite concorrente e redaction |
| `npm.cmd ci` | PASS com package-lock atualizado |
| `npm.cmd test -- --watch=false` | **198/198**, 28 arquivos, Vitest 4.1.12, incluindo429 |
| `npm.cmd run build -- --configuration production --stats-json` | PASS; 425,94 kB initial,106,03 kB transferência estimada; uma rota pré-renderizada; sem warning de budget |
| Smoke Playwright pós-atualização | Oito combinações de tema/resolução, dois cenários de perfis, sistema/storage/reload e quatro downloads XLSX PASS |
| `npm audit --json` / `--omit=dev` |29 entradas dev / zero runtime; residual explicitamente aberto |
| Sync oficial, preview/Apply | PASS, sem exclusões; backend 156/156 e frontend 159/159 arquivos |
| Build do frontend standalone atualizado | PASS após npm ci; mesmo código e lockfile |
| TypeScript explícito | tsc --noEmit PASS |
| Servidor Angular após manutenção | Reiniciado; GET localhost:4200/login HTTP200 |

As rodadas intermediárias não foram usadas como gate final. A primeira identificou
o pipe de saída bloqueado no helper de catálogo (corrigido para arquivo), expectativas
403 versus404 e o dispatch400→401. Uma rodada de compilação durante ajuste de assinatura
do helper produziu NoSuchMethodError; foi descartada e repetida com clean, fontes
estáveis. O último teste de revogação revelou a ordem de autorização descrita acima;
após corrigi-la, a suíte completa final passou. Timeouts não foram aumentados para
transformar falhas em PASS.

Não foi executada uma segunda suíte idêntica no backend standalone em uso pelo IDE:
os fontes são sincronizados e conferidos por hash, preservando os artefatos/runtime
do usuário. A regressão foi executada no monorepo contra bancos isolados.

### Reprodução dos testes PostgreSQL

Requer um cluster de testes próprio em 127.0.0.1:54629, com os três bancos citados acima
e role `planner_test`, configurado somente em loopback. Não apontar para banco de usuário.
Os dumps e restores são gerados automaticamente antes das migrations pelos testes.
Em PowerShell, dentro de `backend` e com JDK17 em JAVA_HOME:

```powershell
$env:PLANNER_MIGRATION_TEST_URL='jdbc:postgresql://127.0.0.1:54629/audit_migration_test'
$env:PLANNER_PHASE3_TEST_URL='jdbc:postgresql://127.0.0.1:54629/phase3_stabilization_test'
$env:PLANNER_TEST_PG_BIN=Join-Path $env:USERPROFILE 'postgres-local\pgsql\bin'
$env:PLANNER_PHASE3_EVIDENCE='C:\shared-planner-private\qa-evidence\phase-3-retest'
.\mvnw.cmd clean test
```

Sem os opt-ins, esses testes são ignorados e o resultado não fecha o gate PostgreSQL.
O helper usa ferramentas PostgreSQL Windows disponíveis nesse binário; portabilidade
do executor para outro SO/CI precisa ser adaptada antes de declarar esse ambiente validado.

Evidências privadas: `C:\shared-planner-private\qa-evidence\phase-3-20261117`.
Incluem logs Maven/Angular, JSON de audits/caminhos, snapshots, dumps, SHA256 e capturas.
Não publicar esses artefatos ou configurações privadas nos repositórios.
O cluster PostgreSQL isolado foi parado após os testes, mantendo dumps e evidências.

## Limites e gates

Gates financeiros P0 (BE-001/TEST-001) e autenticação do escopo atual (BE-005), owner/
revogação/concorrência (TEST-006) estão encerrados no código validado. SEC-015 encerra
somente o recorte financeiro: retenção e operação continuam PARTIAL. TEST-004/005
ganham provas reais, mantendo PARTIAL pelos critérios mais amplos fora desta entrega;
TEST-009 mantém PARTIAL porque o browser integrado/CI não foi substituído por HTTP.

**Etapa 3.1 liberada para desenvolvimento**, sobre esta base e com regressão preservada.
Antes de iniciar o backend atualizado em banco em uso, aplicar o procedimento de backup
e preflight para V13; não se declara esse banco já migrado. As 29 entradas dev residuais
estão triadas e abertas, não são removidas por força para obter um contador zero.
Produção, sessão global, política de senha adicional, TLS, retenção de auditoria,
monitoramento distribuído e CI não são implicitamente homologados por este incremento.
