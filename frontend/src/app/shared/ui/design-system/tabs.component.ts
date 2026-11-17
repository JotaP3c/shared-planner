import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, viewChildren } from '@angular/core';

export interface SpTabItem {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly panelId?: string;
}

let tabsSequence = 0;

/** Native toggle buttons for view switches; ARIA tabs for real tab panels. */
@Component({
  selector: 'sp-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sp-tabs" [attr.role]="mode() === 'tabs' ? 'tablist' : 'group'" [attr.aria-label]="label()">
      @for (item of items(); track item.id) {
        <button #tabButton type="button" [id]="tabId(item.id)" [disabled]="!!item.disabled"
          [class.active]="value() === item.id" [attr.role]="mode() === 'tabs' ? 'tab' : null"
          [attr.aria-selected]="mode() === 'tabs' ? value() === item.id : null"
          [attr.aria-pressed]="mode() === 'toggle' ? value() === item.id : null"
          [attr.aria-controls]="mode() === 'tabs' ? item.panelId || null : null"
          [tabIndex]="mode() === 'toggle' || isTabStop(item) ? 0 : -1"
          (click)="select(item)" (keydown)="onKeydown($event)">{{ item.label }}</button>
      }
    </div>
  `,
  styles: `
    :host { display: inline-flex; min-width: 0; max-width: 100%; }
    .sp-tabs { display: inline-flex; flex-wrap: wrap; gap: var(--sp-space-1); padding: var(--sp-space-1); border: var(--sp-border-width) solid var(--sp-border); border-radius: var(--sp-radius-control); background: var(--sp-surface-2); }
    button { min-height: var(--sp-control-height-sm); padding: var(--sp-space-2) var(--sp-space-4); border: 0; border-radius: var(--sp-radius-sm); background: transparent; color: var(--sp-content-secondary); font: inherit; font-size: var(--sp-font-size-sm); font-weight: var(--sp-font-weight-semibold); cursor: pointer; transition: background var(--sp-duration-fast) var(--sp-ease), color var(--sp-duration-fast) var(--sp-ease); }
    button:hover:not(:disabled) { background: var(--sp-surface-hover); color: var(--sp-text); }
    button.active { background: var(--sp-surface); color: var(--sp-personal-text); box-shadow: var(--sp-shadow-sm); }
    button:focus-visible { outline: 2px solid var(--sp-focus-color); outline-offset: 1px; }
    button:disabled { opacity: var(--sp-disabled-opacity); cursor: not-allowed; }
    @media (forced-colors: active) { button.active { border: 1px solid Highlight; } }
  `,
})
export class SpTabs {
  readonly items = input<readonly SpTabItem[]>([]);
  readonly value = input('');
  readonly valueChange = output<string>();
  readonly label = input('Opções');
  readonly mode = input<'tabs' | 'toggle'>('tabs');
  readonly id = input(`sp-tabs-${++tabsSequence}`);
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');
  private readonly document = inject(DOCUMENT);

  tabId(id: string): string { return `${this.id()}-${id}`; }

  isTabStop(item: SpTabItem): boolean {
    const enabled = this.items().filter(candidate => !candidate.disabled);
    const selected = enabled.find(candidate => candidate.id === this.value()) ?? enabled[0];
    return item === selected;
  }

  select(item: SpTabItem): void {
    if (!item.disabled && item.id !== this.value()) this.valueChange.emit(item.id);
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.mode() !== 'tabs' || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabledButtons = this.buttons().map(button => button.nativeElement).filter(button => !button.disabled);
    if (!enabledButtons.length) return;
    const current = enabledButtons.indexOf(this.document.activeElement as HTMLButtonElement);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? enabledButtons.length - 1
      : event.key === 'ArrowRight' ? (current + 1) % enabledButtons.length
      : (current - 1 + enabledButtons.length) % enabledButtons.length;
    const button = enabledButtons[index];
    button.focus();
    button.click();
  }
}
