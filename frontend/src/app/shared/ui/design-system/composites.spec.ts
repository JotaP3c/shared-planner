import { Component, Type, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpBadge } from './badge.component';
import { SpCard } from './card.component';
import { SpDropdown, SpDropdownItem } from './dropdown.component';
import { SpEmptyState } from './empty-state.component';
import { SpLoadingState } from './loading-state.component';
import { SpModal } from './modal.component';
import { SpPageHeader } from './page-header.component';
import { SpTooltip } from './tooltip.directive';

@Component({
  imports: [SpModal],
  template: `
    <button id="opener" (click)="open.set(true)">Abrir modal</button>
    <sp-modal title="Confirmar exemplo" description="Nenhum dado real será alterado."
      [open]="open()" [closeOnEscape]="escape()" [closeOnBackdrop]="backdrop()" (closed)="close()">
      <label for="modal-name">Nome</label><input id="modal-name" autofocus />
      <button disabled>Indisponível</button>
      <button spModalFooter id="last" (click)="close()">Concluir</button>
    </sp-modal>
  `,
})
class ModalHost {
  readonly open = signal(false);
  readonly escape = signal(true);
  readonly backdrop = signal(true);
  closed = 0;
  close(): void { this.closed++; this.open.set(false); }
}

@Component({
  imports: [SpDropdown],
  template: '<button id="outside">Outro controle</button><sp-dropdown label="Ações de exemplo" [items]="items()" (selected)="selection = $event" />',
})
class DropdownHost {
  readonly items = signal<readonly SpDropdownItem[]>([
    { id: 'disabled', label: 'Indisponível', disabled: true },
    { id: 'edit', label: 'Editar exemplo', icon: 'edit' },
    { id: 'export', label: 'Exportar exemplo', disabled: true },
    { id: 'cancel', label: 'Cancelar exemplo' },
  ]);
  selection = '';
}

@Component({
  imports: [SpTooltip],
  template: `
    <span id="existing-hint">Descrição existente</span>
    <button id="tip-trigger" [spTooltip]="text()" aria-describedby="existing-hint">Ajuda</button>
    <button disabled spTooltip="Nunca mostrado">Desabilitado</button>
    <dialog open><button id="dialog-trigger" spTooltip="Ajuda dentro do modal">Ajuda do modal</button></dialog>
  `,
})
class TooltipHost {
  readonly text = signal('Informação complementar');
}

@Component({
  imports: [SpCard, SpBadge, SpPageHeader, SpEmptyState, SpLoadingState],
  template: `
    <sp-page-header title="Biblioteca visual" eyebrow="Shared Planner" description="Componentes reutilizáveis">
      <button spHeaderActions (click)="action = action + 1">Ação do cabeçalho</button>
    </sp-page-header>
    <sp-card><sp-badge variant="success">Ativo</sp-badge>
      <sp-empty-state title="Nenhum exemplo selecionado" description="Escolha uma opção para continuar.">
        <button (click)="action = action + 1">Selecionar exemplo</button>
      </sp-empty-state>
    </sp-card>
    <sp-loading-state label="Carregando exemplos" />
  `,
})
class CompositionHost { action = 0; }

