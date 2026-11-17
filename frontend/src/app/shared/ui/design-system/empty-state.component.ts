import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, IconName } from '../icon/icon';

@Component({
  selector: 'sp-empty-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="illustration"><sp-icon [name]="icon()" [size]="28" /></span>
    <h3>{{ title() }}</h3>
    @if (description()) { <p>{{ description() }}</p> }
    <div class="actions"><ng-content /></div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; align-items: center; padding: var(--sp-space-8) var(--sp-space-4); text-align: center; gap: var(--sp-space-3); }
    .illustration { display: grid; place-items: center; width: var(--sp-space-12); height: var(--sp-space-12); border-radius: var(--sp-radius); color: var(--sp-personal-text); background: var(--sp-personal-bg); }
    h3 { margin: 0; font-size: var(--sp-font-size-lg); line-height: var(--sp-line-height-tight); font-weight: var(--sp-font-weight-semibold); }
    p { margin: 0; max-width: 42ch; font-size: var(--sp-font-size-sm); line-height: var(--sp-line-height-relaxed); color: var(--sp-content-secondary); }
    .actions { display: flex; justify-content: center; flex-wrap: wrap; gap: var(--sp-space-2); }
    .actions:empty { display: none; }
  `,
})
export class SpEmptyState {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly icon = input<IconName>('calendar');
}
