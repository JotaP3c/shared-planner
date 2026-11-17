import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SpButtonDirective } from './button.directive';
import { SpCheckboxDirective } from './checkbox.component';
import { SpFormFieldComponent } from './form-field.component';
import { SpIconButtonComponent } from './icon-button.component';
import { SpInputDirective } from './input.directive';
import { SpSelectDirective } from './select.directive';

@Component({
  imports: [ReactiveFormsModule, SpButtonDirective, SpIconButtonComponent, SpInputDirective,
    SpSelectDirective, SpCheckboxDirective, SpFormFieldComponent],
  template: `
    <form (submit)="submits = submits + 1; $event.preventDefault()">
      <button id="action" spButton [loading]="busy()" [disabled]="disabled()" (click)="clicks = clicks + 1">Salvar alterações</button>
      <button id="submit" spButton type="submit">Enviar formulário</button>
      <sp-icon-button icon="trash" label="Excluir exemplo" [loading]="busy()" [disabled]="disabled()" (click)="iconClicks = iconClicks + 1" />
      <span id="external-hint">Orientação adicional</span>
      <sp-form-field label="Nome" controlId="name" hint="Use seu nome completo" [error]="error()" required>
        <input spInput [formControl]="name" aria-describedby="external-hint" required />
      </sp-form-field>
      <sp-form-field label="Agenda" controlId="calendar" [error]="selectError()">
        <select id="existing-calendar" spSelect [formControl]="calendar">
          <option value="personal">Pessoal</option><option value="shared">Compartilhada</option>
        </select>
      </sp-form-field>
      <sp-form-field label="Receber atualizações" controlId="updates" [error]="checkboxError()">
        <input type="checkbox" spCheckbox [formControl]="updates" [indeterminate]="mixed()" />
      </sp-form-field>
    </form>
  `,
})
class ControlsHost {
  readonly busy = signal(false);
  readonly disabled = signal(false);
  readonly error = signal('');
  readonly selectError = signal('');
  readonly checkboxError = signal('');
  readonly mixed = signal(false);
  readonly name = new FormControl('', { nonNullable: true });
  readonly calendar = new FormControl('personal', { nonNullable: true });
  readonly updates = new FormControl(false, { nonNullable: true });
  clicks = 0;
  iconClicks = 0;
  submits = 0;
}

describe('Design system native controls', () => {
  let fixture: ComponentFixture<ControlsHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ControlsHost] }).compileComponents();
    fixture = TestBed.createComponent(ControlsHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const query = <T extends HTMLElement>(selector: string): T => fixture.nativeElement.querySelector(selector) as T;

  it('defaults actions to button while preserving an explicit submit button', () => {
    query<HTMLButtonElement>('#action').click();
    expect(fixture.componentInstance.clicks).toBe(1);
    expect(fixture.componentInstance.submits).toBe(0);
    expect(query<HTMLButtonElement>('#action').type).toBe('button');
    query<HTMLButtonElement>('#submit').click();
    expect(fixture.componentInstance.submits).toBe(1);
  });

  it('blocks native and delegated click actions while loading, preserving the accessible label', async () => {
    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();
    const action = query<HTMLButtonElement>('#action');
    expect(action.disabled).toBe(true);
    expect(action.getAttribute('aria-busy')).toBe('true');
    expect(action.textContent).toContain('Salvar alterações');
    action.click();
    action.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    query<HTMLButtonElement>('sp-icon-button button').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(fixture.componentInstance.clicks).toBe(0);
    expect(fixture.componentInstance.iconClicks).toBe(0);

    fixture.componentInstance.busy.set(false);
    fixture.detectChanges();
    action.click();
    expect(fixture.componentInstance.clicks).toBe(1);
  });

  it('provides an accessible name for icon actions and respects disabled', () => {
    const icon = query<HTMLButtonElement>('sp-icon-button button');
    expect(icon.getAttribute('aria-label')).toBe('Excluir exemplo');
    expect(query('sp-icon-button sp-icon').getAttribute('aria-hidden')).toBe('true');
    icon.click();
    expect(fixture.componentInstance.iconClicks).toBe(1);
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    icon.click();
    expect(icon.disabled).toBe(true);
    expect(fixture.componentInstance.iconClicks).toBe(1);
  });

  it('connects labels and descriptions without replacing an existing native id or external hint', async () => {
    expect(query<HTMLInputElement>('[spInput]').id).toBe('name');
    expect(query<HTMLLabelElement>('label[for="name"]').textContent).toContain('Nome');
    expect(query<HTMLLabelElement>('label[for="name"]').textContent).toContain('obrigatório');
    expect(query<HTMLInputElement>('[spInput]').getAttribute('aria-describedby')?.split(' '))
      .toEqual(['external-hint', 'name-hint']);
    expect(query<HTMLLabelElement>('label[for="existing-calendar"]').textContent).toContain('Agenda');
    expect(query<HTMLSelectElement>('[spSelect]').id).toBe('existing-calendar');
  });

  it('announces validation and removes only its own error description when corrected', async () => {
    fixture.componentInstance.error.set('Informe o nome.');
    fixture.detectChanges();
    await fixture.whenStable();
    const control = query<HTMLInputElement>('[spInput]');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(control.getAttribute('aria-describedby')?.split(' '))
      .toEqual(['external-hint', 'name-hint', 'name-error']);
    expect(query('#name-error').getAttribute('role')).toBe('alert');

    fixture.componentInstance.error.set('');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(control.getAttribute('aria-invalid')).toBeNull();
    expect(control.getAttribute('aria-describedby')?.split(' ')).toEqual(['external-hint', 'name-hint']);
    expect(fixture.nativeElement.querySelector('#name-error')).toBeNull();
  });

  it('retains native Angular reactive form values and disabled propagation', async () => {
    const input = query<HTMLInputElement>('[spInput]');
    input.value = 'Joana';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(fixture.componentInstance.name.value).toBe('Joana');

    const select = query<HTMLSelectElement>('[spSelect]');
    select.value = 'shared';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(fixture.componentInstance.calendar.value).toBe('shared');

    const checkbox = query<HTMLInputElement>('[spCheckbox]');
    checkbox.click();
    expect(fixture.componentInstance.updates.value).toBe(true);
    fixture.componentInstance.name.disable();
    fixture.componentInstance.calendar.disable();
    fixture.componentInstance.updates.disable();
    fixture.detectChanges();
    expect(input.disabled).toBe(true);
    expect(select.disabled).toBe(true);
    expect(checkbox.disabled).toBe(true);
    fixture.componentInstance.name.enable();
    fixture.componentInstance.calendar.enable();
    fixture.componentInstance.updates.enable();
    fixture.detectChanges();
    expect(input.disabled).toBe(false);
    expect(select.disabled).toBe(false);
    expect(checkbox.disabled).toBe(false);
  });

  it('supports the native mixed checkbox state and validation on select/checkbox', async () => {
    fixture.componentInstance.mixed.set(true);
    fixture.componentInstance.selectError.set('Selecione uma agenda válida.');
    fixture.componentInstance.checkboxError.set('Confirme sua escolha.');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(query<HTMLInputElement>('[spCheckbox]').indeterminate).toBe(true);
    expect(query('[spCheckbox]').getAttribute('aria-invalid')).toBe('true');
    expect(query('[spSelect]').getAttribute('aria-invalid')).toBe('true');
    expect(query('[spCheckbox]').getAttribute('aria-describedby')).toBe('updates-error');
  });
});
