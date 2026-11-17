import { booleanAttribute, computed, Directive, ElementRef, inject, input, signal } from '@angular/core';
import { ControlSize } from './button.directive';

@Directive({
  selector: 'select[spSelect]',
  host: {
    '[attr.data-size]': 'controlSize()',
    '[attr.aria-invalid]': 'invalid() ? "true" : null',
  },
})
export class SpSelectDirective {
  readonly controlSize = input<ControlSize>('md');
  readonly error = input(false, { transform: booleanAttribute });
  readonly fieldError = signal(false);
  readonly invalid = computed(() => this.error() || this.fieldError());
  readonly element = inject<ElementRef<HTMLSelectElement>>(ElementRef).nativeElement;
}
