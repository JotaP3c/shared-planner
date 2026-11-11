import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Gerência de foco de diálogos modais (WAI-ARIA APG):
 * - foco inicial no primeiro campo (ou no próprio diálogo);
 * - Tab / Shift+Tab ficam contidos no diálogo;
 * - ao destruir, o foco volta ao elemento que abriu o diálogo.
 * Escape continua tratado pelo template de cada diálogo.
 */
@Directive({
  selector: '[spDialogFocus]',
  host: {
    '(keydown)': 'onKeydown($event)',
  },
})
export class DialogFocusDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly previouslyFocused: HTMLElement | null =
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  ngAfterViewInit(): void {
    const element = this.host.nativeElement;

    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '-1');
    }

    const preferred = element.querySelector<HTMLElement>('[autofocus], [data-autofocus]')
      ?? this.focusable().find(item => item.tagName !== 'BUTTON' || !item.classList.contains('icon-button'))
      ?? element;

    preferred.focus();
  }

  ngOnDestroy(): void {
    if (this.previouslyFocused && this.previouslyFocused.isConnected) {
      this.previouslyFocused.focus();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }

    const items = this.focusable();

    if (!items.length) {
      event.preventDefault();
      this.host.nativeElement.focus();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === this.host.nativeElement)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusable(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(item => !item.hasAttribute('inert') && item.getAttribute('aria-hidden') !== 'true');
  }
}
