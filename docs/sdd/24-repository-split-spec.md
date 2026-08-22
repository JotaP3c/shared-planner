# 24 — Repository Split Specification

## Status

`COMPLETE_ON_THIS_DELIVERY`: estrutura, `.git`, remotes, sincronização, contextos Docker, builds, stack e testes foram validados. Backend e frontend possuem commits independentes verificados; o commit de integração é a própria entrega que contém esta spec e seu SHA é reportado no handoff.

## Topologia

```text
C:\git\shared-planner
C:\git\shared-planner-backend
C:\git\shared-planner-frontend
```

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

### Integration / SDD / Context Repository

`C:\git\shared-planner` mantém a visão integrada da aplicação: `backend/`, `frontend/`, `docs/`, `docker/`, scripts de operação e `compose.yaml`. É o local de análise conjunta e a fonte das especificações, não o artefato final de build dos módulos.

### Backend Deployable Source

`C:\git\shared-planner-backend` contém diretamente na raiz `src/`, `.mvn/`, `pom.xml`, wrappers Maven, Dockerfile, `.dockerignore`, arquivos Git auxiliares e README. Não deve existir `shared-planner-backend/backend/src`.

### Frontend Deployable Source

`C:\git\shared-planner-frontend` contém diretamente na raiz `src/`, `public/`, `package.json`, lockfile, configuração Angular/TypeScript, Dockerfile, `.dockerignore`, `.gitignore` e README. Não deve existir `shared-planner-frontend/frontend/src`.

## Source of Truth

| Escopo | Fonte autoritativa |
|---|---|
| Functional / Specification Source of Truth | `C:\git\shared-planner\docs\sdd` |
| Integrated Development Context | `C:\git\shared-planner` |
| Backend Deployable Source | `C:\git\shared-planner-backend` |
| Frontend Deployable Source | `C:\git\shared-planner-frontend` |

Código pode ser editado com contexto integrado no monorepo, mas deve ser sincronizado e validado antes de qualquer Docker final ou commit de entrega. Após a sincronização, as raízes standalone são as fontes efetivamente construídas.

## Regras de separação

- INFRA-REPO-001: os três diretórios permanecem existentes; o monorepo não será removido.
- INFRA-REPO-002: backend e frontend standalone têm seus módulos diretamente na raiz.
- INFRA-REPO-003: cada diretório possui exatamente um `.git` próprio na raiz.
- INFRA-REPO-004: metadata `.git` nunca é copiada entre repositórios.
- INFRA-REPO-005: histórico, remote, branch e commits permanecem independentes.
- INFRA-REPO-006: arquivos gerados e dependências instaladas não participam da sincronização.
- INFRA-REPO-007: divergências devem ser relatadas por caminho relativo e conteúdo.
- INFRA-REPO-008: a sincronização não pode apagar arquivos silenciosamente.
- INFRA-REPO-009: o Compose final deve apontar para as raízes standalone.
- INFRA-REPO-010: cada repositório recebe somente alterações de sua responsabilidade.
- INFRA-REPO-011: commits só ocorrem depois dos gates correspondentes.
- INFRA-REPO-012: nenhum push ocorre nesta execução.

## Estratégia Git

Antes de sincronizar ou commitar, registrar `git status`, `git remote -v` e `git branch --show-current` separadamente. Remotes corretos não são alterados. Um remote incorreto deve ser registrado antes de qualquer correção. A inspeção de `.git` deve comprovar que não há repositório aninhado.

## Fluxo de desenvolvimento

1. Atualizar spec e código com o contexto integrado.
2. Revisar o diff no monorepo.
3. Sincronizar o módulo correspondente sem artefatos gerados.
4. Executar verificação de paridade.
5. Testar e construir o standalone.
6. Executar Compose a partir do monorepo usando contexts standalone.
7. Criar os commits independentes, sem push.

## Falhas esperadas

- Diretório sibling ausente: abortar antes do build.
- Raiz standalone com módulo aninhado: falhar a validação estrutural.
- `.git` aninhado: interromper cópia/commit e corrigir o alvo exato.
- Arquivos missing/extra/changed: relatar e não declarar paridade.
- Remote divergente: registrar; não trocar silenciosamente.
- Componente com build/teste falho: não criar commit de conclusão.

## Critério de conclusão

A validação técnica da separação está concluída com:

- backend `80/80` e frontend `74/74` na comparação oficial por caminho/hash após exclusões normativas;
- único `.git` na raiz de cada repositório e nenhum `.git` aninhado;
- contextos efetivos `C:\git\shared-planner-backend` e `C:\git\shared-planner-frontend`;
- builds standalone, stack com três serviços `healthy`, health, login, regressão e persistência em PASS;
- DBeaver e login real no frontend em PASS.

A separação está `COMPLETE_ON_THIS_DELIVERY`. Os commits e SHAs backend/frontend estão registrados no relatório 29. O SHA da integração é informado no handoff, porque o commit que contém este documento não pode registrar antecipadamente o próprio SHA. `git push` permanece fora desta execução.
