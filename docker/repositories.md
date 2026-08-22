# Repositórios e fluxo de desenvolvimento

Existem três diretórios porque contexto integrado, especificação e artefatos implantáveis têm responsabilidades diferentes.

```text
CODEX / SDD
      │
      ▼
shared-planner
      │
      ├── backend ─────sync─────► shared-planner-backend
      │
      └── frontend ────sync─────► shared-planner-frontend
                                      │
                                      ▼
                                    Docker
```

## Responsabilidades

- `C:\git\shared-planner`: contexto de integração, SDD, documentação, cópias dos módulos, scripts e `compose.yaml`.
- `C:\git\shared-planner-backend`: fonte implantável independente do backend e contexto real do build Docker.
- `C:\git\shared-planner-frontend`: fonte implantável independente do frontend e contexto real do build Docker.

Cada diretório preserva seu próprio `.git`. Metadados Git nunca são copiados.

## Sincronização segura

O fluxo parte das cópias integradas no monorepo e publica somente arquivos de fonte/configuração nos standalones:

```powershell
cd C:\git\shared-planner
powershell -ExecutionPolicy Bypass -File .\scripts\check-repository-sync.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\sync-repositories.ps1
# Revise o preview acima.
powershell -ExecutionPolicy Bypass -File .\scripts\sync-repositories.ps1 -Apply
```

O modo padrão de `sync-repositories.ps1` é apenas preview. `-Apply` copia somente arquivos ausentes ou alterados, nunca remove arquivos do destino e, ao final, verifica hashes SHA-256. São excluídos `.git`, `target`, `node_modules`, `dist`, `.angular`, `.idea`, `.vscode`, `logs`, arquivos `*.log` e segredos `.env` locais.

## Estado validado

```text
Backend parity:  80/80 — PASS
Frontend parity: 74/74 — PASS

Backend Docker context:  C:\git\shared-planner-backend
Frontend Docker context: C:\git\shared-planner-frontend
```

O resultado frontend é o gate oficial, que exclui também os quatro arquivos `.vscode` conforme a regra de sincronização. Os builds Docker individuais, a stack integrada com três serviços `healthy`, o health direto/proxy, a regressão e a persistência PostgreSQL passaram. Os commits backend/frontend existem; o commit de integração é a entrega que contém esta documentação e seu SHA é reportado no handoff.

## Workflow

1. Atualize primeiro a spec relevante em `shared-planner\docs\sdd`.
2. Implemente e teste no contexto integrado.
3. Execute a verificação; revise o preview e sincronize.
4. Rode testes e builds nos repositórios standalone.
5. Execute `docker compose config --quiet` e use a projeção segura descrita em [compose.md](compose.md) para mostrar somente os dois contextos; nunca imprima a configuração bruta.
6. Valide a stack completa.
7. Revise e faça commits independentes em backend, frontend e integração. Push é uma decisão separada.
