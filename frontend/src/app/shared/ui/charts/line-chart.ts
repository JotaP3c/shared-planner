import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface LineChartPoint {
  date: string;
  label: string;
  primary: number;
  secondary: number;
}

const WIDTH = 960;
const HEIGHT = 290;
const LEFT = 88;
const RIGHT = 20;
const TOP = 20;
const BOTTOM = 44;
const BASELINE = HEIGHT - BOTTOM;

/** Revenue series on a true civil-date axis, with keyboard and pointer tooltips. */
@Component({
  selector: 'sp-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hasValues()) {
      <figure class="sp-line-chart" (mouseleave)="activeIndex.set(null)">
        <div class="sp-line-plot">
          <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" [attr.aria-label]="label()">
            <defs>
              <linearGradient id="finance-revenue-area" x1="0" [attr.y1]="top" x2="0" [attr.y2]="baseline" gradientUnits="userSpaceOnUse">
                <stop offset="0%" class="sp-line-gradient-start" />
                <stop offset="100%" class="sp-line-gradient-end" />
              </linearGradient>
            </defs>
            @for (tick of yTicks(); track tick.value) {
              <line class="sp-line-grid" [attr.x1]="left" [attr.x2]="width - right" [attr.y1]="tick.y" [attr.y2]="tick.y" />
              <text class="sp-line-axis" [attr.x]="left - 12" [attr.y]="tick.y + 4" text-anchor="end">{{ axisCurrency(tick.value) }}</text>
            }
            <path class="sp-line-area" [attr.d]="areaPath()" />
            <path class="sp-line-series primary" [attr.d]="primaryPath()" />
            <path class="sp-line-series secondary" [attr.d]="secondaryPath()" />
            @if (activePoint(); as active) {
              <line class="sp-line-cursor" [attr.x1]="active.x" [attr.x2]="active.x" [attr.y1]="top" [attr.y2]="baseline" />
            }
            @for (point of plottedPoints(); track point.date) {
              @if (point.showLabel) {
                <text class="sp-line-axis" [attr.x]="point.x" [attr.y]="baseline + 27" text-anchor="middle">{{ point.label }}</text>
              }
              <g class="sp-line-point" tabindex="0" role="img" [attr.aria-label]="pointDescription(point)"
                (mouseenter)="activeIndex.set($index)" (focus)="activeIndex.set($index)" (blur)="activeIndex.set(null)">
                <title>{{ pointDescription(point) }}</title>
                <rect [attr.x]="point.hitStart" [attr.y]="top" [attr.width]="point.hitWidth" [attr.height]="baseline - top" fill="transparent" />
                <circle class="primary" [attr.cx]="point.x" [attr.cy]="point.primaryY" [attr.r]="activeIndex() === $index || plottedPoints().length === 1 ? 4 : 0" />
                <circle class="secondary" [attr.cx]="point.x" [attr.cy]="point.secondaryY" [attr.r]="activeIndex() === $index || plottedPoints().length === 1 ? 4 : 0" />
              </g>
            }
          </svg>
          @if (activePoint(); as point) {
            <div class="sp-line-tooltip" [style.left.%]="tooltipLeft()" aria-hidden="true">
              <strong>{{ point.dateLabel }}</strong>
              <span><i class="sp-swatch tone-expected"></i>{{ primaryLabel() }} <b>{{ format()(point.primary) }}</b></span>
              <span><i class="sp-swatch tone-received"></i>{{ secondaryLabel() }} <b>{{ format()(point.secondary) }}</b></span>
            </div>
          }
        </div>
        <figcaption class="sp-chart-legend inline">
          <span><i class="sp-swatch tone-expected" aria-hidden="true"></i>{{ primaryLabel() }}</span>
          <span><i class="sp-swatch tone-received" aria-hidden="true"></i>{{ secondaryLabel() }}</span>
          <small>Passe o cursor ou use Tab para consultar os valores.</small>
        </figcaption>
        <table class="sr-only">
          <caption>{{ label() }}</caption>
          <thead><tr><th>Período</th><th>{{ primaryLabel() }}</th><th>{{ secondaryLabel() }}</th></tr></thead>
          <tbody>
            @for (point of points(); track point.date) {
              <tr><td>{{ point.date }}</td><td>{{ format()(point.primary) }}</td><td>{{ format()(point.secondary) }}</td></tr>
            }
          </tbody>
        </table>
      </figure>
    } @else {
      <p class="sp-chart-empty" role="status">{{ emptyMessage() }}</p>
    }
  `,
})
export class LineChart {
  readonly points = input.required<LineChartPoint[]>();
  readonly label = input('Evolução');
  readonly primaryLabel = input('Prevista');
  readonly secondaryLabel = input('Recebida');
  readonly emptyMessage = input('Sem valores no período.');
  readonly format = input<(value: number) => string>(value => String(value));
  readonly activeIndex = signal<number | null>(null);
  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly left = LEFT;
  protected readonly right = RIGHT;
  protected readonly top = TOP;
  protected readonly baseline = BASELINE;

  readonly maxValue = computed(() => this.points().reduce((max, point) => Math.max(max, point.primary || 0, point.secondary || 0), 0));
  readonly hasValues = computed(() => this.maxValue() > 0);
  readonly scaleMax = computed(() => {
    const rough = (this.maxValue() || 1) / 4;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const normalized = rough / magnitude;
    const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
    return Math.ceil(this.maxValue() / step) * step || 1;
  });
  readonly yTicks = computed(() => Array.from({ length: 5 }, (_, index) => ({
    value: this.scaleMax() * index / 4,
    y: BASELINE - (BASELINE - TOP) * index / 4,
  })));
  readonly plottedPoints = computed(() => {
    const points = [...this.points()].sort((a, b) => a.date.localeCompare(b.date));
    const timestamps = points.map(point => Date.parse(`${point.date}T00:00:00Z`));
    const first = timestamps[0];
    const range = timestamps[timestamps.length - 1] - first;
    const x = (index: number) => range > 0
      ? LEFT + (timestamps[index] - first) / range * (WIDTH - LEFT - RIGHT)
      : LEFT + (WIDTH - LEFT - RIGHT) / 2;
    const y = (value: number) => BASELINE - Math.max(0, value || 0) / this.scaleMax() * (BASELINE - TOP);
    const labelEvery = Math.max(1, Math.ceil((points.length - 1) / 6));
    return points.map((point, index) => {
      const hitStart = index === 0 ? LEFT : (x(index - 1) + x(index)) / 2;
      const hitEnd = index === points.length - 1 ? WIDTH - RIGHT : (x(index) + x(index + 1)) / 2;
      return { ...point, x: x(index), primaryY: y(point.primary), secondaryY: y(point.secondary),
        hitStart, hitWidth: hitEnd - hitStart,
        showLabel: index % labelEvery === 0 || index === points.length - 1,
        dateLabel: new Date(timestamps[index]).toLocaleDateString('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }),
      };
    });
  });
  readonly primaryPath = computed(() => this.path('primaryY'));
  readonly secondaryPath = computed(() => this.path('secondaryY'));
  readonly areaPath = computed(() => {
    const points = this.plottedPoints();
    if (!points.length) return '';
    return `${this.primaryPath()} L ${points[points.length - 1].x} ${BASELINE} L ${points[0].x} ${BASELINE} Z`;
  });
  readonly activePoint = computed(() => this.plottedPoints()[this.activeIndex() ?? -1] ?? null);
  readonly tooltipLeft = computed(() => Math.max(3, Math.min(70, (this.activePoint()?.x ?? 0) / WIDTH * 100 - 10)));

  axisCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: value >= 10000 ? 'compact' : 'standard', maximumFractionDigits: value >= 10000 ? 1 : 0 }).format(value);
  }

  pointDescription(point: LineChartPoint): string {
    return `${point.label} · ${this.primaryLabel()}: ${this.format()(point.primary)} · ${this.secondaryLabel()}: ${this.format()(point.secondary)}`;
  }

  private path(field: 'primaryY' | 'secondaryY'): string {
    return this.plottedPoints().map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point[field].toFixed(2)}`).join(' ');
  }
}
