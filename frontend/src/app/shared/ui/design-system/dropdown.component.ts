import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, effect, inject, input, output, signal, viewChild, viewChildren } from '@angular/core';
import { Icon, IconName } from '../icon/icon';
import { SpButtonDirective } from './button.directive';

export interface SpDropdownItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconName;
  readonly disabled?: boolean;
}

let dropdownSequence = 0;

@Component({
  selector: 'sp-dropdown',
  imports: [Icon, SpButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onOutsideClick($event)' },
  template: `
    <button #trigger spButton variant="secondary" [disabled]="disabled()" aria-haspopup="menu"
      [attr.aria-expanded]="isOpen()" [attr.aria-controls]="isOpen() ? menuId : null"
      (click)="toggle()" (keydown)="onTriggerKeydown($event)">
      {{ label() }} <sp-icon name="chevron-down" [size]="16" />
    </button>
    @if (isOpen()) {
      <div #menu class="menu" role="menu" [id]="menuId" [attr.aria-label]="label()" (keydown)="onMenuKeydown($event)">
        @for (item of items(); track item.id) {
          <button #menuItem type="button" role="menuitem" [disabled]="item.disabled" tabindex="-1" (click)="choose(item)">
            @if (item.icon) { <sp-icon [name]="item.icon" [size]="16" /> }
            {{ item.label }}
          </button>
        }
        @if (!items().length) { <span class="empty" role="menuitem" aria-disabled="true">Nenhuma ação disponível.</span> }
      </div>
    }
  `,
  styles: `
    :host { position: relative; display: inline-block; max-width: 100%; }
    .menu { position: absolute; z-index: var(--sp-z-dropdown); inset-block-start: calc(100% + var(--sp-space-2)); inset-inline-start: 0; display: grid; min-width: min(13rem, calc(100vw - var(--sp-space-8))); max-width: calc(100vw - var(--sp-space-8)); max-height: min(20rem, 60vh); overflow: auto; padding: var(--sp-space-1); border: var(--sp-border-width) solid var(--sp-border-strong); border-radius: var(--sp-radius); background: var(--sp-surface); color: var(--sp-text); box-shadow: var(--sp-shadow-lg); }
    .menu[data-align=end] { inset-inline-start: auto; inset-inline-end: 0; }
    .menu[data-position=above] { inset-block-start: auto; inset-block-end: calc(100% + var(--sp-space-2)); }
    .menu button { display: flex; align-items: center; gap: var(--sp-space-2); width: 100%; min-height: var(--sp-control-height-md); padding: var(--sp-space-2) var(--sp-space-3); border: 0; border-radius: var(--sp-radius-sm); background: transparent; color: inherit; text-align: start; font-size: var(--sp-font-size-sm); cursor: pointer; overflow-wrap: anywhere; }
    .menu button:not(:disabled):hover { background: var(--sp-surface-hover); }
    .menu button:focus-visible { outline: 2px solid var(--sp-focus-color); outline-offset: -2px; background: var(--sp-surface-hover); }
    .menu button:disabled { opacity: var(--sp-disabled-opacity); cursor: not-allowed; }
    .empty { padding: var(--sp-space-3); font-size: var(--sp-font-size-sm); color: var(--sp-content-secondary); }
    @media (forced-colors: active) { .menu { border-color: CanvasText; } }
  `,
})
export class SpDropdown {
  readonly label = input.required<string>();
  readonly items = input<readonly SpDropdownItem[]>([]);
  readonly disabled = input(false);
  readonly selected = output<string>();
  readonly isOpen = signal(false);
  readonly menuId = `sp-dropdown-${++dropdownSequence}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menu = viewChild<ElementRef<HTMLElement>>('menu');
  private readonly menuItems = viewChildren<ElementRef<HTMLButtonElement>>('menuItem');
  private readonly injector = inject(Injector);

  constructor() {
    effect(() => { if (this.disabled()) this.isOpen.set(false); });
  }

  toggle(): void {
    if (this.disabled()) return;
    if (this.isOpen()) this.close(false);
    else this.openMenu('first');
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.isOpen() && event.key === 'Escape') { event.preventDefault(); this.close(true); return; }
    if (this.isOpen() && event.key === 'Tab') { this.close(false); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!this.disabled()) this.openMenu(event.key === 'ArrowUp' ? 'last' : 'first');
  }

  onMenuKeydown(event: KeyboardEvent): void {
    const items = this.enabledItems();
    const current = items.findIndex(item => item === this.document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); this.close(true);
    } else if (event.key === 'Tab') {
      // Return to the trigger before native Tab chooses the next control in DOM order.
      this.close(true);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!items.length) return;
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : event.key === 'ArrowDown' ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length;
      items[index].focus();
    }
  }

  choose(item: SpDropdownItem): void {
    if (item.disabled || this.disabled()) return;
    this.selected.emit(item.id);
    this.close(true);
  }

  onOutsideClick(event: MouseEvent): void {
    if (this.isOpen() && event.target instanceof Node && !this.host.nativeElement.contains(event.target)) this.close(false);
  }

  private openMenu(edge: 'first' | 'last'): void {
    this.isOpen.set(true);
    afterNextRender(() => {
      if (!this.isOpen()) return;
      this.positionMenu();
      const items = this.enabledItems();
      (edge === 'last' ? items.at(-1) : items[0])?.focus();
    }, { injector: this.injector });
  }

  private enabledItems(): HTMLButtonElement[] {
    return this.menuItems().map(item => item.nativeElement).filter(item => !item.disabled);
  }

  private positionMenu(): void {
    const menu = this.menu()?.nativeElement;
    const trigger = this.trigger()?.nativeElement.getBoundingClientRect();
    const viewport = this.document.defaultView;
    if (!menu || !trigger || !viewport) return;
    const bounds = menu.getBoundingClientRect();
    if (bounds.right > viewport.innerWidth - 8) menu.dataset['align'] = 'end';
    const below = viewport.innerHeight - trigger.bottom - 16;
    const above = trigger.top - 16;
    const opensAbove = bounds.height > below && above > below;
    menu.dataset['position'] = opensAbove ? 'above' : 'below';
    menu.style.maxHeight = `${Math.max(44, Math.min(320, opensAbove ? above : below))}px`;
  }

  private close(restoreFocus: boolean): void {
    this.isOpen.set(false);
    if (restoreFocus) this.trigger()?.nativeElement.focus();
  }
}

