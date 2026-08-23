# Shared Planner

Shared Planner é uma aplicação de agenda compartilhada com autenticação, calendários multiusuário, eventos pessoais, atendimentos de clientes, aprovação de eventos compartilhados, pagamentos, financeiro e auditoria.

## Stack atual

- Backend: Java 17, Spring Boot 4, Security/JWT, JPA, Flyway e PostgreSQL 17.
- Frontend: Angular 21.2.21 com SSR e FullCalendar.
- Infraestrutura local: Docker Compose com PostgreSQL, backend e frontend.
- Especificação: Spec-Driven Development em [`docs/sdd`](docs/sdd/README.md).

[![Java 17](https://img.shields.io/badge/Java-17-ED8B00?logo=openjdk&logoColor=white)](backend/README.md)
[![Spring Boot 4.0.6](https://img.shields.io/badge/Spring%20Boot-4.0.6-6DB33F?logo=springboot&logoColor=white)](backend/README.md)
[![Angular 21.2.21](https://img.shields.io/badge/Angular-21.2.21-DD0031?logo=angular&logoColor=white)](frontend/README.md)
[![PostgreSQL 17](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](docker/postgres.md)
[![Docker Compose](https://img.shields.io/badge/Docker%20Compose-ready-2496ED?logo=docker&logoColor=white)](docker/README.md)
[![License MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Sobre o produto

O Shared Planner foi pensado para casais, profissionais e pequenos grupos que precisam compartilhar compromissos sem perder o controle sobre autoria, acesso e consentimento. A aplicação reúne a agenda operacional e o acompanhamento financeiro em um único fluxo.

O domínio diferencia três tipos de evento:

- <code>CLIENT</code>: atendimento de cliente, com serviço, valor e situação do pagamento;
- <code>PERSONAL</code>: compromisso pessoal dentro de um calendário autorizado;
- <code>SHARED</code>: convite para outro membro, sujeito à aprovação ou rejeição explícita da pessoa solicitada.

Além da agenda, o produto contempla membros e papéis por calendário, busca global, fila de aprovações, indicadores financeiros e trilha de auditoria.

### Estado funcional

O fluxo principal de autenticação e agenda está integrado. O resumo financeiro também foi concluído; Users, Audit e Settings seguem no roadmap e não devem ser interpretados como módulos concluídos. As cópias integradas e os repositórios standalone estão sincronizados e revalidados pelo gate final.

| Área | Estado atual |
|---|---|
| Autenticação | Login por e-mail e senha, JWT, recuperação da identidade atual, proteção de rotas e logout |
| Calendários | Listagem, seleção, cores, filtros e visualizações mensal, semanal e diária |
| Eventos | Criação, consulta, edição e cancelamento lógico de eventos <code>CLIENT</code>, <code>PERSONAL</code> e <code>SHARED</code> |
| Busca | Pesquisa global e navegação até o evento selecionado |
| Aprovações | Fila e ações do usuário convidado enquanto ele permanecer ativo e membro atual do calendário |
| Pagamentos | Consulta e atualização dos dados de pagamento de atendimentos |
| Membros | Inclusão, alteração de papel e remoção conforme autorização; owner não pode ser removido nem rebaixado de <code>ADMIN</code> |
| Financeiro | Resumo de receitas funcional em <code>/finance</code>, com calendários autorizados, períodos civis/custom, oito métricas e estados completos |
| Usuários | API administrativa disponível; a página <code>/admin/users</code> ainda é uma tela-base |
| Auditoria | API e contratos disponíveis; a página <code>/audit</code> ainda é uma tela-base |
| Configurações | Rota <code>/settings</code> reservada para evolução |

Login com Google, criação de conta, recuperação de senha e o comportamento específico de “Lembrar de mim” ainda não possuem integração completa. O estado técnico detalhado está documentado em [Current State](docs/sdd/01-current-state.md), [Frontend Flows](docs/sdd/13-frontend-flows.md) e [Gap Analysis](docs/sdd/17-gap-analysis.md).

## Arquitetura

~~~mermaid
flowchart LR
    U[Usuário] --> W[Angular 21 + FullCalendar]
    W --> N[Node / Express SSR]
    N -->|REST JSON + Bearer JWT| A[Spring Boot API]
    A --> S[Regras de negócio e autorização]
    S --> J[Spring Data JPA]
    J --> P[(PostgreSQL 17)]
    F[Flyway] --> P
~~~

- O frontend entrega a experiência web, o SSR e o proxy de <code>/api</code>.
- O backend é a autoridade final para autenticação, permissões, regras de negócio, auditoria e persistência.
- O Flyway versiona o schema do PostgreSQL antes da validação do modelo JPA.
- O Docker Compose conecta os três serviços, aguarda seus healthchecks e mantém o banco em um volume nomeado.

### Papéis e autorização

Existem dois níveis complementares de papel:

- globais: <code>ADMIN</code>, <code>FINANCE</code> e <code>USER</code>;
- por calendário: <code>ADMIN</code>, <code>FINANCE</code>, <code>EDITOR</code> e <code>VIEWER</code>.

Esses papéis governam criação e edição de eventos, gestão de membros, acesso financeiro e visibilidade. Eventos <code>SHARED</code> só podem ser aprovados ou rejeitados pelo usuário solicitado. Controles visuais do frontend melhoram a experiência, mas toda decisão de acesso é revalidada pela API.

## Organização multi-repositório

O projeto possui três repositórios Git com históricos e ciclos de entrega independentes:

| Repositório | Responsabilidade |
|---|---|
| [<code>shared-planner</code>](https://github.com/JotaP3c/shared-planner) | Integração, especificações SDD, documentação, scripts e Docker Compose |
| [<code>shared-planner-backend</code>](https://github.com/JotaP3c/shared-planner-backend) | API Spring Boot e contexto implantável do backend |
| [<code>shared-planner-frontend</code>](https://github.com/JotaP3c/shared-planner-frontend) | Aplicação Angular, SSR e contexto implantável do frontend |

~~~mermaid
flowchart TB
    I[shared-planner<br/>integração e SDD]
    B[shared-planner-backend<br/>API implantável]
    F[shared-planner-frontend<br/>web implantável]
    I -->|contexto de build| B
    I -->|contexto de build| F
    I -.->|verificação por hash| B
    I -.->|verificação por hash| F
~~~

Para usar os contextos padrão do Compose, mantenha os diretórios lado a lado:

~~~text
C:\git
├── shared-planner
├── shared-planner-backend
└── shared-planner-frontend
~~~

Este repositório também conserva cópias integradas em <code>backend/</code> e <code>frontend/</code> para rastreabilidade. Os builds do Compose usam, por padrão, os repositórios standalone irmãos definidos no [<code>compose.yaml</code>](compose.yaml).

### Estrutura deste repositório

~~~text
shared-planner/
├── backend/             # cópia integrada da API
├── frontend/            # cópia integrada da aplicação web
├── docker/              # guias de infraestrutura e banco
├── docs/sdd/            # especificações e critérios de aceite
├── scripts/             # verificação e sincronização dos repositórios
├── .env.example         # contrato de configuração local
└── compose.yaml         # orquestração da stack completa
~~~

## Início rápido com Docker

### Pré-requisitos

- Git;
- Docker Desktop com Docker Compose v2;
- virtualização habilitada no firmware e disponível para o Docker;
- portas <code>4200</code>, <code>8080</code> e <code>5432</code> livres, ou portas alternativas configuradas no <code>.env</code>.

Clone os três repositórios na mesma pasta:

~~~powershell
Set-Location C:\git
git clone https://github.com/JotaP3c/shared-planner.git
git clone https://github.com/JotaP3c/shared-planner-backend.git
git clone https://github.com/JotaP3c/shared-planner-frontend.git
~~~

Prepare a configuração local sem sobrescrever um arquivo existente:

~~~powershell
Set-Location C:\git\shared-planner

if (-not (Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}
~~~

Edite o <code>.env</code> e substitua os placeholders por uma senha local e um segredo JWT forte. Em seguida:

~~~powershell
.\scripts\check-repository-sync.ps1
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
~~~

Com as portas padrão:

| Serviço | Endereço |
|---|---|
| Frontend | [http://localhost:4200](http://localhost:4200) |
| Backend | [http://localhost:8080](http://localhost:8080) |
| Healthcheck da API | [http://localhost:8080/api/health](http://localhost:8080/api/health) |
| PostgreSQL | <code>localhost:5432</code> |

Comandos úteis:

~~~powershell
# Acompanhar os serviços
docker compose logs -f

# Acompanhar somente a API
docker compose logs -f backend

# Parar a stack e preservar o banco
docker compose down
~~~

O volume <code>postgres_data</code> mantém os dados após <code>docker compose down</code>. O comando <code>docker compose down -v</code> também remove esse volume e deve ser usado apenas quando a perda dos dados locais for intencional.

Consulte o [guia de Docker](docker/README.md), a [referência do Compose](docker/compose.md) e o [guia de solução de problemas](docker/troubleshooting.md) para os demais cenários.

## Configuração e credenciais

O arquivo [<code>.env.example</code>](.env.example) documenta todas as variáveis aceitas:

| Grupo | Variáveis |
|---|---|
| Rede local | <code>BIND_ADDRESS</code> (padrão seguro: <code>127.0.0.1</code>) |
| PostgreSQL | <code>POSTGRES_DB</code>, <code>POSTGRES_USER</code>, <code>POSTGRES_PASSWORD</code>, <code>POSTGRES_PORT</code> |
| API | <code>BACKEND_PORT</code>, <code>APP_JWT_SECRET</code>, <code>APP_JWT_EXPIRATION_MINUTES</code> |
| Frontend | <code>FRONTEND_PORT</code> |
| Builds | <code>BACKEND_BUILD_CONTEXT</code>, <code>FRONTEND_BUILD_CONTEXT</code> |

O <code>.env</code> real é local e ignorado pelo Git. Não versione senha, segredo JWT, token, credencial de teste ou saída de comandos que revele esses valores. Para validar a sintaxe do Compose sem imprimir a configuração resolvida, prefira:

~~~powershell
docker compose config --quiet
~~~

## Desenvolvimento e testes

Cada componente possui instruções próprias e pode ser desenvolvido de forma independente:

- [README do backend](backend/README.md): perfis, banco, Flyway, API, permissões e testes;
- [README do frontend](frontend/README.md): rotas, SSR, proxy, fluxos e testes.

Validação básica das cópias integradas:

~~~powershell
# Backend
Set-Location C:\git\shared-planner\backend
.\mvnw.cmd test

# Frontend
Set-Location C:\git\shared-planner\frontend
npm.cmd ci
npm.cmd test -- --watch=false
npm.cmd run build
~~~

Os testes unitários não substituem a validação integrada da stack nem os critérios de aceite definidos no SDD. A estratégia completa está em [Test Strategy](docs/sdd/16-test-strategy.md).

Baseline integrada validada em 2026-08-22:

- backend: 16 testes PASS;
- frontend: 31 testes em 12 arquivos PASS;
- build SSR: PASS, 9 rotas prerenderizadas e 4 avisos de budget CSS;
- dependências frontend: Angular 21.2.21, `npm ci` com 505 pacotes e audits runtime/completo com 0 vulnerabilidades.

O gate final multi-repositório de 2026-08-22 confirmou:

- paridade oficial: backend 84/84 e frontend 76/76 arquivos comparáveis;
- standalone backend: 16/16 testes PASS;
- standalone frontend: `npm ci` com 505 pacotes, 31/31 testes, build SSR com 9 rotas/4 avisos e audits runtime/completo = 0;
- Docker: builds backend/frontend PASS, Flyway V7 atualizado e três serviços `healthy`, vinculados a `127.0.0.1` nas portas 5432/8080/4200;
- containers sem root: backend UID 10001 e frontend UID 1000;
- HTTP: frontend, health direto e health via proxy = 200; endpoint protegido sem token = 401;
- autorização: ADMIN passou em login/me/users/audit/finance; VIEWER recebeu 403 em users/finance e resposta CLIENT com campos financeiros omitidos.

Essas evidências valem para os standalones sincronizados e para a integração atual. Riscos S2/S3 e decisões Q-004/Q-005 continuam documentados, sem impedir o gate local concluído.

## Sincronização dos repositórios

Antes de publicar mudanças de backend ou frontend, verifique se a cópia integrada e o repositório standalone correspondente continuam equivalentes:

~~~powershell
Set-Location C:\git\shared-planner
.\scripts\check-repository-sync.ps1
~~~

Para visualizar as operações que seriam aplicadas da cópia integrada para os repositórios standalone:

~~~powershell
.\scripts\sync-repositories.ps1
~~~

Depois de revisar o preview, aplique conscientemente:

~~~powershell
.\scripts\sync-repositories.ps1 -Apply
~~~

Os scripts validam a topologia dos três repositórios e comparam caminhos relativos e hashes SHA-256. Metadados Git, credenciais e artefatos gerados não são sincronizados. Leia a [especificação de sincronização](docs/sdd/26-multi-repository-sync-spec.md) antes de alterar esse fluxo.

## PostgreSQL, Flyway e DBeaver

O PostgreSQL 17 é o banco de runtime. O backend executa migrations Flyway versionadas e valida o modelo JPA; alterações de schema devem ser introduzidas por uma nova migration, nunca por edição manual de uma versão já aplicada.

- [Guia do PostgreSQL](docker/postgres.md)
- [Conexão pelo DBeaver](docker/dbeaver.md)
- [Plano de transferência de dados](docs/sdd/28-postgresql-data-transfer-plan.md)
- [Especificação da migração](docs/sdd/22-postgresql-migration-spec.md)

O DBeaver é apenas uma ferramenta de inspeção e administração: a fonte de verdade do schema continua sendo o Flyway.

## Spec-Driven Development

O projeto é conduzido por Spec-Driven Development (SDD). Requisitos, regras, contratos e critérios de aceite são atualizados antes da implementação correspondente.

~~~text
Visão → estado atual → domínio → regras → permissões
      → contratos → critérios de aceite → testes
      → implementação → validação → rastreabilidade
~~~

Documentos de entrada recomendados:

| Documento | Conteúdo |
|---|---|
| [Índice SDD](docs/sdd/README.md) | Mapa completo e ordem de leitura |
| [Product Vision](docs/sdd/00-product-vision.md) | Problema, público e objetivos |
| [Domain Model](docs/sdd/02-domain-model.md) | Entidades e relacionamentos |
| [Business Rules](docs/sdd/03-business-rules.md) | Regras funcionais centrais |
| [Permissions](docs/sdd/04-permissions.md) | Matriz de papéis e autorização |
| [API Contracts](docs/sdd/11-api-contracts.md) | Endpoints, payloads e respostas |
| [Acceptance Criteria](docs/sdd/15-acceptance-criteria.md) | Critérios verificáveis |
| [Implementation Plan](docs/sdd/18-implementation-plan.md) | Sequência de entrega |
| [Traceability Matrix](docs/sdd/19-traceability-matrix.md) | Relação entre requisitos, código e testes |
| [Development Progress](docs/sdd/21-development-progress.md) | Progresso e próximos incrementos |

Quando houver divergência entre uma expectativa informal e a especificação vigente, registre a decisão no SDD antes de consolidar a mudança em código.

## Segurança

- JWT é enviado somente a <code>/api</code> same-origin pelo interceptor; o backend valida HS256, expiração, issuer e usuário ativo.
- Senhas persistidas devem usar hash; nunca devem aparecer em código, logs ou documentação.
- O backend revalida papéis globais e permissões por calendário em cada operação protegida.
- Campos financeiros de eventos são omitidos quando o ator não possui capacidade; remoção de membership revoga listagem e decisão SHARED.
- Respostas 401 encerram a sessão frontend; 403 e demais falhas não apagam a sessão.
- As portas do Compose usam loopback por padrão; exposição à rede exige alteração consciente de <code>BIND_ADDRESS</code>.
- Healthchecks não devem expor credenciais nem informações sensíveis.
- Imagens de produção executam com usuários não privilegiados sempre que suportado pelo componente.

Este projeto ainda está em evolução. Antes de uso em produção, realize uma revisão específica de segurança, gestão de segredos, observabilidade, backup, restauração e política de atualização de dependências.

## Documentação

| Tema | Referência |
|---|---|
| Infraestrutura local | [<code>docker/README.md</code>](docker/README.md) |
| Topologia dos repositórios | [<code>docker/repositories.md</code>](docker/repositories.md) |
| Backend | [<code>backend/README.md</code>](backend/README.md) |
| Frontend | [<code>frontend/README.md</code>](frontend/README.md) |
| Especificações SDD | [<code>docs/sdd/README.md</code>](docs/sdd/README.md) |
| Auditoria funcional | [<code>docs/sdd/28-functional-completeness-audit.md</code>](docs/sdd/28-functional-completeness-audit.md) |
| Auditoria de segurança | [<code>docs/sdd/31-security-audit-report.md</code>](docs/sdd/31-security-audit-report.md) |
| Backlog priorizado | [<code>docs/sdd/33-development-backlog.md</code>](docs/sdd/33-development-backlog.md) |
| Perguntas em aberto | [<code>docs/sdd/99-open-questions.md</code>](docs/sdd/99-open-questions.md) |

## Licença

Distribuído sob a licença MIT. Consulte [<code>LICENSE</code>](LICENSE) para os termos completos.
