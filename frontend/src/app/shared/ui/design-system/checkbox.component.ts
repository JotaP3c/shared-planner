import { booleanAttribute, computed, Directive, ElementRef, inject, input, signal } from '@angular/core';
import { ControlSize } from './button.directive';

/** The native checkbox provides keyboard, mixed-state and Angular Forms support. */
@Directive({
  selector: 'input[type=checkbox][spCheckbox]',
  host: {
    '[attr.data-size]': 'controlSize()',
    '[attr.aria-invalid]': 'invalid() ? "true" : null',
    '[indeterminate]': 'indeterminate()',
  },
})
export class SpCheckboxDirective {
  readonly controlSize = input<ControlSize>('md');
  readonly error = input(false, { transform: booleanAttribute });
  readonly indeterminate = input(false, { transform: booleanAttribute });
  readonly fieldError = signal(false);
  readonly invalid = computed(() => this.error() || this.fieldError());
  readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
}
