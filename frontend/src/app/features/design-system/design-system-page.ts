import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ThemePreference, ThemeService } from '../../core/theme/theme.service';
import { Icon } from '../../shared/ui/icon/icon';
import {
  SpBadge, SpButtonDirective, SpCard, SpCheckboxDirective, SpDropdown, SpDropdownItem,
  SpEmptyState, SpFormFieldComponent, SpIconButtonComponent, SpInputDirective,
  SpLoadingState, SpModal, SpPageHeader, SpSelectDirective, SpTableDirective, SpTabs, SpTooltip,
} from '../../shared/ui/design-system';

@Component({
  selector: 'sp-design-system-page',
  imports: [RouterLink, ReactiveFormsModule, Icon, SpBadge, SpButtonDirective, SpCard,
    SpCheckboxDirective, SpDropdown, SpEmptyState, SpFormFieldComponent, SpIconButtonComponent,
    SpInputDirective, SpLoadingState, SpModal, SpPageHeader, SpSelectDirective, SpTableDirective, SpTabs, SpTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './design-system-page.html',
  styleUrl: './design-system-page.scss',
})
export class DesignSystemPage {
  readonly theme = inject(ThemeService);
  readonly modalOpen = signal(false);
  readonly exampleTab = signal('overview');
  readonly exampleTabs = [
    { id: 'overview', label: 'Visão geral', panelId: 'ds-overview-panel' },
    { id: 'details', label: 'Detalhes', panelId: 'ds-details-panel' },
  ];
  readonly formSubmitted = signal(false);
  readonly feedback = signal('');
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    calendar: new FormControl('personal', { nonNullable: true }),
    notifications: new FormControl(true, { nonNullable: true }),
  });
  readonly themes: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' }, { value: 'system', label: 'Sistema' },
  ];
  readonly sections = [
    { id: 'foundations', label: 'Fundamentos' }, { id: 'buttons', label: 'Ações' },
    { id: 'forms', label: 'Formulários' }, { id: 'surfaces', label: 'Superfícies' },
    { id: 'overlays', label: 'Interações' }, { id: 'states', label: 'Estados' },
  ];
  readonly palette = [
    { name: 'Ação', token: '--sp-action-bg', label: 'Ação principal' },
    { name: 'Navy', token: '--sp-navy', label: 'Identidade da marca' },
    { name: 'Fundo', token: '--sp-bg', label: 'Plano de fundo' },
    { name: 'Superfície', token: '--sp-surface', label: 'Conteúdo e cartões' },
    { name: 'Sucesso', token: '--sp-success', label: 'Feedback positivo' },
    { name: 'Atenção', token: '--sp-pending', label: 'Feedback de atenção' },
  ];
  readonly spacing = [1, 2, 3, 4, 6, 8, 12];
  readonly menuItems: readonly SpDropdownItem[] = [
    { id: 'details', label: 'Ver detalhes', icon: 'eye' },
    { id: 'duplicate', label: 'Duplicar exemplo', icon: 'layers' },
    { id: 'archive', label: 'Arquivar exemplo', icon: 'inbox', disabled: true },
  ];
  readonly nameError = () => this.formSubmitted() && this.form.controls.name.invalid
    ? 'Informe um nome para continuar.' : '';

  submitExample(): void {
    this.formSubmitted.set(true);
    this.form.markAllAsTouched();
    this.feedback.set(this.form.valid ? 'Exemplo validado. Nenhum dado foi enviado.' : 'Revise os campos indicados.');
  }

  selectExample(id: string): void {
    const label = this.menuItems.find(item => item.id === id)?.label ?? id;
    this.feedback.set(`Ação demonstrada: ${label}.`);
  }
}
