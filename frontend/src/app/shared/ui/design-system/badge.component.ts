import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'sp-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sp-pill ds-badge', '[attr.data-variant]': 'variant()', '[attr.data-size]': 'size()' },
  template: '<ng-content />',
  styles: `
    :host { max-width: 100%; padding: var(--sp-space-1) var(--sp-space-2); background: var(--sp-surface-2); color: var(--sp-content-secondary); font-size: var(--sp-font-size-xs); font-weight: var(--sp-font-weight-semibold); }
    :host([data-size=md]) { padding: var(--sp-space-1) var(--sp-space-3); font-size: var(--sp-font-size-sm); }
    :host([data-variant=info]) { background: var(--sp-personal-bg); color: var(--sp-personal-text); }
    :host([data-variant=success]) { background: var(--sp-success-bg); color: var(--sp-feedback-success-text); }
    :host([data-variant=warning]) { background: var(--sp-warning-bg); color: var(--sp-feedback-warning-text); }
    :host([data-variant=danger]) { background: var(--sp-danger-bg); color: var(--sp-feedback-danger-text); }
    @media (forced-colors: active) { :host { border: var(--sp-border-width) solid currentColor; } }
  `,
})
export class SpBadge {
  readonly variant = input<'neutral' | 'info' | 'success' | 'warning' | 'danger'>('neutral');
  readonly size = input<'sm' | 'md'>('sm');
}
