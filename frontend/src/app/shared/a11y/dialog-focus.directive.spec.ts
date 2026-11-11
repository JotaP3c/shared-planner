import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DialogFocusDirective } from './dialog-focus.directive';

@Component({
  imports: [DialogFocusDirective],
  template: `
    <button id="opener" type="button" (click)="open.set(true)">Abrir</button>
    @if (open()) {
      <div spDialogFocus role="dialog" aria-modal="true">
        <input id="first" />
        <button id="last" type="button" (click)="open.set(false)">Fechar</button>
      </div>
    }
  `,
})
class HostComponent {
  readonly open = signal(false);
}

describe('DialogFocusDirective', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    return fixture;
  }

  const tab = (shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    document.activeElement?.dispatchEvent(event);
    return event;
  };

  it('moves focus into the dialog, traps Tab / Shift+Tab and restores focus on close', () => {
    const fixture = setup();
    const opener = fixture.nativeElement.querySelector('#opener') as HTMLButtonElement;
    opener.focus();

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    const first = fixture.nativeElement.querySelector('#first') as HTMLElement;
    const last = fixture.nativeElement.querySelector('#last') as HTMLElement;
    expect(document.activeElement).toBe(first);

    last.focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    expect(tab(true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(opener);

    fixture.nativeElement.remove();
  });
});
