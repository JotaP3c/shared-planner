import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'sp-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sp-card ds-card', '[attr.data-variant]': 'variant()', '[attr.data-padding]': 'padding()' },
  template: '<ng-content />',
  styles: `
    :host { display: block; min-width: 0; padding: var(--sp-space-6); }
    :host([data-padding=sm]) { padding: var(--sp-space-3); }
    :host([data-padding=lg]) { padding: var(--sp-space-8); }
    :host([data-variant=outlined]) { box-shadow: none; border-color: var(--sp-border-strong); }
    :host([data-variant=muted]) { background: var(--sp-surface-2); box-shadow: none; }
  `,
})
export class SpCard {
  readonly variant = input<'default' | 'outlined' | 'muted'>('default');
  readonly padding = input<'sm' | 'md' | 'lg'>('md');
}
