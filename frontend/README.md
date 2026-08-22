# Shared Planner Frontend

Cliente Angular 21 com SSR para autenticação, calendários compartilhados, eventos, aprovações, membros, financeiro e auditoria do Shared Planner.

## Desenvolvimento local

Use os scripts versionados pelo projeto, sem depender de uma instalação global do Angular CLI:

```powershell
cd C:\git\shared-planner-frontend
npm.cmd ci
npm.cmd start
```

A aplicação fica em `http://localhost:4200`. O `proxy.conf.json` encaminha `/api` para o backend local em `http://localhost:8080`.

## Testes e build

```powershell
npm.cmd test -- --watch=false
npm.cmd run build
```

O build SSR é gravado em `dist/shared-planner-frontend`. Ainda não há suíte E2E instalada ou script E2E no `package.json`; o smoke de interface da infraestrutura é documentado pelo repositório de integração.

## Imagem Docker standalone

```powershell
cd C:\git\shared-planner-frontend
docker build -t shared-planner-frontend .
```

A imagem executa o servidor SSR como usuário não privilegiado na porta interna `4000`. Para subir PostgreSQL, backend e frontend juntos, use `C:\git\shared-planner\compose.yaml`; ele injeta `BACKEND_URL=http://backend:8080` para o proxy SSR.

## Fluxo multi-repositório

Este diretório é o repositório implantável do frontend. A cópia `C:\git\shared-planner\frontend` deve permanecer equivalente por caminho e SHA-256 usando os scripts de sincronização do repositório de integração.
