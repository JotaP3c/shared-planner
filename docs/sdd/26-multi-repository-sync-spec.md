# 26 — Multi-Repository Synchronization Specification

## Objetivo

Garantir equivalência verificável entre as cópias integradas do monorepo e as fontes implantáveis standalone, sem copiar metadata Git, dependências, builds ou logs e sem apagar dados silenciosamente.

## Repository topology

```text
MONOREPO BACKEND:
C:\git\shared-planner\backend

STANDALONE BACKEND:
C:\git\shared-planner-backend
```

```text
MONOREPO FRONTEND:
C:\git\shared-planner\frontend

STANDALONE FRONTEND:
C:\git\shared-planner-frontend
```

## Responsibilities

O monorepo é o contexto de desenvolvimento integrado e hospeda a Source of Truth SDD. Os standalones são as fontes implantáveis e os contextos finais do Docker. Alteração de código no monorepo requer sincronização antes da validação final.

## Source mapping

| Origem integrada | Destino implantável | Unidade de comparação |
|---|---|---|
| `shared-planner\backend\<relative-path>` | `shared-planner-backend\<relative-path>` | caminho relativo + SHA-256 |
| `shared-planner\frontend\<relative-path>` | `shared-planner-frontend\<relative-path>` | caminho relativo + SHA-256 |

Arquivos de código, configuração, lockfiles, wrappers, Dockerfile, `.dockerignore`, `.gitignore` e `.gitattributes` correspondentes devem ser equivalentes. O `.git` é sempre específico do repositório e nunca entra na comparação de conteúdo.

## Excluded files

Exclusões comuns:

```text
.git/
.idea/
.vscode/
logs/
*.log
```

Backend:

```text
target/
```

Frontend:

```text
node_modules/
dist/
.angular/
```

Exclusão não significa autorização para apagar o item no destino; significa apenas que ele não participa de cópia ou paridade.

## Synchronization rules

- Gerar preview de `missing`, `extra` e `changed` antes de escrever.
- Copiar apenas arquivos ausentes ou cujo conteúdo mudou.
- Criar diretórios pais estritamente necessários.
- Nunca usar espelhamento destrutivo, `robocopy /MIR`, `Remove-Item -Recurse` ou equivalente.
- Nunca copiar `.git`, mesmo quando oculto.
- Nunca remover arquivo extra automaticamente; reportá-lo para decisão humana.
- Não copiar timestamps como prova de equivalência; conteúdo/hash é autoritativo.
- Depois de qualquer cópia, executar novamente a verificação até obter zero diferenças.

## Validation strategy

O contrato de `scripts/check-repository-sync.ps1` é:

1. Resolver e validar os quatro caminhos absolutos esperados.
2. Recusar roots ausentes ou fora da topologia configurada.
3. Enumerar arquivos após aplicar as exclusões.
4. Comparar conjunto de caminhos relativos.
5. Calcular SHA-256 para caminhos presentes em ambos.
6. Exibir seções `Missing`, `Extra` e `Changed` por componente.
7. Retornar código `0` somente quando backend e frontend estiverem equivalentes; retornar não zero quando houver divergência ou erro.
8. Não modificar o filesystem.

Se existir `scripts/sync-repositories.ps1`, o padrão deve ser preview. Qualquer modo de aplicação precisa ser explícito, não destrutivo e seguido pelo check independente.

## Docker build strategy

O Compose fica no monorepo, mas usa:

```text
BACKEND_BUILD_CONTEXT=../shared-planner-backend
FRONTEND_BUILD_CONTEXT=../shared-planner-frontend
```

Com defaults equivalentes:

```text
${BACKEND_BUILD_CONTEXT:-../shared-planner-backend}
${FRONTEND_BUILD_CONTEXT:-../shared-planner-frontend}
```

O gate executa `docker compose config --quiet` e projeta somente `services.backend.build.context` e `services.frontend.build.context` a partir do JSON convertido em memória, conforme [docker/compose.md](../../docker/compose.md). A configuração bruta, que pode conter segredos interpolados, nunca deve ser impressa. Os paths absolutos comprovados antes dos builds foram:

```text
C:\git\shared-planner-backend
C:\git\shared-planner-frontend
```

Builds individuais são executados nas raízes standalone.

## Git strategy

- Cada repositório preserva seu `.git`, remote, branch e histórico.
- A sincronização nunca executa Git automaticamente.
- Antes do commit: `git status`, `git diff`, `git remote -v`, `git branch --show-current` e busca de `.git` aninhado.
- O backend standalone não recebe frontend ou documentação do monorepo.
- O frontend standalone não recebe backend ou documentação do monorepo.
- O monorepo registra SDD, Docker, Compose, scripts e suas cópias integradas.

## Commit strategy

1. Backend aprovado: commit exclusivo em `C:\git\shared-planner-backend`.
2. Frontend aprovado: commit exclusivo em `C:\git\shared-planner-frontend`.
3. Integração aprovada: commit em `C:\git\shared-planner`.
4. Registrar os três SHAs.
5. Não executar `git push`.

Falha de um componente bloqueia apenas o commit que alegaria sua conclusão; não se falsifica um PASS para manter a ordem.

## Failure scenarios

| Falha | Comportamento obrigatório |
|---|---|
| Root inexistente | abortar e listar path |
| Root inesperado/resolução ambígua | abortar sem copiar |
| `.git` aninhado | FAIL; proteger os históricos |
| Arquivo divergente | listar path e hashes; não apagar |
| Extra no standalone | relatar para revisão; não remover |
| Build context aponta ao monorepo | FAIL Docker acceptance |
| Teste/build falha | não criar commit de conclusão |
| Remote incorreto | registrar antes de qualquer mudança |

## Acceptance criteria

Paridade exige zero arquivos `missing`, `extra` ou `changed` após as exclusões, `.git` independente, contextos standalone comprovados e builds/testes aprovados. Os cenários normativos estão reproduzidos literalmente em [25](25-infrastructure-acceptance-criteria.md).

## Estado atual

Topologia, scripts e estratégia estão definidos e validados. O check terminou com:

```text
Backend: monorepo=80 standalone=80 — PASS
Frontend: monorepo=74 standalone=74 — PASS
Missing/Extra/Changed: 0
```

O resultado frontend acima é o gate oficial após excluir também os quatro arquivos `.vscode`, conforme a regra desta spec. Uma contagem independente que inclua esses arquivos não substitui o resultado normativo. As exclusões foram respeitadas, os três `.git` permaneceram independentes, os contextos standalone foram comprovados e os builds/testes passaram. Os commits e SHAs backend/frontend foram verificados. O commit de integração é a própria entrega que contém esta spec; seu SHA é reportado no handoff porque não pode ser autorreferenciado. Nenhum push foi feito. Evidência consolidada: [29](29-infrastructure-validation-report.md).
