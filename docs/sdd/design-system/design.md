# Design System Foundation — arquitetura e catálogo

## Camadas

`src/styles/_tokens.scss` é a origem dos tokens. Os valores legados permanecem e
novos tokens semânticos resolvem contraste sem uma migração visual das telas atuais.
`ThemeService` e o script pré-pintura continuam como infraestrutura única: preferência
claro/escuro/sistema, persistência, alterações do SO, storage entre abas e SSR seguro.
Inter permanece preferencial na stack com Segoe UI/system-ui e sem download externo.

`shared/ui/design-system/` contém peças standalone e um barrel de importação, sem
serviços de negócio. Diretivas sobre elementos nativos preservam foco, teclado,
submissão e os value accessors nativos do Angular; não há um segundo sistema de forms.
Os estilos de controles/tooltip são globais com seletores exclusivos do DS; composição
usa estilos locais. As classes das telas existentes continuam disponíveis.

## Tokens

| Família | Tokens novos | Uso |
|---|---|---|
| Espaço | `--sp-space-0` a `--sp-space-12` | passos de 0,25 rem |
| Tipografia | `--sp-font-size-xs/sm/md/lg/xl/2xl/3xl` | 0,75 a 2 rem |
| Peso e ritmo | `--sp-font-weight-normal/medium/semibold/bold`, `--sp-line-height-tight/normal/relaxed` | hierarquia consistente |
| Controles | `--sp-control-height-sm/md/lg`, `--sp-control-border`, `--sp-radius-control`, `--sp-border-width` | altura 2/2,5/3 rem; borda perceptível |
| Ação e foco | `--sp-action-bg/hover`, `--sp-focus-color`, `--sp-disabled-opacity` | branco sobre azul acessível e foco por tema |
| Conteúdo e feedback | `--sp-content-secondary`, `--sp-feedback-success/warning/danger-text` | texto contextual sem depender apenas da cor |
| Movimento | `--sp-duration-fast/normal/slow`, `--sp-ease` | 120/180/240 ms; respeitar movimento reduzido |
| Sobreposição | `--sp-overlay`, `--sp-tooltip-bg/text`, `--sp-z-dropdown/tooltip/modal` | camadas e contraste |

Raios `--sp-radius-sm`, `--sp-radius`, `--sp-radius-lg`, `--sp-radius-pill` e sombras
`--sp-shadow-sm`, `--sp-shadow`, `--sp-shadow-lg` são reutilizados. Não codificar cores
novas nos componentes. `--sp-text-muted` legado serve a conteúdo decorativo/desabilitado,
não a texto informativo normal. O foco não deve ser removido em favor apenas de sombra.

## Catálogo

| Peça | API principal | Quando usar |
|---|---|---|
| `button[spButton]` | variant primary/secondary/ghost/danger; size sm/md/lg; loading/disabled | ações; type button padrão, submit explícito em formulários |
| `sp-icon-button` | label e icon obrigatórios; size/variant/loading/disabled | ação compacta, com nome acessível explícito |
| `input[spInput]`, `textarea[spInput]` | controlSize; error | entrada nativa com formControl/required/disabled do Angular |
| `select[spSelect]` | controlSize; error | seleção simples nativa; não substituir por menu |
| `input[type=checkbox][spCheckbox]` | controlSize; error; indeterminate | escolha booleana/seleção parcial, com label associado |
| `sp-form-field` | label/controlId; hint/error/required; controle projetado | associar rótulo, ajuda e erro preservando descrições externas |
| `sp-card` | variant default/outlined/muted; padding sm/md/lg | agrupamento visual de conteúdo; sem ação implícita |
| `sp-badge` | variant neutral/info/success/warning/danger; size sm/md | estado curto acompanhado de texto |
| `sp-modal` | open/title/description/size; closed; closeOnEscape/Backdrop | decisão contextual que requer foco, sem substituir uma página |
| `[spTooltip]` | texto | ajuda suplementar sobre um elemento já focável; informação essencial deve ficar visível |
| `sp-dropdown` | label/items/disabled; selected(id) | menu de ações; itens id/label/icon?/disabled? |
| `sp-page-header` | title/description/eyebrow; headingLevel 1/2; slot `[spHeaderActions]` | cabeçalho de página (h1) ou seção (h2) com ações projetadas |
| `sp-empty-state` | title/description/icon; ação projetada | orientar o próximo passo quando não há conteúdo |
| `sp-loading-state` | label/size | anunciar uma operação em andamento, com role status |

`sp-icon`, gráficos e `spDialogFocus` existentes continuam sendo as implementações
compartilhadas; não foram duplicados. Ícones decorativos permanecem aria-hidden.

```ts
import { SpButtonDirective, SpInputDirective, SpFormFieldComponent }
  from '../../../shared/ui/design-system';
```

```html
<sp-form-field label="Nome" controlId="name" hint="Como deseja ser chamado?">
  <input spInput id="name" [formControl]="name" />
</sp-form-field>
<button spButton type="submit" [loading]="saving()">Salvar</button>
```

O `required` do FormField indica visualmente o requisito; a validação vem do controle
(`Validators.required` ou atributo nativo). `loading` não apaga o nome do botão.
Não aninhar controles interativos dentro de outro botão ou transformar um Card em botão.
O LoadingState anuncia sua mensagem com `role="status"`; aplicar `aria-busy` na região
de conteúdo que está sendo atualizada, sem silenciar o próprio anúncio de carregamento.

## Demonstração e exclusão de produção

`design-system.routes.ts` é vazio por padrão. Somente a configuração Angular CLI
`development` o substitui por `design-system.routes.dev.ts`, que contém a rota lazy e
`canMatch` com `isDevMode`. Assim, o graph de produção não importa o showcase. Nenhum
link é adicionado aos menus funcionais, e a página não chama APIs nem exibe dados reais.
O fallback de URLs desconhecidas segue o contrato atual, sem inventar HTTP 404.

No PowerShell, usar `npm.cmd start` e abrir `/design-system`.
Para gerar produção: `npm.cmd run build`.
A seleção de tema usa o mesmo serviço e a mesma preferência de toda a aplicação.

Referências técnicas: [substituição de arquivos no Angular CLI](https://angular.dev/tools/cli/environments),
[isDevMode](https://angular.dev/api/core/isDevMode) e
[bindings do elemento host](https://angular.dev/guide/components/host-elements).

## Validação e limites

Testes de comportamento cobrem formulários, disabled/loading, mensagens associadas,
foco e teclado. Navegador real e contraste calculado complementam a regressão e os builds.
Checks automáticos não equivalem a uma auditoria completa WCAG nem a teste manual com
leitor de tela. As páginas de calendário/financeiro/admin/login não são migradas nesta etapa.
