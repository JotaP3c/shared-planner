import { booleanAttribute, computed, Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ControlSize = 'sm' | 'md' | 'lg';

/** Native buttons retain their form semantics and accessible text while loading. */
@Directive({
  selector: 'button[spButton]',
  host: {
    '[attr.type]': 'type',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
    '[disabled]': 'unavailable()',
    '[attr.aria-busy]': 'loading() ? "true" : null',
  },
})
export class SpButtonDirective implements OnDestroy {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ControlSize>('md');
  readonly loading = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly unavailable = computed(() => this.disabled() || this.loading());

  private readonly element = inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement;
  readonly type = this.element.getAttribute('type') ?? 'button';
  private readonly blockUnavailableClick = (event: Event) => {
    if (this.unavailable()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  constructor() {
    // Capture blocks delegated actions as well as direct handlers on a busy button.
    this.element.addEventListener?.('click', this.blockUnavailableClick, true);
  }

  ngOnDestroy(): void {
    this.element.removeEventListener?.('click', this.blockUnavailableClick, true);
  }
}
