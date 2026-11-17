import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'sp-loading-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Keep the live message available; aria-busy belongs on the content being loaded.
  host: { role: 'status', 'aria-live': 'polite', '[attr.data-size]': 'size()' },
  template: '<span class="spinner" aria-hidden="true"></span><span>{{ label() }}</span>',
  styles: `
    :host { display: flex; align-items: center; justify-content: center; gap: var(--sp-space-3); min-height: var(--sp-control-height-lg); padding: var(--sp-space-4); color: var(--sp-content-secondary); font-size: var(--sp-font-size-sm); }
    .spinner { display: inline-block; flex: 0 0 auto; width: var(--sp-space-6); height: var(--sp-space-6); border: 2px solid var(--sp-border-strong); border-top-color: var(--sp-focus-color); border-radius: var(--sp-radius-pill); animation: sp-ds-loading 800ms linear infinite; }
    :host([data-size=sm]) { min-height: var(--sp-control-height-sm); padding: var(--sp-space-2); }
    :host([data-size=sm]) .spinner { width: var(--sp-space-4); height: var(--sp-space-4); }
    :host([data-size=lg]) { min-height: 8rem; flex-direction: column; }
    :host([data-size=lg]) .spinner { width: var(--sp-space-8); height: var(--sp-space-8); }
    @keyframes sp-ds-loading { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
    @media (forced-colors: active) { .spinner { border-color: GrayText; border-top-color: CanvasText; } }
  `,
})
export class SpLoadingState {
  readonly label = input('Carregando…');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
}
