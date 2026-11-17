import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SpTabs } from './tabs.component';
import { SpTableDirective } from './table.directive';

@Component({
  imports: [SpTabs, SpTableDirective],
  template: `
    <sp-tabs [items]="items" [value]="selected()" (valueChange)="selected.set($event)" [mode]="mode()" />
    <table spTable class="is-stackable" density="compact"><caption>Dados do exemplo</caption>
      <thead><tr><th scope="col">Nome</th></tr></thead><tbody><tr><td>Exemplo</td></tr></tbody></table>
  `,
})
class NavigationHost {
  readonly selected = signal('one');
  readonly mode = signal<'tabs' | 'toggle'>('tabs');
  readonly items = [{ id: 'one', label: 'Primeiro' }, { id: 'disabled', label: 'Indisponível', disabled: true }, { id: 'two', label: 'Segundo' }];
}

describe('design system navigation', () => {
  it('supports roving focus, skips disabled tabs and activates with arrows/Home/End', async () => {
    const fixture = TestBed.createComponent(NavigationHost);
    await fixture.whenStable();
    const buttons = fixture.nativeElement.querySelectorAll('sp-tabs button') as NodeListOf<HTMLButtonElement>;
    buttons[0].focus();
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe('two');
    expect(document.activeElement).toBe(buttons[2]);
    expect(buttons[2].getAttribute('aria-selected')).toBe('true');
    expect(buttons[0].tabIndex).toBe(-1);
    buttons[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe('one');
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(fixture.componentInstance.selected()).toBe('two');
  });

  it('uses pressed native buttons, rather than fictitious panels, for view switches', async () => {
    const fixture = TestBed.createComponent(NavigationHost);
    fixture.componentInstance.mode.set('toggle');
    await fixture.whenStable();
    const buttons = fixture.nativeElement.querySelectorAll('sp-tabs button') as NodeListOf<HTMLButtonElement>;
    expect(fixture.nativeElement.querySelector('[role=group]')).not.toBeNull();
    expect(buttons[0].hasAttribute('role')).toBe(false);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    buttons[2].click();
    expect(fixture.componentInstance.selected()).toBe('two');
    expect(buttons[1].disabled).toBe(true);
  });

  it('preserves native table semantics, caption and responsive classes', async () => {
    const fixture = TestBed.createComponent(NavigationHost);
    await fixture.whenStable();
    const table = fixture.nativeElement.querySelector('table') as HTMLTableElement;
    expect(table.classList.contains('is-stackable')).toBe(true);
    expect(table.classList.contains('page-table')).toBe(true);
    expect(table.dataset['density']).toBe('compact');
    expect(table.querySelector('caption')?.textContent).toBe('Dados do exemplo');
    expect(table.querySelector('th')?.scope).toBe('col');
  });
});
