# Design System Foundation — tarefas e validação

Entrega de 16/11/2026. Implementação no monorepo e cópia equivalente no standalone frontend.

- [x] Investigar SDD, frontend, UI existente, estilos, temas e as 12 referências.
- [x] Definir camadas, catálogo e exclusão da rota de produção.
- [x] Acrescentar 51 tokens base e nove overrides dark sem mudar os tokens legados.
- [x] Concluir os 13 componentes/diretivas pedidos e o apoio FormField.
- [x] Reutilizar Icon, ThemeService e DialogFocusDirective; sem dependências novas.
- [x] Integrar demonstração de desenvolvimento e exemplos sem APIs.
- [x] Executar testes de componentes, regressão frontend e builds nos dois contextos.
- [x] Verificar temas, teclado, contraste, responsividade e ausência do showcase em produção.
- [x] Sincronizar frontend standalone e conferir a paridade.
- [x] Registrar resultados, limites e arquivos modificados; sem commits/pushes.

## Checks executados

| Check | Resultado |
|---|---|
| Monorepo: npm test -- --no-watch | 185/185, 27 arquivos, PASS |
| Standalone: npm test -- --no-watch | 185/185, 27 arquivos, PASS |
| Build produção, ambos | PASS, zero warnings, uma rota pré-renderizada |
| Build desenvolvimento, monorepo | PASS; catálogo lazy disponível |
| Budgets de produção | initial 403,27 kB; CSS 75,11 kB; sem alterar limites |
| Paridade | backend 149/149; frontend 151/151, PASS |
| Chrome: Light/Dark × 1440/390 | quatro combinações, PASS |
| System, troca do SO, storage entre abas e reload | PASS |
| Teclado, foco e hover | botões, formulários, dropdown, tooltip e modal PASS |
| Modal | top layer nativo, contenção/retorno de foco, Escape e bloqueio de scroll PASS |
| Navegação interna/skip link | preserva /design-system, fragmento e foco no destino, PASS |
| Responsividade | sem overflow em .ds-page, menu e modal mobile, PASS |
| Movimento reduzido | animações neutralizadas, PASS |
| Contraste medido no browser | texto ≥5,17:1, bordas ≥3,55:1, foco ≥6,70:1, tooltip ≥16,30:1 |
| Fonte efetiva (Chrome CDP) | Segoe UI/Bold como fallback da stack Inter; Consolas só em code |
| Graph de produção | nenhum input TypeScript do showcase/rota dev; nenhum marcador nos JS |
| URL direta em produção | /design-system segue fallback para /login, sem catálogo |
| Artefatos browser/server de produção | 73 artefatos JS/HTML sem marcador SP_DESIGN_SYSTEM_SHOWCASE |
| Requisições de negócio / erros no catálogo | zero / zero |
| Regressão Chrome das páginas existentes | oito temas/resoluções + dois cenários de perfis + System/storage/reload; quatro downloads XLSX sintéticos, PASS |

Os 185 testes incluem os 165 anteriores e 20 novos: sete de controles, dez de
composição, dois de exemplos/temas e um de roteamento. O teste existente de foco
permaneceu aprovado após extrair focusInitial(), reutilizado depois de showModal().

O build de desenvolvimento mantém o aviso preexistente NG02801 sobre HttpClient/SSR
sem withFetch(). A configuração HTTP não foi alterada neste escopo. Produção termina
sem warnings. O aviso de tamanho do CSS do catálogo encontrado na integração foi
corrigido por simplificação do estilo (3.639 bytes comprimidos), sem elevar budgets.

A sincronização oficial terminou em PASS 149/151. Uma reconferência posterior no
PowerShell 5 terminou com System.AccessViolationException no processo do shell; a
equivalência final foi também conferida por hashes SHA-256 independentes, sem diferenças.

Capturas, relatórios JSON e logs privados:
`C:\shared-planner-private\qa-evidence\design-system-20261116`.
O tooling Playwright já disponível no cache foi usado externamente, sem adicionar
dependências ou mudar package.json/package-lock.json.

## Acesso e limites

Na pasta frontend, executar `npm.cmd start` no PowerShell e abrir
`http://localhost:4200/design-system`.
A tentativa de iniciar automaticamente esse servidor local foi recusada pela política
de execução da ferramenta; não há servidor novo deixado por esta entrega. Os testes
de navegador usaram servidores temporários encerrados ao terminar.

Não houve migração das páginas existentes, alteração do backend/API/regras, alteração
de banco, commit ou push. .vscode/ e docs/reffs/ locais foram preservados. As verificações
automáticas e inspeções visuais não substituem uma auditoria WCAG completa nem teste
manual com leitores de tela. Não se declara conformidade WCAG integral.

## Arquivos modificados/criados

Os paths frontend abaixo também existem, idênticos, em C:\git\shared-planner-frontend
sem o prefixo frontend/. Os documentos SDD ficam somente no monorepo.

```text
frontend/angular.json
frontend/src/app/app.routes.ts
frontend/src/app/shared/a11y/dialog-focus.directive.ts
frontend/src/styles.scss
frontend/src/styles/_tokens.scss
docs/sdd/design-system/design.md
docs/sdd/design-system/requirements.md
docs/sdd/design-system/tasks.md
frontend/src/app/design-system.routes.dev.ts
frontend/src/app/design-system.routes.spec.ts
frontend/src/app/design-system.routes.ts
frontend/src/app/features/design-system/design-system-page.html
frontend/src/app/features/design-system/design-system-page.scss
frontend/src/app/features/design-system/design-system-page.spec.ts
frontend/src/app/features/design-system/design-system-page.ts
frontend/src/app/shared/ui/design-system/badge.component.ts
frontend/src/app/shared/ui/design-system/button.directive.ts
frontend/src/app/shared/ui/design-system/card.component.ts
frontend/src/app/shared/ui/design-system/checkbox.component.ts
frontend/src/app/shared/ui/design-system/composites.spec.ts
frontend/src/app/shared/ui/design-system/controls.scss
frontend/src/app/shared/ui/design-system/controls.spec.ts
frontend/src/app/shared/ui/design-system/dropdown.component.ts
frontend/src/app/shared/ui/design-system/empty-state.component.ts
frontend/src/app/shared/ui/design-system/form-field.component.ts
frontend/src/app/shared/ui/design-system/icon-button.component.ts
frontend/src/app/shared/ui/design-system/index.ts
frontend/src/app/shared/ui/design-system/input.directive.ts
frontend/src/app/shared/ui/design-system/loading-state.component.ts
frontend/src/app/shared/ui/design-system/modal.component.ts
frontend/src/app/shared/ui/design-system/page-header.component.ts
frontend/src/app/shared/ui/design-system/select.directive.ts
frontend/src/app/shared/ui/design-system/tooltip.directive.ts
frontend/src/app/shared/ui/design-system/tooltip.scss
frontend/tests/design-system-check.cjs
```
