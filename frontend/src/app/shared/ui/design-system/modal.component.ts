import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, PLATFORM_ID, afterRenderEffect, inject, input, output, viewChild } from '@angular/core';
import { DialogFocusDirective } from '../../a11y/dialog-focus.directive';
import { SpIconButtonComponent } from './icon-button.component';

let modalSequence = 0;
const scrollLocks = new WeakMap<Document, { count: number; previous: string }>();

function lockScroll(document: Document): () => void {
  const state = scrollLocks.get(document) ?? { count: 0, previous: document.body.style.overflow };
  state.count++;
  scrollLocks.set(document, state);
  document.body.style.overflow = 'hidden';
  return () => {
    state.count--;
    if (!state.count) {
      document.body.style.overflow = state.previous;
      scrollLocks.delete(document);
    }
  };
}

@Component({
  selector: 'sp-modal',
  imports: [DialogFocusDirective, SpIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <dialog #dialog spDialogFocus aria-modal="true" [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="description() ? descriptionId : null" [attr.data-size]="size()"
        (cancel)="onCancel($event)" (click)="onBackdrop($event)">
        <div class="panel">
          <header>
            <div>
              <h2 [id]="titleId">{{ title() }}</h2>
              @if (description()) { <p [id]="descriptionId">{{ description() }}</p> }
            </div>
            <sp-icon-button label="Fechar diálogo" icon="x" (click)="closed.emit()" />
          </header>
          <div class="body"><ng-content /></div>
          <footer><ng-content select="[spModalFooter]" /></footer>
        </div>
      </dialog>
    }
  `,
  styles: `
    dialog { position: fixed; inset: 0; width: min(36rem, calc(100% - var(--sp-space-8))); max-height: calc(100dvh - var(--sp-space-8)); margin: auto; padding: 0; overflow: hidden; border: var(--sp-border-width) solid var(--sp-border-strong); border-radius: var(--sp-radius-lg); background: var(--sp-surface); color: var(--sp-text); box-shadow: var(--sp-shadow-lg); }
    dialog[data-size=sm] { width: min(26rem, calc(100% - var(--sp-space-8))); }
    dialog[data-size=lg] { width: min(52rem, calc(100% - var(--sp-space-8))); }
    dialog::backdrop { background: var(--sp-overlay); }
    dialog:focus-visible { outline: 2px solid var(--sp-focus-color); outline-offset: 2px; }
    .panel { display: flex; flex-direction: column; max-height: inherit; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-space-4); padding: var(--sp-space-6); border-block-end: var(--sp-border-width) solid var(--sp-border); }
    h2 { margin: 0; font-size: var(--sp-font-size-xl); line-height: var(--sp-line-height-tight); font-weight: var(--sp-font-weight-semibold); overflow-wrap: anywhere; }
    p { margin: var(--sp-space-2) 0 0; font-size: var(--sp-font-size-sm); color: var(--sp-content-secondary); line-height: var(--sp-line-height-normal); }
    .body { min-height: 0; overflow: auto; padding: var(--sp-space-6); overscroll-behavior: contain; }
    footer { display: flex; flex-wrap: wrap; gap: var(--sp-space-2); justify-content: flex-end; padding: var(--sp-space-4) var(--sp-space-6); border-block-start: var(--sp-border-width) solid var(--sp-border); }
    footer:empty { display: none; }
    @media (max-width: 480px) { header, .body { padding: var(--sp-space-4); } footer { padding: var(--sp-space-4); } }
    @media (forced-colors: active) { dialog { border-color: CanvasText; } }
  `,
})
export class SpModal {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly description = input('');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly closeOnEscape = input(true);
  readonly closeOnBackdrop = input(true);
  readonly closed = output<void>();
  readonly titleId = `sp-modal-${++modalSequence}-title`;
  readonly descriptionId = `${this.titleId}-description`;
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly dialogFocus = viewChild(DialogFocusDirective);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    afterRenderEffect(onCleanup => {
      const dialog = this.dialog()?.nativeElement;
      if (!this.open() || !dialog || !this.isBrowser) return;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', ''); // DOM test environments without native dialog support.
      this.dialogFocus()?.focusInitial();
      const unlock = lockScroll(this.document);
      onCleanup(() => {
        if (dialog.open && typeof dialog.close === 'function') dialog.close();
        unlock();
      });
    });
  }

  onCancel(event: Event): void {
    event.preventDefault(); // The parent owns open; do not let native state diverge.
    if (this.closeOnEscape()) this.closed.emit();
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget && this.closeOnBackdrop()) this.closed.emit();
  }
}
