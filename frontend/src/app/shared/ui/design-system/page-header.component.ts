import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'sp-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="copy">
      @if (eyebrow()) { <p class="eyebrow">{{ eyebrow() }}</p> }
      @if (headingLevel() === 1) { <h1>{{ title() }}</h1> }
      @else { <h2>{{ title() }}</h2> }
      @if (description()) { <p class="description">{{ description() }}</p> }
    </div>
    <div class="actions"><ng-content select="[spHeaderActions]" /></div>
  `,
  styles: `
    :host { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--sp-space-4); }
    .copy { flex: 1 1 18rem; min-width: 0; }
    :is(h1, h2) { margin: 0; font-size: var(--sp-font-size-3xl); font-weight: var(--sp-font-weight-bold); line-height: var(--sp-line-height-tight); overflow-wrap: anywhere; }
    p { margin: 0; }
    .eyebrow { margin-block-end: var(--sp-space-2); font-size: var(--sp-font-size-xs); font-weight: var(--sp-font-weight-bold); color: var(--sp-personal-text); letter-spacing: .08em; text-transform: uppercase; }
    .description { margin-block-start: var(--sp-space-2); color: var(--sp-content-secondary); font-size: var(--sp-font-size-md); line-height: var(--sp-line-height-relaxed); }
    .actions { display: flex; gap: var(--sp-space-2); flex-wrap: wrap; align-items: center; }
    .actions:empty { display: none; }
  `,
})
export class SpPageHeader {
  readonly title = input.required<string>();
  readonly headingLevel = input<1 | 2>(1);
  readonly description = input('');
  readonly eyebrow = input('');
}
