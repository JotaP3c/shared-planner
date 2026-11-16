import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LineChart } from './line-chart';

describe('LineChart', () => {
  let fixture: ComponentFixture<LineChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LineChart] }).compileComponents();
    fixture = TestBed.createComponent(LineChart);
    fixture.componentRef.setInput('format', (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`);
  });

  it('spaces points by their civil dates and exposes formatted values on keyboard focus', () => {
    fixture.componentRef.setInput('points', [
      { date: '2026-11-01', label: '01/11', primary: 50, secondary: 20 },
      { date: '2026-11-02', label: '02/11', primary: 80, secondary: 30 },
      { date: '2026-11-30', label: '30/11', primary: 150, secondary: 100 },
    ]);
    fixture.detectChanges();
    const points = fixture.componentInstance.plottedPoints();
    expect((points[1].x - points[0].x) / (points[2].x - points[0].x)).toBeCloseTo(1 / 29);
    expect(fixture.nativeElement.querySelectorAll('.sp-line-series')).toHaveLength(2);
    const target = fixture.nativeElement.querySelectorAll('.sp-line-point')[1] as SVGGElement;
    target.dispatchEvent(new FocusEvent('focus')); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.sp-line-tooltip')?.textContent).toContain('R$ 80,00');
    expect(fixture.nativeElement.querySelector('.sp-line-tooltip')?.textContent).toContain('R$ 30,00');
    expect(fixture.nativeElement.querySelectorAll('.sp-line-grid')).toHaveLength(5);
    expect(fixture.nativeElement.querySelector('table')?.textContent).toContain('2026-11-30');
  });

  it('shows an explicit empty state and safely plots a single nonzero point', () => {
    fixture.componentRef.setInput('points', []); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sem valores no período.');
    fixture.componentRef.setInput('points', [{ date: '2026-11-12', label: '12/11', primary: 50, secondary: 50 }]);
    fixture.detectChanges();
    expect(fixture.componentInstance.primaryPath()).not.toContain('NaN');
    expect(fixture.componentInstance.plottedPoints()[0].x).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelectorAll('.sp-line-point circle[r="4"]')).toHaveLength(2);
  });
});
