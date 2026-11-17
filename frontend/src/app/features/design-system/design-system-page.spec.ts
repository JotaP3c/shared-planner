import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DesignSystemPage } from './design-system-page';
import { ThemeService } from '../../core/theme/theme.service';

describe('DesignSystemPage', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [DesignSystemPage], providers: [provideRouter([])] }));
  afterEach(() => localStorage.removeItem('sharedPlanner.theme'));

  it('validates an example without submitting a request and clears its error after valid input', async () => {
    const fixture = TestBed.createComponent(DesignSystemPage);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.submitExample();
    fixture.detectChanges();
    expect(component.nameError()).toBe('Informe um nome para continuar.');
    expect((fixture.nativeElement as HTMLElement).querySelector('#ds-name')?.getAttribute('aria-invalid')).toBe('true');
    component.form.controls.name.setValue('Planejamento de teste');
    component.submitExample();
    fixture.detectChanges();
    expect(component.nameError()).toBe('');
    expect(component.feedback()).toContain('Nenhum dado foi enviado');
  });

  it('uses the application theme service for all three preferences', async () => {
    const fixture = TestBed.createComponent(DesignSystemPage);
    await fixture.whenStable();
    const theme = TestBed.inject(ThemeService);
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.ds-theme button');
    buttons[1].click();
    fixture.detectChanges();
    expect(theme.preference()).toBe('dark');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    buttons[2].click();
    expect(theme.preference()).toBe('system');
    buttons[0].click();
    expect(theme.preference()).toBe('light');
  });
});