function key(target: Element, value: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe('Design System compositions', () => {
  const mounted: ComponentFixture<unknown>[] = [];
  let showModalDescriptor: PropertyDescriptor | undefined;
  let closeDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    showModalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
    closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
    // jsdom has no browser top layer. Focus containment/return still use the real directive.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } });
  });

  afterEach(() => {
    for (const fixture of mounted.splice(0)) { fixture.destroy(); fixture.nativeElement.remove(); }
    if (showModalDescriptor) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModalDescriptor);
    else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
    if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, 'close', closeDescriptor);
    else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
    vi.useRealTimers();
  });

  function mount<T>(component: Type<T>): ComponentFixture<T> {
    TestBed.configureTestingModule({ imports: [component] });
    const fixture = TestBed.createComponent(component);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    mounted.push(fixture);
    return fixture;
  }

  it('opens a named modal, contains focus, skips disabled actions and restores focus and scrolling after Escape', async () => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'scroll';
    const fixture = mount(ModalHost);
    const host = fixture.nativeElement as HTMLElement;
    const opener = host.querySelector<HTMLButtonElement>('#opener')!;
    opener.focus(); opener.click(); fixture.detectChanges(); await fixture.whenStable();
    const dialog = host.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Confirmar exemplo');
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toContain('Nenhum dado real');
    expect(document.activeElement).toBe(host.querySelector('#modal-name'));
    const last = host.querySelector<HTMLButtonElement>('#last')!;
    last.focus(); expect(key(last, 'Tab').defaultPrevented).toBe(true);
    const close = dialog.querySelector('button')!;
    expect(document.activeElement).toBe(close);
    expect(key(close, 'Tab', true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    expect(document.body.style.overflow).toBe('hidden');
    const cancel = new Event('cancel', { cancelable: true }); dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.componentInstance.closed).toBe(1);
    expect(host.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = previousOverflow;
  });

  it('honors modal dismissal policies without allowing native state to diverge', async () => {
    const fixture = mount(ModalHost);
    fixture.componentInstance.escape.set(false); fixture.componentInstance.backdrop.set(false); fixture.componentInstance.open.set(true);
    fixture.detectChanges(); await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const cancel = new Event('cancel', { cancelable: true }); dialog.dispatchEvent(cancel);
    dialog.click(); fixture.detectChanges();
    expect(cancel.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.closed).toBe(0);
    expect(dialog.open).toBe(true);
    fixture.componentInstance.backdrop.set(true); fixture.detectChanges();
    dialog.click(); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.componentInstance.closed).toBe(1);
  });

  it('navigates dropdown items with the keyboard, skips disabled items and returns focus on Escape', async () => {
    const fixture = mount(DropdownHost);
    const trigger = fixture.nativeElement.querySelector('sp-dropdown > button') as HTMLButtonElement;
    trigger.focus(); expect(key(trigger, 'ArrowDown').defaultPrevented).toBe(true);
    fixture.detectChanges(); await fixture.whenStable();
    const items = fixture.nativeElement.querySelectorAll('[role=menuitem]') as NodeListOf<HTMLButtonElement>;
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(items[1]);
    key(items[1], 'ArrowUp'); expect(document.activeElement).toBe(items[3]);
    key(items[3], 'Home'); expect(document.activeElement).toBe(items[1]);
    key(items[1], 'End'); expect(document.activeElement).toBe(items[3]);
    key(items[3], 'Escape'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=menu]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('emits only enabled dropdown actions and closes on selection or an outside click', async () => {
    const fixture = mount(DropdownHost);
    const trigger = fixture.nativeElement.querySelector('sp-dropdown > button') as HTMLButtonElement;
    trigger.click(); fixture.detectChanges(); await fixture.whenStable();
    const items = fixture.nativeElement.querySelectorAll('[role=menuitem]') as NodeListOf<HTMLButtonElement>;
    items[0].click(); expect(fixture.componentInstance.selection).toBe('');
    items[1].click(); fixture.detectChanges();
    expect(fixture.componentInstance.selection).toBe('edit');
    expect(document.activeElement).toBe(trigger);
    trigger.click(); fixture.detectChanges(); await fixture.whenStable();
    const outside = fixture.nativeElement.querySelector('#outside') as HTMLButtonElement;
    outside.focus(); outside.click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=menu]')).toBeNull();
    expect(document.activeElement).toBe(outside);
  });

  it('leaves native Tab navigation available and can dismiss an empty menu', async () => {
    const fixture = mount(DropdownHost);
    const trigger = fixture.nativeElement.querySelector('sp-dropdown > button') as HTMLButtonElement;
    trigger.click(); fixture.detectChanges(); await fixture.whenStable();
    const item = fixture.nativeElement.querySelectorAll('[role=menuitem]')[1];
    expect(key(item, 'Tab').defaultPrevented).toBe(false); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=menu]')).toBeNull();
    fixture.componentInstance.items.set([]); fixture.detectChanges();
    trigger.click(); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=menu]')?.textContent).toContain('Nenhuma ação');
    key(trigger, 'Escape'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=menu]')).toBeNull();
  });

  it('exposes tooltip descriptions on focus, preserves existing descriptions and dismisses with Escape', () => {
    const fixture = mount(TooltipHost);
    const trigger = fixture.nativeElement.querySelector('#tip-trigger') as HTMLButtonElement;
    trigger.focus();
    const tooltip = document.querySelector('[role=tooltip]')!;
    expect(tooltip.textContent).toBe('Informação complementar');
    expect(trigger.getAttribute('aria-describedby')?.split(' ')).toEqual(['existing-hint', tooltip.id]);
    const containerEscape = vi.fn();
    fixture.nativeElement.addEventListener('keydown', containerEscape);
    expect(key(trigger, 'Escape').defaultPrevented).toBe(true);
    expect(containerEscape).not.toHaveBeenCalled();
    expect(document.querySelector('[role=tooltip]')).toBeNull();
    expect(trigger.getAttribute('aria-describedby')).toBe('existing-hint');
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps hovered tooltip content available and removes it after leaving both trigger and tooltip', () => {
    vi.useFakeTimers();
    const fixture = mount(TooltipHost);
    const trigger = fixture.nativeElement.querySelector('#tip-trigger') as HTMLButtonElement;
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    const tooltip = document.querySelector('[role=tooltip]')!;
    trigger.dispatchEvent(new MouseEvent('mouseleave'));
    tooltip.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(150);
    expect(document.querySelector('[role=tooltip]')).toBe(tooltip);
    tooltip.dispatchEvent(new MouseEvent('mouseleave')); vi.advanceTimersByTime(150);
    expect(document.querySelector('[role=tooltip]')).toBeNull();
  });

  it('updates tooltip text safely and cleans up floating content and description IDs on destroy', () => {
    const fixture = mount(TooltipHost);
    const trigger = fixture.nativeElement.querySelector('#tip-trigger') as HTMLButtonElement;
    trigger.focus(); fixture.componentInstance.text.set('<img src=x onerror=alert(1)>'); fixture.detectChanges();
    expect(document.querySelector('[role=tooltip]')?.textContent).toContain('<img');
    expect(document.querySelector('[role=tooltip] img')).toBeNull();
    fixture.destroy();
    expect(document.querySelector('[role=tooltip]')).toBeNull();
    expect(trigger.getAttribute('aria-describedby')).toBe('existing-hint');
  });

  it('places dialog tooltips inside the native top layer and ignores disabled triggers', () => {
    const fixture = mount(TooltipHost);
    const disabled = fixture.nativeElement.querySelector('button[disabled]') as HTMLButtonElement;
    disabled.dispatchEvent(new MouseEvent('mouseenter'));
    expect(document.querySelector('[role=tooltip]')).toBeNull();
    const dialogTrigger = fixture.nativeElement.querySelector('#dialog-trigger') as HTMLButtonElement;
    dialogTrigger.focus();
    expect(document.querySelector('[role=tooltip]')?.parentElement).toBe(dialogTrigger.closest('dialog'));
  });

  it('retains headings, textual statuses and projected actions in page compositions', () => {
    const fixture = mount(CompositionHost);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent).toBe('Biblioteca visual');
    expect(host.querySelector('sp-badge')?.textContent).toBe('Ativo');
    expect(host.querySelector('sp-empty-state h3')?.textContent).toBe('Nenhum exemplo selecionado');
    host.querySelector<HTMLButtonElement>('[spHeaderActions]')!.click();
    host.querySelector<HTMLButtonElement>('sp-empty-state button')!.click();
    expect(fixture.componentInstance.action).toBe(2);
    const loading = host.querySelector('sp-loading-state')!;
    expect(loading.getAttribute('role')).toBe('status');
    expect(loading.getAttribute('aria-live')).toBe('polite');
    expect(loading.hasAttribute('aria-busy')).toBe(false);
    expect(loading.textContent).toBe('Carregando exemplos');
  });
});
