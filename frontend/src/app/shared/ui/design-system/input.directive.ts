import { booleanAttribute, computed, Directive, ElementRef, inject, input, signal } from '@angular/core';
import { ControlSize } from './button.directive';

@Directive({
  selector: 'input[spInput], textarea[spInput]',
  host: {
    '[attr.data-size]': 'controlSize()',
    '[attr.aria-invalid]': 'invalid() ? "true" : null',
  },
})
export class SpInputDirective {
  readonly controlSize = input<ControlSize>('md');
  readonly error = input(false, { transform: booleanAttribute });
  /** Used by the containing form field; disabled remains owned by the native control/CVA. */
  readonly fieldError = signal(false);
  readonly invalid = computed(() => this.error() || this.fieldError());
  readonly element = inject<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(ElementRef).nativeElement;
}
