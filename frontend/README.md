# Shared Planner Frontend

![Angular 21](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)
![TypeScript 5.9](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)

Interface web do **Shared Planner**, uma aplicação de agenda colaborativa para casais, profissionais e pequenos grupos que precisam compartilhar compromissos sem perder o controle sobre autoria, acesso e consentimento.

O produto reúne calendários multiusuário, eventos pessoais, atendimentos de clientes, solicitações de participação, aprovações, pagamentos e administração de membros. Este repositório contém o cliente Angular e o servidor Node responsável por SSR e pelo proxy da API; regras de negócio, autorização definitiva e persistência pertencem ao [backend do Shared Planner](https://github.com/JotaP3c/shared-planner-backend).

## Visão do produto

O domínio diferencia três tipos de evento:

- `CLIENT`: atendimento de cliente, com serviço, valor e acompanhamento do pagamento;
- `PERSONAL`: compromisso pessoal, associado a uma pessoa ou atividade;
- `SHARED`: compromisso que solicita a participação de outro membro e depende de aprovação ou rejeição explícita.

Essa distinção permite combinar agenda, colaboração e controle financeiro mantendo regras claras de visibilidade e permissão. A visão completa, as regras de negócio e os critérios de aceite são mantidos no [repositório de integração e SDD](https://github.com/JotaP3c/shared-planner/tree/main/docs/sdd).

## Estado funcional

O frontend já possui o fluxo principal de autenticação por e-mail/senha e agenda. Algumas áreas administrativas estão deliberadamente expostas como evolução do produto e ainda não devem ser consideradas concluídas.

| Área | Estado atual |
|---|---|
| Autenticação | Login JWT, recuperação da identidade atual, guarda de rotas, interceptor Bearer e logout |
| Calendários | Listagem, seleção múltipla, cores, filtros e visualizações por mês, semana e dia |
| Eventos | Criação, consulta, edição e cancelamento lógico de `CLIENT`, `PERSONAL` e `SHARED` |
| Busca | Pesquisa global por eventos, clientes e descrições, com navegação para o resultado no calendário |
| Aprovações | Fila de eventos compartilhados, indicação de não lidos e ações de aprovar/rejeitar pelo usuário solicitado |
| Pagamentos | Consulta e atualização de status, método, valor recebido e data de pagamento em eventos `CLIENT` |
| Membros | Listagem, inclusão, alteração de papel e remoção, respeitando a proteção do proprietário |
| Financeiro | Cliente HTTP disponível; tela `/finance` ainda é um placeholder |
| Usuários | Cliente HTTP para criação/edição; tela `/admin/users` ainda é um placeholder |
| Auditoria | Cliente HTTP e contrato disponíveis; tela `/audit` ainda é um placeholder |
| Configurações | Rota reservada, ainda sem fluxo funcional definido |

Para o retrato técnico atualizado e as lacunas priorizadas, consulte [Current State](https://github.com/JotaP3c/shared-planner/blob/main/docs/sdd/01-current-state.md), [Frontend Flows](https://github.com/JotaP3c/shared-planner/blob/main/docs/sdd/13-frontend-flows.md) e [Gap Analysis](https://github.com/JotaP3c/shared-planner/blob/main/docs/sdd/17-gap-analysis.md).

As ações visuais de login com Google, criação de conta e recuperação de senha ainda não possuem integração. A opção “Lembrar de mim” também não altera a persistência atual: o token é armazenado no `localStorage`. Esses elementos devem ser tratados como protótipos de interface até que seus requisitos e fluxos sejam especificados.

## Papéis e autorização

O produto combina papéis globais (`ADMIN`, `FINANCE`, `USER`) com papéis por calendário (`ADMIN`, `FINANCE`, `EDITOR`, `VIEWER`). Eles controlam administração global, criação e edição de eventos, gestão de membros, acesso financeiro e visibilidade.

O frontend usa `authGuard` para exigir uma sessão nas rotas internas e adapta parte da navegação à identidade atual. A decisão final de acesso é sempre do backend, que valida o JWT e as permissões contextuais em cada requisição; ocultar um botão na interface não substitui autorização no servidor.

## Arquitetura

```text
Navegador
   │
   ▼
Angular 21 + hydration + FullCalendar
   │
   ▼
Node/Express SSR :4000
   │  /api → BACKEND_URL
   ▼
Spring Boot API :8080
   │
   ▼
PostgreSQL :5432
```

No desenvolvimento, o Angular Dev Server atende em `http://localhost:4200` e o [`proxy.conf.json`](proxy.conf.json) encaminha `/api` para `http://localhost:8080`. Na imagem de produção, o servidor [`src/server.ts`](src/server.ts) entrega os artefatos renderizados e encaminha `/api` para a URL definida em `BACKEND_URL`.

O uso de caminhos relativos (`/api/...`) mantém frontend e API sob a mesma origem aparente e evita gravar endereços de infraestrutura no bundle do navegador.

### Organização do código

```text
src/
├── app/
│   ├── core/
│   │   ├── api/          # clientes HTTP por domínio
│   │   ├── auth/         # sessão JWT e interceptor
│   │   ├── guards/       # proteção de navegação
│   │   ├── layout/       # shell, navegação e busca global
│   │   └── models/       # contratos compartilhados da interface
│   └── features/
│       ├── auth/
│       ├── calendar/
│       ├── pending/
│       ├── members/
│       ├── finance/
│       ├── users/
│       ├── audit/
│       └── settings/
├── assets/
├── main.ts
├── main.server.ts
├── server.ts             # Express, SSR e proxy de runtime
└── styles.scss
```

As páginas são componentes standalone carregados de forma lazy. O build usa renderização no servidor, prerenderização das rotas declaradas e hydration no navegador com replay de eventos.

## Tecnologias

- Angular 21.2 e Angular CLI/build 21.2;
- TypeScript 5.9 e RxJS 7.8;
- Angular SSR 21.2 com hydration;
- Express 5 como servidor de runtime;
- FullCalendar 6.1 para mês, semana, dia e interação;
- SCSS para estilos globais e por componente;
- Vitest 4, jsdom e Angular TestBed para testes unitários;
- Node.js 24 Alpine nas etapas de build e runtime Docker;
- npm com lockfile versionado.

As versões autoritativas estão em [`package.json`](package.json), [`package-lock.json`](package-lock.json) e [`angular.json`](angular.json).

## Requisitos

Para desenvolvimento direto na máquina:

- Node.js 24 recomendado, alinhado à imagem Docker;
- npm 11 — o projeto declara `npm@11.3.0`;
- backend acessível em `http://localhost:8080` para os fluxos integrados.

Não é necessário instalar Angular CLI globalmente. `npm start`, `npm test` e `npm run build` usam a versão local fixada pelo projeto.

## Executar em desenvolvimento

```powershell
cd C:\git\shared-planner-frontend
npm.cmd ci
npm.cmd start
```

Acesse [http://localhost:4200](http://localhost:4200). O comando `npm ci` reproduz exatamente o lockfile e deve ser preferido a `npm install` em ambientes limpos e na validação do projeto.

Em shells nos quais `npm` não é interceptado pelo PowerShell, os mesmos comandos podem ser executados sem o sufixo `.cmd`.

### Backend local

O frontend espera que a API esteja em `http://localhost:8080`. As instruções de banco, variáveis de ambiente, Flyway e execução da API estão no [README do backend](https://github.com/JotaP3c/shared-planner-backend#readme).

Uma resposta `401` ou `403` deve ser investigada primeiro no backend: a interface melhora a experiência ocultando ou desabilitando algumas ações, mas o servidor é a autoridade final de autorização.

## Executar a stack completa com Docker Compose

O Compose pertence ao [repositório de integração](https://github.com/JotaP3c/shared-planner) e usa os repositórios standalone como contextos de build. A disposição padrão é:

```text
C:\git\shared-planner
C:\git\shared-planner-backend
C:\git\shared-planner-frontend
```

Com os três diretórios lado a lado:

```powershell
cd C:\git\shared-planner

if (-not (Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}

# Revise os placeholders do .env antes de iniciar a stack.
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
```

Serviços nas portas padrão:

| Serviço | Endereço |
|---|---|
| Frontend | `http://localhost:4200` |
| Backend | `http://localhost:8080` |
| Health da API | `http://localhost:8080/api/health` |
| PostgreSQL | `localhost:5432` |

As portas e os contextos podem ser substituídos no `.env` do repositório de integração. O arquivo `.env` real é local e não deve ser commitado; somente `.env.example` funciona como contrato de configuração.

Para interromper a stack sem apagar o volume do PostgreSQL:

```powershell
docker compose down
```

Não use `docker compose down -v` se precisar preservar os dados locais.

## SSR e imagem Docker standalone

O [`Dockerfile`](Dockerfile) possui duas etapas:

1. instala dependências com `npm ci` e gera o build Angular SSR;
2. instala somente dependências de produção, copia `dist/` e executa o servidor como usuário não privilegiado `node`.

A imagem expõe internamente a porta `4000`.

```powershell
cd C:\git\shared-planner-frontend
docker build -t shared-planner-frontend .
docker run --rm -p 4200:4000 `
  -e BACKEND_URL=http://host.docker.internal:8080 `
  shared-planner-frontend
```

O exemplo acima pressupõe Docker Desktop e um backend executando na máquina host. Na stack oficial, o Compose configura `BACKEND_URL=http://backend:8080` pela rede interna do projeto.

Também é possível validar localmente o artefato de produção sem Docker:

```powershell
npm.cmd run build
$env:PORT = '4000'
$env:BACKEND_URL = 'http://localhost:8080'
npm.cmd run serve:ssr:shared-planner-frontend
```

## Rotas da aplicação

| Rota | Propósito | Situação |
|---|---|---|
| `/login` | Autenticação por e-mail e senha | Funcional |
| `/calendar` | Calendários, eventos, busca, detalhe, pagamentos e painel de pendências | Funcional |
| `/pending` | Fila completa de aprovações | Funcional |
| `/members` | Participantes e papéis dos calendários | Funcional |
| `/finance` | Resumo financeiro de atendimentos | Placeholder; API de receitas disponível |
| `/admin/users` | Administração global de usuários | Placeholder; link exibido somente a ADMIN |
| `/audit` | Consulta a logs de auditoria | Placeholder; cliente HTTP disponível |
| `/settings` | Preferências da aplicação | Placeholder |

Todas as rotas, exceto `/login`, passam pelo `authGuard`. O curinga redireciona para `/calendar`. A definição autoritativa está em [`src/app/app.routes.ts`](src/app/app.routes.ts).

## Integração com a API

Os clientes em `src/app/core/api` consomem estes grupos de endpoints:

| Domínio | Prefixo principal | Uso atual no frontend |
|---|---|---|
| Autenticação | `/api/auth` | Login e usuário atual |
| Calendários | `/api/calendars` | Listagem, criação e membros |
| Eventos | `/api/events` | CRUD, busca, aprovações, pagamentos e receita de clientes |
| Financeiro | `/api/finance` | Resumo por intervalo; tela ainda pendente |
| Usuários | `/api/users` | Criação/edição; tela ainda pendente |
| Auditoria | `/api/audit-logs` | Contrato pronto; tela ainda pendente |

O `authInterceptor` adiciona `Authorization: Bearer <token>` às requisições protegidas. Login e health permanecem públicos. Os modelos TypeScript espelham os DTOs utilizados pela aplicação, mas o contrato definitivo está documentado na [especificação da API](https://github.com/JotaP3c/shared-planner/blob/main/docs/sdd/11-api-contracts.md).

## Scripts

| Comando | Finalidade |
|---|---|
| `npm start` | Inicia o Angular Dev Server com proxy local |
| `npm run build` | Gera o bundle browser, servidor SSR e rotas prerenderizadas |
| `npm run watch` | Mantém um build de desenvolvimento em observação |
| `npm test` | Executa o runner de testes Angular/Vitest |
| `npm run serve:ssr:shared-planner-frontend` | Serve um build já gerado pela porta configurada em `PORT` |
| `npm run ng -- <comando>` | Executa a CLI Angular local |

## Testes e qualidade

Validação recomendada antes de abrir uma alteração:

```powershell
npm.cmd ci
npm.cmd test -- --watch=false
npm.cmd run build
```

A baseline de infraestrutura de 21/08/2026 registrou:

- 10 arquivos de teste e 13 testes aprovados;
- build SSR aprovado e rotas prerenderizadas;
- smoke de autenticação e calendário aprovado em navegador headless;
- build da imagem standalone e stack integrada aprovados.

Ainda não existe suíte E2E nem script E2E no `package.json`. O relatório também registra três warnings de budget SCSS e alertas do `npm audit`; consulte o [relatório de validação](https://github.com/JotaP3c/shared-planner/blob/main/docs/sdd/29-infrastructure-validation-report.md) e reavalie-os em qualquer atualização de dependências. Evite `npm audit fix --force` sem análise de compatibilidade e regressão.

## Segurança

- O token de acesso é armazenado no `localStorage` sob a chave `sharedPlanner.token`; mudanças que renderizem HTML não confiável exigem atenção especial a XSS.
- O frontend nunca deve receber `APP_JWT_SECRET`, credenciais do PostgreSQL ou outros segredos de infraestrutura.
- `BACKEND_URL` é configuração exclusiva do processo SSR; não é uma credencial.
- A guarda de rota valida a presença da sessão para navegação, enquanto o backend valida identidade, token, papéis globais e papéis de calendário.
- Respostas `401` e `403` não devem ser contornadas no cliente; a matriz vigente está na [especificação de permissões](https://github.com/JotaP3c/shared-planner/blob/main/docs/sdd/04-permissions.md).
- Arquivos `.env`, logs, `node_modules/`, `dist/` e `.angular/` não pertencem ao controle de versão nem à sincronização entre repositórios.

## Topologia multi-repositório

| Repositório | Responsabilidade |
|---|---|
| [shared-planner](https://github.com/JotaP3c/shared-planner) | Integração, SDD, Compose, documentação e cópias coordenadas dos módulos |
| [shared-planner-backend](https://github.com/JotaP3c/shared-planner-backend) | Fonte implantável da API Spring Boot |
| [shared-planner-frontend](https://github.com/JotaP3c/shared-planner-frontend) | Fonte implantável desta aplicação Angular/SSR |

O fluxo definido pelo projeto parte da cópia integrada `shared-planner/frontend` e sincroniza alterações para o repositório standalone sem copiar metadados Git ou artefatos gerados. A equivalência é verificada por caminho relativo e SHA-256.

```powershell
cd C:\git\shared-planner

# Apenas apresenta o que mudaria.
powershell -ExecutionPolicy Bypass -File .\scripts\sync-repositories.ps1

# Aplica somente adições e atualizações revisadas; não exclui extras.
powershell -ExecutionPolicy Bypass -File .\scripts\sync-repositories.ps1 -Apply

# Gate independente de paridade.
powershell -ExecutionPolicy Bypass -File .\scripts\check-repository-sync.ps1
```

Nunca copie `.git`, `node_modules`, `dist`, `.angular`, logs ou credenciais entre as raízes. O contrato completo está em [Multi-Repository Synchronization Specification](https://github.com/JotaP3c/shared-planner/blob/main/docs/sdd/26-multi-repository-sync-spec.md).

## Desenvolvimento orientado por especificação

Mudanças de comportamento devem começar pela documentação do requisito e terminar com evidência verificável:

1. atualizar a spec relevante no [catálogo SDD](https://github.com/JotaP3c/shared-planner/tree/main/docs/sdd);
2. confirmar regra de negócio, permissão, fluxo e contrato da API;
3. implementar o menor incremento coerente no frontend e, quando necessário, no backend;
4. adicionar ou ajustar testes;
5. executar testes, build SSR e verificação de paridade;
6. revisar o diff e commitar apenas arquivos da responsabilidade de cada repositório.

Decisões ainda abertas não devem ser resolvidas implicitamente no código. Elas estão registradas em [Open Questions](https://github.com/JotaP3c/shared-planner/blob/main/docs/sdd/99-open-questions.md).

## Links úteis

- [Repositório de integração](https://github.com/JotaP3c/shared-planner)
- [Backend](https://github.com/JotaP3c/shared-planner-backend)
- [Documentação SDD](https://github.com/JotaP3c/shared-planner/tree/main/docs/sdd)
- [Documentação Docker](https://github.com/JotaP3c/shared-planner/tree/main/docker)
- [Visão do produto](https://github.com/JotaP3c/shared-planner/blob/main/docs/sdd/00-product-vision.md)
- [Critérios de aceite](https://github.com/JotaP3c/shared-planner/blob/main/docs/sdd/15-acceptance-criteria.md)
