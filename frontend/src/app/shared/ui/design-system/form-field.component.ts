import { booleanAttribute, ChangeDetectionStrategy, Component, computed, contentChild, effect, input } from '@angular/core';
import { SpCheckboxDirective } from './checkbox.component';
import { SpInputDirective } from './input.directive';
import { SpSelectDirective } from './select.directive';

/** Layout and accessible descriptions for one native control; validation belongs to its form. */
@Component({
  selector: 'sp-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sp-ds-form-field' },
  template: `
    <label class="sp-ds-form-field__label" [attr.for]="effectiveControlId()">
      {{ label() }}
      @if (required()) { <span aria-hidden="true"> *</span><span class="sr-only"> (obrigatório)</span> }
    </label>
    <ng-content />
    @if (hint()) { <span class="sp-ds-form-field__hint" [id]="controlId() + '-hint'">{{ hint() }}</span> }
    @if (error()) {
      <span class="sp-ds-form-field__error" role="alert" [id]="controlId() + '-error'">{{ error() }}</span>
    }
  `,
})
export class SpFormFieldComponent {
  readonly label = input.required<string>();
  readonly controlId = input.required<string>();
  readonly hint = input('');
  readonly error = input('');
  readonly required = input(false, { transform: booleanAttribute });

  private readonly inputControl = contentChild(SpInputDirective);
  private readonly selectControl = contentChild(SpSelectDirective);
  private readonly checkboxControl = contentChild(SpCheckboxDirective);
  private readonly control = computed(() => this.inputControl() ?? this.selectControl() ?? this.checkboxControl());
  readonly effectiveControlId = computed(() => this.control()?.element.id || this.controlId());

  constructor() {
    effect(onCleanup => {
      const control = this.control();
      const id = this.controlId();
      const error = this.error();
      const hint = this.hint();
      if (!control) return;

      const element = control.element;
      const assignedId = !element.id;
      if (assignedId) element.id = id;
      control.fieldError.set(!!error);

      const ownedIds = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean);
      const existingIds = (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
      const descriptions = [...new Set([...existingIds, ...ownedIds])];
      if (descriptions.length) element.setAttribute('aria-describedby', descriptions.join(' '));

      onCleanup(() => {
        control.fieldError.set(false);
        const remaining = (element.getAttribute('aria-describedby') ?? '').split(/\s+/)
          .filter(token => token && !ownedIds.includes(token));
        if (remaining.length) element.setAttribute('aria-describedby', remaining.join(' '));
        else element.removeAttribute('aria-describedby');
        if (assignedId && element.id === id) element.removeAttribute('id');
      });
    });
  }
}
