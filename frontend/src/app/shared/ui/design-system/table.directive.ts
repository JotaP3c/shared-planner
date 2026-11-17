import { Directive, input } from '@angular/core';

/** Adds presentation to a native table; captions, headers and data stay caller-owned. */
@Directive({
  selector: 'table[spTable]',
  host: { class: 'page-table sp-ds-table', '[attr.data-density]': 'density()' },
})
export class SpTableDirective {
  readonly density = input<'comfortable' | 'compact'>('comfortable');
}
