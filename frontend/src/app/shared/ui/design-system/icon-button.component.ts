import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, IconName } from '../icon/icon';
import { ButtonVariant, ControlSize, SpButtonDirective } from './button.directive';

@Component({
  selector: 'sp-icon-button',
  imports: [Icon, SpButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sp-ds-icon-button' },
  template: `
    <button spButton class="sp-ds-icon-button__control" [variant]="variant()"
      [size]="size()" [disabled]="disabled()" [loading]="loading()"
      [attr.aria-label]="label()" [attr.title]="label()">
      <sp-icon [name]="icon()" [size]="18" />
    </button>
  `,
})
export class SpIconButtonComponent {
  readonly icon = input.required<IconName>();
  readonly label = input.required<string>();
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ControlSize>('md');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
}
